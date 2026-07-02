/**
 * Plugin Pipeline Engine
 *
 * Executes registered plugin hooks in sequence with:
 * - first-reject-wins conflict strategy
 * - per-hook timeout enforcement (10s default)
 * - timeout behavior: reject (preSubmit/preApprove/preDelete), skip (postSubmit/postRender), passthrough (preRender)
 *
 * @see docs/architecture-design.md ADR-002
 */

import type {
  TakoioPlugin,
  HookContext,
  HookResult,
  PipelineHookName,
  PipelineResult,
} from './types'
import { HOOK_TIMEOUTS } from './types'
import { getPluginsWithHook } from './registry'
import { logger } from '../utils/logger'

const PIPELINE_DEFAULT_TIMEOUT = 10_000

/** Execute a single plugin hook with timeout */
async function executeHookWithTimeout <T> (
  plugin: TakoioPlugin,
  hookName: PipelineHookName,
  fn: () => Promise<T>,
  timeoutMs: number,
): Promise<{ result?: T; error?: Error; timedOut: boolean; ms: number }> {
  const start = Date.now()
  try {
    const result = await Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Pipeline timeout: ${plugin.name}@${hookName}`)), timeoutMs)
      ),
    ])
    return { result, timedOut: false, ms: Date.now() - start }
  } catch (e) {
    const timedOut = e instanceof Error && e.message.startsWith('Pipeline timeout')
    return { error: timedOut ? e : (e instanceof Error ? e : new Error(String(e))), timedOut, ms: Date.now() - start }
  }
}

/** Run the preSubmit pipeline — returns modified comment or rejection */
export async function runPreSubmit (
  comment: any,
  ctx: HookContext,
): Promise<PipelineResult> {
  return runModifyPipeline('preSubmit', comment, ctx, (p, c, h) => p.preSubmit!(c, h))
}

/** Run the postSubmit pipeline — fire-and-forget, no return value */
export async function runPostSubmit (
  comment: any,
  ctx: HookContext,
): Promise<void> {
  const plugins = getPluginsWithHook('postSubmit')
  if (!plugins.length) return

  for (const plugin of plugins) {
    const { error, timedOut, ms } = await executeHookWithTimeout(
      plugin, 'postSubmit',
      () => plugin.postSubmit!(comment, ctx),
      PIPELINE_DEFAULT_TIMEOUT,
    )
    if (error) {
      logger.warn({ plugin: plugin.name, ms, timedOut }, `[pipeline] postSubmit error`)
      // postSubmit errors are always non-fatal — skip
    }
  }
}

/** Run the preApprove pipeline — returns accept/reject */
export async function runPreApprove (
  commentId: string,
  ctx: HookContext,
): Promise<PipelineResult> {
  return runDecisionPipeline('preApprove', commentId, ctx, (p, id, h) => p.preApprove!(id, h))
}

/** Run the preDelete pipeline — returns accept/reject */
export async function runPreDelete (
  commentId: string,
  ctx: HookContext,
): Promise<PipelineResult> {
  return runDecisionPipeline('preDelete', commentId, ctx, (p, id, h) => p.preDelete!(id, h))
}

/** Run the preRender pipeline — returns transformed comment */
export async function runPreRender (
  comment: any,
  ctx: HookContext,
): Promise<any> {
  const plugins = getPluginsWithHook('preRender')
  let current = comment
  for (const plugin of plugins) {
    const { result, error, timedOut, ms } = await executeHookWithTimeout(
      plugin, 'preRender',
      () => plugin.preRender!(current, ctx),
      PIPELINE_DEFAULT_TIMEOUT,
    )
    if (error) {
      logger.warn({ plugin: plugin.name, ms, timedOut }, `[pipeline] preRender error`)
      // timeout → passthrough: return original content
      continue
    }
    if (result) current = result
  }
  return current
}

/** Run the postRender pipeline — returns enriched list item */
export async function runPostRender (
  item: any,
  ctx: HookContext,
): Promise<any> {
  const plugins = getPluginsWithHook('postRender')
  let current = item
  for (const plugin of plugins) {
    const { result, error, timedOut, ms } = await executeHookWithTimeout(
      plugin, 'postRender',
      () => plugin.postRender!(current, ctx),
      PIPELINE_DEFAULT_TIMEOUT,
    )
    if (error) {
      logger.warn({ plugin: plugin.name, ms, timedOut }, `[pipeline] postRender error`)
      continue
    }
    if (result) current = result
  }
  return current
}

// ========== Internal helpers ==========

/** Pipeline that can modify or reject (preSubmit) */
async function runModifyPipeline (
  hookName: PipelineHookName,
  input: any,
  ctx: HookContext,
  callHook: (p: TakoioPlugin, input: any, ctx: HookContext) => Promise<HookResult>,
): Promise<PipelineResult> {
  const plugins = getPluginsWithHook(hookName as keyof TakoioPlugin)
  const timings: PipelineResult['timings'] = []
  const modifications: Partial<any> = {}

  if (!plugins.length) {
    return { passed: true, timings }
  }

  for (const plugin of plugins) {
    const { result, error, timedOut, ms } = await executeHookWithTimeout(
      plugin, hookName,
      () => callHook(plugin, { ...input, ...modifications }, ctx),
      PIPELINE_DEFAULT_TIMEOUT,
    )

    if (timedOut) {
      // preSubmit timeout → reject
      timings.push({ plugin: plugin.name, hook: hookName, ms, result: 'timeout→reject' })
      return { passed: false, reason: `Plugin "${plugin.name}" timed out`, rejectedBy: plugin.name, timings }
    }

    if (error) {
      timings.push({ plugin: plugin.name, hook: hookName, ms, result: 'error→reject' })
      return { passed: false, reason: error.message, rejectedBy: plugin.name, timings }
    }

    if (!result) {
      timings.push({ plugin: plugin.name, hook: hookName, ms, result: 'no-result→reject' })
      return { passed: false, reason: `Plugin "${plugin.name}" returned no result`, rejectedBy: plugin.name, timings }
    }

    switch (result.action) {
      case 'continue':
        timings.push({ plugin: plugin.name, hook: hookName, ms, result: 'continue' })
        break

      case 'reject':
        timings.push({ plugin: plugin.name, hook: hookName, ms, result: 'reject' })
        return { passed: false, reason: result.reason, rejectedBy: plugin.name, timings }

      case 'modify':
        Object.assign(modifications, result.comment)
        timings.push({ plugin: plugin.name, hook: hookName, ms, result: 'modify' })
        break
    }
  }

  return { passed: true, modifications: Object.keys(modifications).length ? modifications : undefined, timings }
}

/** Pipeline for binary decisions (preApprove, preDelete) */
async function runDecisionPipeline (
  hookName: PipelineHookName,
  id: string,
  ctx: HookContext,
  callHook: (p: TakoioPlugin, id: string, ctx: HookContext) => Promise<HookResult>,
): Promise<PipelineResult> {
  const plugins = getPluginsWithHook(hookName as keyof TakoioPlugin)
  const timings: PipelineResult['timings'] = []

  if (!plugins.length) {
    return { passed: true, timings }
  }

  for (const plugin of plugins) {
    const { result, error, timedOut, ms } = await executeHookWithTimeout(
      plugin, hookName,
      () => callHook(plugin, id, ctx),
      PIPELINE_DEFAULT_TIMEOUT,
    )

    if (timedOut || error) {
      timings.push({ plugin: plugin.name, hook: hookName, ms, result: 'timeout→reject' })
      return { passed: false, reason: error?.message || `Plugin "${plugin.name}" timed out`, rejectedBy: plugin.name, timings }
    }

    if (!result || result.action === 'reject') {
      timings.push({ plugin: plugin.name, hook: hookName, ms, result: 'reject' })
      return { passed: false, reason: result?.reason || `Rejected by ${plugin.name}`, rejectedBy: plugin.name, timings }
    }

    timings.push({ plugin: plugin.name, hook: hookName, ms, result: 'continue' })
  }

  return { passed: true, timings }
}
