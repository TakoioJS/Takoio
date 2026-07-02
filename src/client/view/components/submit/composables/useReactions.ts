import { ref, Ref } from 'vue'
import type { TakoioConfig } from '../../../../types.ts'
import { getReactions, toggleReaction as toggleReactionApi } from '../../../../utils'

export interface ReactionsState {
  reactions: Ref<Record<string, number>>
  myReactions: Ref<string[]>
}

export interface ReactionsHandlers {
  fetchReactions: () => Promise<void>
  toggleReaction: (emoji: string) => Promise<void>
}

export interface UseReactionsOptions {
  options: TakoioConfig
  toast: (msg: string) => void
}

export function useReactions (opts: UseReactionsOptions): ReactionsState & ReactionsHandlers {
  const reactions = ref<Record<string, number>>({})
  const myReactions = ref<string[]>([])

  const fetchReactions = async (): Promise<void> => {
    try {
      const url = typeof window !== 'undefined' ? window.location.pathname : '/'
      const d = await getReactions(opts.options.envId, url)
      if (d?.reactions) { reactions.value = d.reactions; myReactions.value = d.myReactions || [] }
    } catch {}
  }

  const toggleReaction = async (emoji: string): Promise<void> => {
    try {
      const url = typeof window !== 'undefined' ? window.location.pathname : '/'
      const d = await toggleReactionApi(opts.options.envId, url, emoji)
      if (d?.reactions) { reactions.value = d.reactions; myReactions.value = d.myReactions || [] }
    } catch {
      opts.toast('操作失败，请重试')
    }
  }

  return { reactions, myReactions, fetchReactions, toggleReaction }
}
