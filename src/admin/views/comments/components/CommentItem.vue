<template>
  <div
    :class="['comment-item', { selected }]"
  >
    <n-checkbox
      :checked="selected"
      size="small"
      class="comment-check"
      @update:checked="$emit('select', comment)"
    />
    <div class="avatar-wrap">
      <img
        :src="getAvatar(comment)"
        class="comment-avatar"
        :alt="comment.nick"
        @error="onImgError"
      >
      <span
        :class="['status-dot', stateClass(comment)]"
        :title="stateLabel(comment)"
      />
    </div>

    <div class="comment-body">
      <!-- 头部：昵称 + 状态标签 + 时间 -->
      <div class="comment-head">
        <div class="head-left">
          <span class="comment-name">{{ comment.nick }}</span>
          <div class="status-tags">
            <n-tag
              v-if="comment.isMaster"
              size="tiny"
              type="success"
              round
            >
              博主
            </n-tag>
            <n-tag
              v-if="comment.isTop"
              size="tiny"
              type="warning"
              round
            >
              置顶
            </n-tag>
            <n-tag
              v-if="comment.state === 'pending'"
              size="tiny"
              type="default"
              round
            >
              待审
            </n-tag>
            <n-tag
              v-else-if="comment.state === 'hidden'"
              size="tiny"
              type="warning"
              round
            >
              隐藏
            </n-tag>
            <n-tag
              v-else-if="comment.isSpam"
              size="tiny"
              type="error"
              round
            >
              垃圾
            </n-tag>
          </div>
        </div>
        <span class="comment-time">{{ formatTime(comment.created) }}</span>
      </div>

      <!-- 联系方式行 -->
      <div
        v-if="comment.mail || comment.link"
        class="comment-contact"
      >
        <span
          v-if="comment.mail"
          class="contact-item"
        >
          <n-icon size="11"><MailOutline /></n-icon>
          <span class="contact-text">{{ comment.mail }}</span>
        </span>
        <a
          v-if="comment.link"
          :href="comment.link"
          target="_blank"
          rel="noopener noreferrer nofollow"
          class="contact-item contact-link"
          :title="comment.link"
        >
          <n-icon size="11"><LinkOutline /></n-icon>
          <span class="contact-text">{{ comment.link }}</span>
        </a>
      </div>

      <!-- 原文链接 -->
      <div
        v-if="comment.url || comment.href"
        class="comment-source"
      >
        <n-icon size="11">
          <DocumentTextOutline />
        </n-icon>
        <a
          :href="sourceUrl(comment)"
          target="_blank"
          rel="noopener noreferrer"
          class="source-link"
          :title="comment.url"
        >
          {{ comment.url }}
        </a>
      </div>

      <!-- 评论内容 -->
      <div
        class="comment-content"
        v-html="comment._safeContent || ''"
      />

      <!-- 底部信息行 -->
      <div class="comment-meta">
        <TkUa
          v-if="comment.ua"
          :ua="comment.ua"
          class="meta-ua"
        />
        <span
          v-if="comment.ua && (comment.ipRegion || isValidIp(comment.ip))"
          class="meta-divider"
        >·</span>
        <span
          v-if="comment.ipRegion"
          class="meta-item"
        >
          <n-tag
            size="tiny"
            type="success"
            round
          >{{ comment.ipRegion }}</n-tag>
        </span>
        <span
          v-if="isValidIp(comment.ip)"
          class="meta-item"
        >
          <n-tag
            size="tiny"
            round
          >{{ comment.ip }}</n-tag>
        </span>
        <n-button
          v-if="!comment.ipRegion && isValidIp(comment.ip)"
          size="tiny"
          quaternary
          circle
          title="解析IP归属地"
          @click="$emit('refreshRegion', comment)"
        >
          <template #icon>
            <n-icon size="12">
              <RefreshCircleOutline />
            </n-icon>
          </template>
        </n-button>
      </div>

      <!-- 操作栏 -->
      <div class="comment-actions">
        <!-- 桌面端：高频操作直接露出 -->
        <span class="action-primary">
          <n-button
            v-if="comment.state === 'pending'"
            size="tiny"
            type="success"
            secondary
            @click="$emit('approve', comment)"
          >
            通过
          </n-button>
          <n-button
            size="tiny"
            type="primary"
            secondary
            @click="$emit('reply', comment)"
          >
            回复
          </n-button>
          <n-button
            size="tiny"
            secondary
            @click="$emit('edit', comment)"
          >
            编辑
          </n-button>
          <n-button
            size="tiny"
            type="error"
            secondary
            @click="$emit('delete', comment)"
          >
            删除
          </n-button>
        </span>
        <!-- 更多操作下拉 -->
        <n-dropdown
          trigger="click"
          :options="moreActionOptions(comment)"
          size="small"
          @select="(key: string) => $emit('moreAction', { comment, key })"
        >
          <n-button
            size="tiny"
            quaternary
            title="更多操作"
          >
            <template #icon>
              <n-icon size="16">
                <EllipsisHorizontal />
              </n-icon>
            </template>
          </n-button>
        </n-dropdown>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NCheckbox, NTag, NIcon, NButton, NDropdown, NTooltip } from 'naive-ui'
import {
  MailOutline, LinkOutline, DocumentTextOutline, RefreshCircleOutline, EllipsisHorizontal,
} from '@vicons/ionicons5'
import TkUa from '@shared/view/components/TkUa.vue'
import type { Comment } from '@shared/types'

defineProps<{
  comment: Comment
  selected: boolean
}>()

defineEmits<{
  select: [item: Comment]
  approve: [item: Comment]
  reply: [item: Comment]
  edit: [item: Comment]
  delete: [item: Comment]
  refreshRegion: [item: Comment]
  moreAction: [{ comment: Comment; key: string }]
}>()

const getAvatar = (item: Comment): string => {
  const base = 'https://weavatar.com/avatar/'
  const hash = item.mailMd5 || encodeURIComponent(item.nick || '?')
  return `${base}${hash}?d=identicon&s=40`
}

const stateClass = (row: Comment): string => {
  if (row.state === 'hidden') return 'dot-hidden'
  if (row.state === 'spam' || row.isSpam) return 'dot-spam'
  if (row.state === 'pending') return 'dot-pending'
  return 'dot-ok'
}

const stateLabel = (row: Comment): string => {
  if (row.state === 'pending') return '待审核'
  if (row.state === 'hidden') return '已隐藏'
  if (row.state === 'spam' || row.isSpam) return '垃圾'
  return '可见'
}

const sourceUrl = (item: Comment): string => {
  return item.href || item.url || '#'
}

const isValidIp = (ip: string | undefined | null): boolean => {
  if (!ip || typeof ip !== 'string') return false
  const trimmed = ip.trim()
  if (!trimmed) return false
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(trimmed)) {
    return trimmed.split('.').every(n => {
      const num = Number(n)
      return num >= 0 && num <= 255
    })
  }
  return /^[0-9a-fA-F:]+$/.test(trimmed) && trimmed.includes(':')
}

const formatTime = (ts: number): string => {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const onImgError = (e: Event) => { (e.target as HTMLElement).style.display = 'none' }

const moreActionOptions = (item: Comment) => {
  const opts: { label: string; key: string }[] = []
  if (item.state === 'pending') opts.push({ label: '通过', key: 'approve' })
  opts.push({ label: item.isTop ? '取消置顶' : '置顶', key: 'top' })
  opts.push({ label: item.state === 'hidden' ? '显示' : '隐藏', key: 'hide' })
  opts.push({ label: item.isSpam ? '取消垃圾' : '标垃圾', key: 'spam' })
  return opts
}
</script>

<style scoped>
.comment-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--edge-soft);
  transition: background 0.2s cubic-bezier(.22,.61,.36,1);
}
.comment-item:last-child { border-bottom: none; }
.comment-item:hover { background: var(--edge-soft); }
.comment-item.selected { background: var(--accent-soft); }
.comment-check { margin-top: 6px; flex-shrink: 0; }
.avatar-wrap {
  position: relative;
  flex-shrink: 0;
  margin-top: 2px;
}
.comment-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: block;
  background: var(--edge-soft);
}
.status-dot {
  position: absolute;
  right: -1px;
  bottom: -1px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid var(--paper);
  box-sizing: content-box;
}
.dot-ok { background: var(--accent); }
.dot-hidden { background: var(--warning); }
.dot-spam { background: var(--danger); }
.dot-pending { background: var(--ink-3); }
.comment-body { flex: 1; min-width: 0; }
.comment-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}
.head-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.comment-name { font-weight: 600; font-size: var(--fs-base); color: var(--ink); }
.status-tags { display: flex; gap: 4px; flex-wrap: wrap; }
.comment-time { font-size: 11px; color: var(--ink-3); white-space: nowrap; flex-shrink: 0; }
.comment-contact {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}
.contact-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--fs-sm);
  color: var(--ink-3);
  min-width: 0;
}
.contact-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 220px;
}
.contact-link { color: var(--accent); text-decoration: none; }
.contact-link:hover { text-decoration: underline; }
.comment-source {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: var(--fs-sm);
  color: var(--ink-3);
  margin-bottom: 6px;
}
.source-link {
  color: var(--accent);
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 400px;
}
.source-link:hover { text-decoration: underline; }
.comment-content {
  font-size: 13px;
  color: var(--ink-2);
  line-height: 1.6;
  word-break: break-word;
  margin: 2px 0 8px;
}
.comment-content :deep(p) { margin: 0; display: inline; }
.comment-content :deep(img) { max-height: 32px; vertical-align: middle; border-radius: 2px; }
.comment-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 11px;
  color: var(--ink-3);
  margin-bottom: 8px;
}
.meta-item { display: inline-flex; gap: 4px; align-items: center; }
.meta-ua { font-size: 11px; color: var(--ink-3); }
.meta-divider { color: var(--edge); font-size: 10px; }
.comment-actions {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
  padding-top: 8px;
  border-top: 1px dashed var(--edge-soft);
}
.action-primary { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
@media (max-width: 768px) {
  .comment-item { padding: 12px 12px; gap: 10px; }
  .comment-avatar { width: 32px; height: 32px; }
  .source-link, .contact-text { max-width: 160px; }
  .comment-head { flex-wrap: wrap; }
  .comment-actions { gap: 4px; }
  .action-primary :deep(.n-button) { padding: 0 8px; font-size: 12px; }
}
@media (max-width: 480px) {
  .comment-item { padding: 10px 10px; gap: 8px; }
  .comment-avatar { width: 30px; height: 30px; }
  .comment-content { font-size: var(--fs-base); }
  .comment-actions { gap: 4px; }
  .comment-actions :deep(.n-button) { padding: 0 6px; font-size: 12px; }
}
</style>