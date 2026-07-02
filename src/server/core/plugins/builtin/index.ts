/**
 * Built-in Plugins — registration entry point.
 *
 * These plugins replace the previously hardcoded moderation and notification
 * logic in comment-submit.ts. They are registered at server startup.
 *
 * Plugins run in this order in the preSubmit pipeline:
 *   1. keyword  — fast keyword/pattern check
 *   2. bigram   — duplicate comment detection
 *   3. ai       — LLM-powered deep analysis
 *
 * Post-submit (fire-and-forget, order irrelevant):
 *   4. email    — SMTP reply + admin notifications
 *   5. pushoo   — Pushoo multi-channel push
 */

import { registerPlugin } from '../registry'
import { keywordModerationPlugin } from './keyword'
import { bigramPlugin } from './bigram'
import { aiModerationPlugin } from './ai-moderation'
import { emailNotifyPlugin } from './email'
import { pushooNotifyPlugin } from './pushoo'

/** All built-in plugins */
export const builtinPlugins = [
  keywordModerationPlugin,
  bigramPlugin,
  aiModerationPlugin,
  emailNotifyPlugin,
  pushooNotifyPlugin,
]

/** Register all built-in plugins */
export async function registerBuiltinPlugins (): Promise<void> {
  for (const plugin of builtinPlugins) {
    await registerPlugin(plugin)
  }
}
