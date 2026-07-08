import { ref } from 'vue'

/** Draft entry stored in localStorage */
export interface DraftEntry {
  nick: string
  mail: string
  link: string
  comment: string
  _ts?: number
}

export interface UseDraftOptions {
  DRAFT_KEY: string
  OLD_DRAFT_KEY: string
  getT: (key: string) => string
  form: { nick: string; mail: string; link: string; comment: string }
  toast: (msg: string) => void
}

export function useDraft (opts: UseDraftOptions) {
  const draftTimer = ref<number | null>(null)

  const saveDraft = (): void => {
    clearDraftTimer()
    draftTimer.value = window.setTimeout(() => {
      const form = opts.form
      if (form.comment.trim() || form.nick.trim() || form.mail.trim()) {
        try {
          localStorage.setItem(opts.DRAFT_KEY, JSON.stringify({ ...form, _ts: Date.now() }))
        } catch {}
      }
    }, 3000)
  }

  const clearDraftTimer = (): void => {
    clearTimeout(draftTimer.value as any)
    draftTimer.value = null
  }

  const loadDraft = (): void => {
    try {
      let raw: string | null = localStorage.getItem(opts.DRAFT_KEY)
      let usedOldKey = false
      if (!raw) {
        raw = localStorage.getItem(opts.OLD_DRAFT_KEY)
        usedOldKey = !!raw
      }
      if (!raw) return
      const draft = JSON.parse(raw) as DraftEntry
      if (draft._ts && Date.now() - draft._ts > 86400000) {
        localStorage.removeItem(usedOldKey ? opts.OLD_DRAFT_KEY : opts.DRAFT_KEY)
        return
      }
      if (usedOldKey) {
        localStorage.removeItem(opts.OLD_DRAFT_KEY)
        localStorage.setItem(opts.DRAFT_KEY, raw)
      }
      opts.form.nick = draft.nick
      opts.form.mail = draft.mail
      opts.form.link = draft.link
      opts.form.comment = draft.comment
      if (draft.comment || draft.nick) {
        opts.toast(opts.getT('draftRestored') || '已为您恢复上次未提交的草稿')
      }
    } catch {}
  }

  return { draftTimer, saveDraft, clearDraftTimer, loadDraft }
}
