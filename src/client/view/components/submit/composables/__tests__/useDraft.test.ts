// @vitest-environment jsdom
/**
 * useDraft 测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useDraft } from '../useDraft'

describe('useDraft', () => {
  const DRAFT_KEY = 'takoio-draft'
  const OLD_DRAFT_KEY = 'twikoo-draft'
  let form: { nick: string; mail: string; link: string; comment: string }
  let toast: any

  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    form = { nick: '', mail: '', link: '', comment: '' }
    toast = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('saves draft to localStorage after 3s debounce', () => {
    const { saveDraft } = useDraft({ DRAFT_KEY, OLD_DRAFT_KEY, form, getT: (k) => k, toast })
    form.comment = 'hello'
    saveDraft()
    vi.advanceTimersByTime(3000)
    const saved = JSON.parse(localStorage.getItem(DRAFT_KEY)!)
    expect(saved.comment).toBe('hello')
    expect(saved._ts).toBeGreaterThan(0)
  })

  it('loads draft from localStorage', () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ nick: 'Alice', comment: 'draft', _ts: Date.now() }))
    const { loadDraft } = useDraft({ DRAFT_KEY, OLD_DRAFT_KEY, form, getT: (k) => k, toast })
    loadDraft()
    expect(form.nick).toBe('Alice')
    expect(form.comment).toBe('draft')
    expect(toast).toHaveBeenCalled()
  })

  it('shows toast on draft restore', () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ nick: 'Alice', comment: 'hi', _ts: Date.now() }))
    const { loadDraft } = useDraft({ DRAFT_KEY, OLD_DRAFT_KEY, form, getT: (k) => k, toast })
    loadDraft()
    expect(toast).toHaveBeenCalledWith('draftRestored')
  })

  it('ignores expired drafts (older than 24h)', () => {
    const oldTs = Date.now() - 25 * 60 * 60 * 1000
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ nick: 'Old', comment: 'stale', _ts: oldTs }))
    const { loadDraft } = useDraft({ DRAFT_KEY, OLD_DRAFT_KEY, form, getT: (k) => k, toast })
    loadDraft()
    expect(form.nick).toBe('')
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull()
  })

  it('migrates from old draft key', () => {
    localStorage.setItem(OLD_DRAFT_KEY, JSON.stringify({ nick: 'Migrated', comment: 'moved', _ts: Date.now() }))
    const { loadDraft } = useDraft({ DRAFT_KEY, OLD_DRAFT_KEY, form, getT: (k) => k, toast })
    loadDraft()
    expect(form.nick).toBe('Migrated')
    expect(localStorage.getItem(OLD_DRAFT_KEY)).toBeNull()
    expect(localStorage.getItem(DRAFT_KEY)).toBeTruthy()
  })
})