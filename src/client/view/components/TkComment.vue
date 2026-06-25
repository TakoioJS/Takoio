<template>
  <div class="tk-comment" :class="{ 'tk-comment-reply': isReply }">
    <TkAvatar :user="comment" :gravatar-url="options.GRAVATAR_URL" />

    <div class="tk-comment-body">
      <div class="tk-comment-header">
        <div class="tk-comment-left">
          <span class="tk-nick" :class="{ 'tk-master': isMaster, 'tk-admin': isAdmin }">
            <a v-if="comment.link" :href="comment.link" target="_blank" rel="noopener noreferrer">
              {{ comment.nick }}
            </a>
            <span v-else>{{ comment.nick }}</span>
            <span v-if="isMaster" class="tk-tag tk-tag-warning" :style="options.MASTER_LABEL_COLOR ? { background: options.MASTER_LABEL_COLOR, borderColor: 'transparent', color: '#fff' } : {}">
              {{ options.MASTER_LABEL || t('master') }}
            </span>
            <span v-else-if="isAdmin" class="tk-tag tk-tag-success">{{ t('admin') }}</span>
            <span v-if="comment.isTop" class="tk-tag tk-tag-danger">{{ t('pinned') }}</span>
            <span v-if="comment.state === 'pending' || comment.state === 'spam'" class="tk-tag tk-tag-info">{{ t('pendingReview') }}</span>
          </span>
          <span class="tk-time">{{ comment.relativeTime || timeago(comment.created) }}</span>
        </div>

        <div class="tk-comment-actions">
          <template v-if="options.enableLike !== false">
            <button :class="['tk-btn-icon', { 'tk-liked': liked }]" @click="onLike" :title="t('like')">
              <ThumbsUp :size="14" /><span v-if="comment.like > 0">{{ comment.like }}</span>
            </button>
          </template>
          <template v-if="options.enableDislike !== false">
            <button :class="['tk-btn-icon', { 'tk-disliked': disliked }]" @click="onDislike" :title="t('dislike')">
              <ThumbsDown :size="14" /><span v-if="(comment.dislike || 0) > 0">{{ comment.dislike || 0 }}</span>
            </button>
          </template>
          <button class="tk-btn-icon" @click="$emit('reply', comment)" :title="t('reply')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
          </button>
        </div>
      </div>

      <div class="tk-comment-content">
        <div v-if="comment.state === 'pending' || comment.state === 'spam'" class="tk-pending-notice">
          {{ t('reviewingNotice') }}
        </div>
        <div v-else @error.capture="onImageError($event)">
          <span v-if="comment.replyToNick" class="tk-reply-at">@{{ comment.replyToNick }} </span>
          <span v-html="renderedContent" />
        </div>
      </div>

      <div v-if="comment.image" class="tk-comment-image">
        <img :src="comment.image" :alt="t('image')" @error="onImageError($event)" />
      </div>

      <div v-if="(options._showUaInfo !== false && comment.ua) || (options._showIpRegion !== false && comment.ipRegion)" class="tk-comment-meta">
        <span v-if="options._showIpRegion !== false && comment.ipRegion" class="tk-meta-item">
          <Icon icon="jam:gps-f" width="12" style="margin-right: 2px;" />{{ displayIpRegion }}
        </span>
        <span v-if="options._showUaInfo !== false && comment.ua" class="tk-meta-item">
          <TkUa :ua="comment.ua" />
        </span>
      </div>

      <div v-if="comment.children && comment.children.length > 0" class="tk-replies">
        <TkComment
          v-for="child in comment.children"
          :key="child.id"
          :comment="child"
          :options="options"
          :is-reply="true"
          @reply="$emit('reply', $event)"
          @liked="$emit('liked')"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ThumbsUp, ThumbsDown } from 'lucide-vue-next'
import { Icon } from '@iconify/vue'
import { timeago, t } from '../../utils'
import { likeComment, dislikeComment } from '../../utils/api'
import { renderMarkdown } from '../../utils/marked'
import { renderLinks, renderMath, toast } from '../../utils'
import type { Comment, TakoioConfig } from '../../types'
import TkAvatar from './TkAvatar.vue'
import TkUa from './TkUa.vue'

interface Props {
  comment: Comment
  options: TakoioConfig
  isReply?: boolean
}

const props = withDefaults(defineProps<Props>(), { isReply: false })
const emit = defineEmits<{ (e: 'reply', comment: Comment): void; (e: 'liked'): void }>()

const renderedContent = ref('')
const liked = ref(false)
const disliked = ref(false)

const onImageError = (e: Event) => {
  const img = e.target as HTMLImageElement
  if (!img || img.tagName !== 'IMG') return
  const p = document.createElement('span')
  p.className = 'tk-img-broken'
  p.textContent = `[${t('imageLoadFailed')}]`
  img.replaceWith(p)
}

const isMaster = computed(() => props.comment.isMaster === true)
const isAdmin = computed(() => props.comment.isAdmin === true)

const displayIpRegion = computed(() => {
  const reg = props.comment.ipRegion
  if (!reg) return ''
  const parts = reg.split(' ').filter(p => p && p !== '0')
  if (parts.length === 0) return ''
  if (props.options._showIpRegion === 'city') {
    if (parts.length >= 3) {
      const cityParts = parts.slice(1, parts.length - 1)
      return Array.from(new Set(cityParts)).join(' ') || parts[parts.length - 2]
    }
    if (parts.length === 2) return parts[1]
  }
  return parts.join(' ')
})

const renderContent = async (): Promise<void> => {
  if (props.comment.renderedComment) { renderedContent.value = props.comment.renderedComment; return }
  const html = await renderMarkdown(props.comment.comment || '')
  renderedContent.value = html
  setTimeout(async () => {
    const el = document.querySelector(`.tk-comment[data-id="${props.comment.id}"] .tk-comment-content`)
    if (el) { renderLinks(el as Element); await renderMath(el as HTMLElement, props.options.katex) }
  }, 0)
}

const onLike = async (): Promise<void> => {
  if (liked.value) return
  try { await likeComment(props.options.envId, props.comment.id); liked.value = true; props.comment.like += 1; emit('liked') }
  catch { toast(t('submitFailed')) }
}

const onDislike = async (): Promise<void> => {
  if (disliked.value) return
  try { await dislikeComment(props.options.envId, props.comment.id); disliked.value = true; props.comment.dislike = (props.comment.dislike || 0) + 1 }
  catch { toast(t('submitFailed')) }
}

onMounted(() => { renderContent() })
</script>

<style scoped>
.tk-comment { display: flex; gap: 14px; padding: 16px; }
.tk-comment-reply { margin-top: 6px; margin-left: 24px; padding-left: 12px; border-left: 1px solid rgba(128,128,128,0.2); border-radius: 0; position: relative; }
.tk-comment-reply::before { content: ''; position: absolute; left: -1px; top: 0; bottom: 0; width: 1px; background: rgba(128,128,128,0.12); }
.tk-replies .tk-comment-reply { margin-left: 16px; padding-left: 8px; }
.tk-replies .tk-replies .tk-comment-reply { margin-left: 12px; padding-left: 6px; }
.tk-replies .tk-replies .tk-comment:hover { background: transparent; }
.tk-replies .tk-replies .tk-comment-reply .tk-comment-body { font-size: 13px; opacity: 0.92; }
.tk-comment-body { flex: 1; min-width: 0; }
.tk-comment-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }
.tk-comment-left { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.tk-nick { font-weight: 600; font-size: 14px; color: inherit; }
.tk-nick a { color: inherit; text-decoration: none; }
.tk-nick a:hover { text-decoration: underline; }
.tk-nick.tk-master { color: #d97706; }
.tk-nick.tk-admin { color: #059669; }
.tk-tag { display: inline-flex; align-items: center; font-size: 11px; font-weight: 600; padding: 1px 6px; border-radius: 4px; border: 1px solid; margin-left: 4px; line-height: 1.6; }
.tk-tag-warning { background: #fef3c7; color: #92400e; border-color: #fde68a; }
.tk-tag-success { background: #d1fae5; color: #065f46; border-color: #a7f3d0; }
.tk-tag-danger { background: #fee2e2; color: #991b1b; border-color: #fecaca; }
.tk-tag-info { background: #e0f2fe; color: #075985; border-color: #bae6fd; }
.tk-time { font-size: 12px; color: inherit; opacity: .6; }
.tk-comment-actions { display: flex; align-items: center; gap: 2px; flex-shrink: 0; }
.tk-btn-icon { display: inline-flex; align-items: center; gap: 3px; background: none; border: none; cursor: pointer; font-size: 13px; padding: 2px 6px; color: inherit; opacity: .6; transition: all .15s; border-radius: 4px; font-family: inherit; }
.tk-btn-icon:hover { opacity: 1; background: rgba(128,128,128,0.06); }
.tk-btn-icon.tk-liked { color: var(--tk-brand); opacity: 1; font-weight: 600; }
.tk-btn-icon.tk-disliked { color: #dc2626; opacity: 1; }
.tk-comment-content { word-break: break-word; line-height: 1.7; font-size: 14px; color: inherit; }
.tk-reply-at { color: var(--tk-brand); font-weight: 500; margin-right: 4px; }
.tk-pending-notice { padding: 8px 12px; background: rgba(128,128,128,0.06); border-radius: 4px; font-size: 13px; color: #d97706; }
.tk-comment-content :deep(p) { margin: 4px 0; display: inline; }
.tk-comment-content :deep(blockquote) { border-left: 3px solid var(--tk-brand); padding: 4px 10px; margin: 8px 0; color: inherit; opacity: .7; }
.tk-comment-content :deep(code) { font-size: .88em; padding: 2px 5px; border-radius: 4px; }
.tk-comment-content :deep(pre) { margin: 8px 0; }
.tk-comment-image { margin-top: 8px; }
.tk-comment-image img { max-width: 200px; max-height: 200px; border-radius: 8px; }
.tk-img-broken { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; font-size: 12px; color: #999; background: rgba(128,128,128,0.08); border-radius: 4px; border: 1px dashed rgba(128,128,128,0.2); }
.tk-comment-meta { margin-top: 6px; display: flex; align-items: center; gap: 12px; font-size: 11px; color: inherit; opacity: .5; line-height: 1; }
.tk-meta-item { display: inline-flex; align-items: center; gap: 4px; }
.tk-replies { margin-top: 8px; }
@media (max-width: 640px) {
  .tk-comment { padding: 12px 10px; gap: 8px; }
  .tk-comment-body { overflow: hidden; }
  .tk-comment-reply { margin-left: 12px; padding-left: 8px; }
  .tk-replies .tk-comment-reply { margin-left: 8px; }
  .tk-replies .tk-replies .tk-comment-reply { margin-left: 6px; padding-left: 4px; }
}
</style>