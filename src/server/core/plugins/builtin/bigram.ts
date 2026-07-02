/**
 * Built-in Plugin: Bigram Similarity Spam Detection
 *
 * Second-layer anti-spam — detects duplicate/repeated comments
 * by comparing bigram similarity with recent comments.
 * Uses preSubmit hook.
 */

import type { TakoioPlugin, HookContext, HookResult } from '../types'
import { commentStore } from '../../store/index'

function getBigrams (str: string): Set<string> {
  const s = new Set<string>()
  for (let i = 0; i < str.length - 1; i++) s.add(str.slice(i, i + 2))
  return s
}

export const bigramPlugin: TakoioPlugin = {
  name: 'moderation-bigram',
  version: '1.0.0',

  async preSubmit (comment, ctx: HookContext): Promise<HookResult> {
    const text = comment.comment || ''
    const setA = getBigrams(text)
    if (setA.size === 0) return { action: 'continue' }

    let rawRecent
    try {
      rawRecent = await commentStore.getRawRecentComments(20)
    } catch {
      return { action: 'continue' } // DB error — pass through
    }

    if (!rawRecent || rawRecent.length === 0) return { action: 'continue' }

    let maxSim = 0
    for (const c of rawRecent.slice(0, 20)) {
      const setB = getBigrams(c.comment || '')
      if (setB.size === 0) continue
      let intersection = 0
      for (const bg of setA) { if (setB.has(bg)) intersection++ }
      const sim = setA.size + setB.size - intersection === 0
        ? 0
        : intersection / (setA.size + setB.size - intersection)
      if (sim > maxSim) maxSim = sim
    }

    if (maxSim > 0.8) {
      return { action: 'reject', reason: '内容重复度过高，涉嫌灌水' }
    }

    return { action: 'continue' }
  },
}
