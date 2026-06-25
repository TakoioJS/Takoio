<template>
  <div class="tk-avatar" :class="sizeClass">
    <img v-if="avatar" :src="avatar" :alt="user.nick" />
    <span v-else class="tk-avatar-fallback">
      {{ initials }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Comment } from '../../types'

interface Props {
  user: Comment
  size?: 'sm' | 'md' | 'lg'
  gravatarUrl?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  gravatarUrl: 'https://weavatar.com/avatar/',
})

const sizeClass = computed(() => `tk-avatar-${props.size}`)

const gurl = computed(() => props.gravatarUrl.replace(/\/+$/, '') + '/')

const avatar = computed(() => {
  if (props.user.avatar) return props.user.avatar
  if (props.user.mailMd5) return `${gurl.value}${props.user.mailMd5}?d=identicon&s=80`
  return null
})

const initials = computed(() => {
  const nick = props.user.nick || '?'
  return nick.charAt(0).toUpperCase()
})
</script>

<style scoped>
.tk-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  overflow: hidden;
  background: #f8fafc;
  border: 2px solid var(--tk-admin-border);
  box-shadow: none;
  flex-shrink: 0;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.tk-avatar:hover {
  transform: scale(1.05);
  border-color: var(--tk-brand);
}

.tk-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.tk-avatar-fallback {
  font-weight: 600;
  color: var(--tk-brand);
}

.tk-avatar-sm {
  width: 32px;
  height: 32px;
  font-size: 12px;
}

.tk-avatar-md {
  width: 40px;
  height: 40px;
  font-size: 16px;
}

.tk-avatar-lg {
  width: 64px;
  height: 64px;
  font-size: 24px;
}
</style>
