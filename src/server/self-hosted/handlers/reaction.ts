import { reactionStore } from '../store/index'

export const handleReactionGet = async (data: any) => {
  const url = data.url || '/'
  const ip = data._ip || 'unknown'
  const raw = await reactionStore.getReactions(url)
  return formatReactions(raw, ip)
}

export const handleReactionSubmit = async (data: any) => {
  const url = data.url || '/'
  const emoji = data.emoji
  const ip = data._ip || 'unknown'
  
  if (!emoji || typeof emoji !== 'string') {
    throw new Error('Invalid emoji')
  }

  const raw = await reactionStore.toggleReaction(url, emoji, ip)
  return formatReactions(raw, ip)
}

function formatReactions(raw: Record<string, string[]>, ip: string) {
  const reactions: Record<string, number> = {}
  const myReactions: string[] = []
  
  for (const [emoji, ips] of Object.entries(raw)) {
    if (ips.length > 0) {
      reactions[emoji] = ips.length
      if (ips.includes(ip)) myReactions.push(emoji)
    }
  }
  return { reactions, myReactions }
}
