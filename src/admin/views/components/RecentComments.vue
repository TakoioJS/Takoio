<template>
  <div class="panel-card recent-card">
    <div class="card-header">
      <span class="card-title">最近评论</span>
      <router-link to="/comments" class="view-all-link">
        查看全部
        <n-icon size="14"><ArrowForwardOutline /></n-icon>
      </router-link>
    </div>
    <div class="card-body">
      <n-spin :show="loading">
        <n-skeleton v-if="loading && !comments.length" :repeat="6" text style="margin-bottom: 12px" />
        <div v-else-if="loadError" class="error-state">
          <n-icon size="36" :depth="3"><AlertCircleOutline /></n-icon>
          <p>加载失败</p>
          <n-button size="small" secondary @click="$emit('retry')">重试</n-button>
        </div>
        <div v-else-if="comments.length === 0" class="empty-state">
          <n-icon size="40" :depth="3"><ChatbubblesOutline /></n-icon>
          <p>暂无评论</p>
        </div>
        <div v-else class="recent-grid">
          <router-link
            v-for="c in comments"
            :key="c.id"
            :to="`/comments?filter=all`"
            class="recent-item"
          >
            <div class="recent-header">
              <div class="avatar-wrap" :style="{ background: avatarColor(c.nick) }">
                <img v-if="!c._avatarError" :src="getAvatar(c)" class="recent-avatar" :alt="c.nick ? `${c.nick} 的头像` : '用户头像'" @error="c._avatarError = true">
                <span v-else class="avatar-letter">{{ (c.nick || '?').slice(0, 1).toUpperCase() }}</span>
              </div>
              <div class="recent-body">
                <div class="recent-meta">
                  <span class="recent-name">{{ c.nick || '匿名' }}</span>
                  <n-tag v-if="c.isTop" size="tiny" type="warning" round>置顶</n-tag>
                  <n-tag v-if="c.state === 'pending'" size="tiny" type="default" round>待审</n-tag>
                  <n-tag v-else-if="c.state === 'hidden'" size="tiny" type="warning" round>隐藏</n-tag>
                  <n-tag v-else-if="c.isSpam" size="tiny" type="error" round>垃圾</n-tag>
                  <span class="recent-time">{{ formatTime(c.created) }}</span>
                </div>
                <a v-if="c.url || c.href" :href="c.href || c.url" target="_blank" rel="noopener" class="recent-link" :title="c.href || c.url" @click.stop>
                  <n-icon size="12"><LinkOutline /></n-icon>
                  <span>{{ c.url || c.href }}</span>
                </a>
                <div class="recent-content" v-html="c._safeContent || ''" />
              </div>
              <n-icon size="16" class="recent-arrow" :depth="3"><ChevronForwardOutline /></n-icon>
            </div>
          </router-link>
        </div>
      </n-spin>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NButton, NIcon, NTag, NSpin, NSkeleton } from 'naive-ui'
import {
  ChatbubblesOutline, ArrowForwardOutline, LinkOutline, AlertCircleOutline, ChevronForwardOutline,
} from '@vicons/ionicons5'
import type { Comment } from '@shared/types'

defineProps<{
  comments: (Comment & { _avatarError?: boolean })[]
  loading: boolean
  loadError: boolean
}>()

defineEmits<{
  retry: []
}>()

const formatTime = (ts: number): string => {
  const d = new Date(ts)
  const now = Date.now()
  const diff = now - ts
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const getAvatar = (item: Comment): string => {
  const base = 'https://weavatar.com/avatar/'
  const hash = item.mailMd5 || encodeURIComponent(item.nick || '?')
  return `${base}${hash}?d=identicon&s=40`
}

const avatarColor = (nick: string): string => {
  const colors = ['#5E8C6A', '#8A7C5E', '#8A5E5E', '#5E6E8A', '#8A5E7C', '#5E8A7C']
  let hash = 0
  for (let i = 0; i < (nick || '?').length; i++) hash = (hash * 31 + nick.charCodeAt(i)) | 0
  return colors[Math.abs(hash) % colors.length]
}
</script>

<style scoped>
.panel-card {
  background: var(--paper);
  border: 1px solid var(--edge-soft);
  border-radius: var(--r-card);
  box-shadow: var(--shadow-paper);
  overflow: hidden;
}
.panel-card .card-header {
  padding: 14px 16px;
  border-bottom: 1px solid var(--edge-soft);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.panel-card .card-body { padding: 4px 16px; }
.card-title { font-size: 14px; font-weight: 600; color: var(--ink); }
.empty-state { text-align: center; padding: 32px 0; color: var(--ink-3); font-size: 13px; }
.empty-state p { margin: 8px 0 0; }
.error-state {
  text-align: center; padding: 32px 0; color: var(--ink-3); font-size: 13px;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
}
.error-state p { margin: 0; }
.view-all-link {
  display: inline-flex; align-items: center; gap: 4px;
  color: var(--accent); font-size: 12px; text-decoration: none; font-weight: 500;
}
.view-all-link:hover { opacity: 0.8; }
.recent-item { padding: 12px 0; text-decoration: none; color: inherit; display: block; }
.recent-item:last-child { border-bottom: none; }
.recent-item:hover .recent-arrow { color: var(--accent); }
.recent-header { display: flex; gap: 10px; }
.avatar-wrap {
  width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; overflow: hidden;
  background: var(--edge-soft);
}
.recent-avatar { width: 100%; height: 100%; border-radius: 50%; display: block; }
.avatar-letter { font-size: 13px; font-weight: 600; color: #fff; }
.recent-body { flex: 1; min-width: 0; }
.recent-meta {
  display: flex; align-items: center; gap: 6px; margin-bottom: 2px; flex-wrap: wrap;
}
.recent-name { font-size: 13px; font-weight: 600; color: var(--ink); }
.recent-time { font-size: 11px; color: var(--ink-3); margin-left: auto; white-space: nowrap; }
.recent-link {
  display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--ink-3);
  margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-decoration: none;
}
.recent-link:hover { color: var(--accent); }
.recent-content {
  font-size: 13px; color: var(--ink-2); line-height: 1.6;
  overflow: hidden; text-overflow: ellipsis;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
}
.recent-content :deep(p) { margin: 0; display: inline; }
.recent-content :deep(img) { max-height: 22px; vertical-align: middle; }
.recent-arrow { flex-shrink: 0; align-self: flex-start; margin-top: 4px; color: var(--ink-4); transition: color 0.2s; }
.recent-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
@media (min-width: 900px) { .recent-grid { grid-template-columns: 1fr 1fr; } }
</style>