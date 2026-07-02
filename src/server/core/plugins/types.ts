/**
 * Plugin System — Type Definitions
 *
 * Takoio v2.0 plugin architecture.
 * Plugins hook into the comment lifecycle pipeline to extend functionality
 * without modifying core code.
 *
 * @see docs/architecture-design.md ADR-002
 */

import type { H3Event } from 'h3'
import type { CommentInput, Comment } from '../store/types'
import type { CommentListItem } from '../store/types'

// ========== Hook Context ==========

/** Context passed to every pipeline hook */
export interface HookContext {
  /** The H3 event (request/response) */
  event: H3Event
  /** Client IP address */
  ip: string
  /** Current site config snapshot */
  config: Record<string, any>
}

// ========== Plugin Context (lifecycle) ==========

/** Context passed to plugin lifecycle hooks (onInit/onDestroy) */
export interface PluginContext {
  config: Record<string, any>
  logger: {
    debug: (...args: any[]) => void
    info: (...args: any[]) => void
    warn: (...args: any[]) => void
    error: (...args: any[]) => void
  }
}

// ========== Hook Results ==========

/** Result of a pipeline hook that can approve/reject/modify */
export type HookResult =
  | { action: 'continue' }
  | { action: 'reject'; reason: string }
  | { action: 'modify'; comment: Partial<CommentInput> }

// ========== Plugin Route ==========

/** A route registered by a plugin */
export interface PluginRoute {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  handler: (event: H3Event) => Promise<any>
}

// ========== Plugin Interface ==========

/** A Takoio plugin — hooks into the comment lifecycle */
export interface TakoioPlugin {
  /** Unique plugin identifier */
  name: string
  /** Semantic version */
  version: string

  // --- Lifecycle ---

  /** Called when plugin is registered */
  onInit? (ctx: PluginContext): Promise<void>
  /** Called when plugin is unregistered or server shuts down */
  onDestroy? (): Promise<void>

  // --- Comment Submission Pipeline ---

  /** Before a comment is persisted — can approve, reject, or modify */
  preSubmit? (comment: CommentInput, ctx: HookContext): Promise<HookResult>

  /** After a comment is persisted — fire-and-forget for notifications etc. */
  postSubmit? (comment: Comment, ctx: HookContext): Promise<void>

  // --- Moderation Pipeline ---

  /** Before an admin approves a pending comment */
  preApprove? (commentId: string, ctx: HookContext): Promise<HookResult>

  /** Before an admin deletes a comment */
  preDelete? (commentId: string, ctx: HookContext): Promise<HookResult>

  // --- Render Pipeline ---

  /** Before a comment is rendered for the client — can transform content */
  preRender? (comment: Comment, ctx: HookContext): Promise<Comment>

  /** After a comment is rendered — can inject additional data */
  postRender? (comment: CommentListItem, ctx: HookContext): Promise<CommentListItem>

  // --- Admin Hooks ---

  /** When config changes — plugins can react to settings updates */
  onConfigChange? (key: string, value: unknown): Promise<void>

  // --- Route Extension ---

  /** Additional API routes registered by this plugin */
  routes? (): PluginRoute[]
}

// ========== Pipeline Types ==========

/** Names of hooks that participate in the pipeline */
export type PipelineHookName =
  | 'preSubmit'
  | 'postSubmit'
  | 'preApprove'
  | 'preDelete'
  | 'preRender'
  | 'postRender'

/** Timeout behavior per hook type */
export const HOOK_TIMEOUTS: Record<PipelineHookName, {
  ms: number
  onTimeout: 'reject' | 'skip' | 'passthrough'
}> = {
  preSubmit:   { ms: 10_000, onTimeout: 'reject' },
  postSubmit:  { ms: 10_000, onTimeout: 'skip' },
  preApprove:  { ms: 10_000, onTimeout: 'reject' },
  preDelete:   { ms: 10_000, onTimeout: 'reject' },
  preRender:   { ms: 10_000, onTimeout: 'passthrough' },
  postRender:  { ms: 10_000, onTimeout: 'skip' },
}

/** Result of a pipeline execution */
export interface PipelineResult {
  /** Whether the pipeline passed (no reject) */
  passed: boolean
  /** If rejected, the rejection reason */
  reason?: string
  /** Modified comment data (from modify action) */
  modifications?: Partial<CommentInput>
  /** Which plugin caused the rejection (if any) */
  rejectedBy?: string
  /** Timing info for diagnostics */
  timings: Array<{ plugin: string; hook: string; ms: number; result: string }>
}
