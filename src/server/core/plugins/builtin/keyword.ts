/**
 * Built-in Plugin: Keyword Moderation
 *
 * First-layer content check — blocks comments containing configured keywords.
 * Uses preSubmit hook to reject spam before persistence.
 */

import type { TakoioPlugin, HookContext, HookResult } from '../types'

export const keywordModerationPlugin: TakoioPlugin = {
  name: 'moderation-keyword',
  version: '1.0.0',

  async preSubmit (comment, ctx: HookContext): Promise<HookResult> {
    const blocked = ctx.config?.BLOCKED_KEYWORDS as string | undefined
    if (!blocked) return { action: 'continue' }

    const keywords = blocked
      .split(/[,，\n]/)
      .map((k: string) => k.trim())
      .filter((k: string) => k.length > 0)

    if (!keywords.length) return { action: 'continue' }

    // Check nickname
    const nick = comment.nick || ''
    if (nick && keywords.some((kw: string) => nick.includes(kw))) {
      return { action: 'reject', reason: '内容包含敏感词' }
    }

    // Check comment text
    const text = comment.comment || ''
    let hits = 0
    for (const kw of keywords) {
      if (text.includes(kw)) hits++
    }

    // Spam patterns
    const patterns: RegExp[] = [
      /([\u4e00-\u9fa5])\1{4,}/,
      /(.)\1{12,}/,
      /https?:\/\/[^\s]{60,}/
    ]
    for (const p of patterns) {
      if (p.test(text)) hits += 2
    }

    // Too many links
    const linkCount = (text.match(/https?:\/\//g) || []).length
    if (linkCount > 3) hits++

    if (hits > 0) {
      return { action: 'reject', reason: '内容包含敏感词' }
    }

    return { action: 'continue' }
  },
}
