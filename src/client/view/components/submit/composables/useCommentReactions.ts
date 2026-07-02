import { ref, Ref } from 'vue'
import { getCommentReactions, toggleCommentReaction as toggleCommentReactionApi } from '../../../../utils'

export interface CommentReactionsState {
  reactions: Ref<Record<string, number>>
  myReaction: Ref<string | null>
}

export interface CommentReactionsHandlers {
  fetchReactions: (commentId: string) => Promise<void>
  toggleReaction: (commentId: string, emoji: string) => Promise<void>
}

export interface UseCommentReactionsOptions {
  envId: string
  toast: (msg: string) => void
}

export function useCommentReactions (opts: UseCommentReactionsOptions): CommentReactionsState & CommentReactionsHandlers {
  const reactions = ref<Record<string, number>>({})
  const myReaction = ref<string | null>(null)

  const fetchReactions = async (commentId: string): Promise<void> => {
    try {
      const d = await getCommentReactions(opts.envId, commentId)
      if (d?.reactions) { reactions.value = d.reactions; myReaction.value = d.myReaction || null }
    } catch {}
  }

  const toggleReaction = async (commentId: string, emoji: string): Promise<void> => {
    try {
      const d = await toggleCommentReactionApi(opts.envId, commentId, emoji)
      if (d?.reactions) { reactions.value = d.reactions; myReaction.value = d.myReaction || null }
    } catch {
      opts.toast('操作失败，请重试')
    }
  }

  return { reactions, myReaction, fetchReactions, toggleReaction }
}
