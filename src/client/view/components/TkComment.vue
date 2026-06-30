<template>
  <div
    class="tk-comment"
    :data-id="comment.id"
    :class="{ 'tk-comment-reply': isReply, 'tk-comment-flat': depth >= (options.maxNestDepth ?? 2) }"
  >
    <TkAvatar
      :user="comment"
      :gravatar-url="options.GRAVATAR_URL"
    />

    <div class="tk-comment-body">
      <div class="tk-comment-header">
        <div class="tk-comment-left">
          <span
            class="tk-nick"
            :class="{ 'tk-master': isMaster, 'tk-admin': isAdmin }"
          >
            <a
              v-if="comment.link"
              :href="sanitizeUrl(comment.link)"
              target="_blank"
              rel="noopener noreferrer nofollow ugc"
            >
              {{ comment.nick }}
            </a>
            <span v-else>{{ comment.nick }}</span>
            <span
              v-if="isMaster"
              class="tk-tag tk-tag-warning"
              :style="options.MASTER_LABEL_COLOR ? { background: options.MASTER_LABEL_COLOR, borderColor: 'transparent', color: '#fff' } : {}"
            >
              {{ options.MASTER_LABEL || t('master') }}
            </span>
            <span
              v-else-if="isAdmin"
              class="tk-tag tk-tag-success"
            >{{ t('admin') }}</span>
            <span
              v-if="comment.isTop"
              class="tk-tag tk-tag-danger"
            >{{ t('pinned') }}</span>
            <span
              v-if="comment.state === 'pending' || comment.state === 'spam'"
              class="tk-tag tk-tag-info"
            >{{ t('pendingReview') }}</span>
          </span>
          <span class="tk-time-sep">·</span>
          <span
            class="tk-time"
            :title="comment.created ? formatDate(comment.created) : undefined"
          >{{ comment.relativeTime || timeago(comment.created) }}</span>
        </div>

        <div class="tk-comment-actions">
          <button
            class="tk-btn-icon"
            :title="t('reply')"
            @click="$emit('reply', comment)"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            ><polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" /></svg>
          </button>
        </div>
      </div>

      <div
      ref="contentRef"
      class="tk-comment-content"
    >
        <div
          v-if="comment.state === 'pending' || comment.state === 'spam'"
          class="tk-pending-notice"
        >
          {{ t('reviewingNotice') }}
        </div>
        <div v-else>
          <span
            v-if="comment.replyToNick"
            class="tk-reply-at"
          >@{{ comment.replyToNick }} </span>
          <span v-html="renderedContent" />
        </div>
      </div>

      <div
        v-if="options.enableCommentReaction"
        class="tk-comment-reactions"
      >
        <CommentReactionBar
          :comment-id="comment.id"
          :env-id="options.envId"
        />
      </div>

      <div
        v-if="comment.image"
        class="tk-comment-image"
      >
        <img
          :src="comment.image"
          :alt="t('image')"
          @error="onImageError($event)"
        >
      </div>

      <div
        v-if="(options._showUaInfo && comment.ua) || (options._showIpRegion !== false && comment.ipRegion)"
        class="tk-comment-meta"
      >
        <span
          v-if="options._showIpRegion !== false && comment.ipRegion"
          class="tk-meta-item"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:2px;flex-shrink:0;"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>{{ displayIpRegion }}
        </span>
        <span
          v-if="options._showUaInfo && comment.ua"
          class="tk-meta-item"
        >
          <TkUa :ua="comment.ua" />
        </span>
      </div>

      <div
        v-if="comment.children && comment.children.length > 0"
        class="tk-replies"
      >
        <template v-if="depth >= (options.maxNestDepth ?? 2) && comment.children.length > (options.collapseThreshold ?? 3)">
          <button
            v-if="!showAllReplies"
            class="tk-collapse-btn"
            @click="showAllReplies = true"
          >
            {{ t('showReplies') || `查看 ${comment.children.length} 条回复` }}
          </button>
          <div
            v-if="showAllReplies"
            class="tk-replies"
          >
            <TkComment
              v-for="child in comment.children"
              :key="child.id"
              :comment="child"
              :options="options"
              :is-reply="true"
              :depth="depth + 1"
              @reply="$emit('reply', $event)"
            />
          </div>
        </template>
        <template v-else>
          <TkComment
            v-for="child in comment.children"
            :key="child.id"
              :comment="child"
              :options="options"
              :is-reply="true"
              :depth="depth + 1"
              @reply="$emit('reply', $event)"
            />
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { timeago, t, sanitizeUrl } from '../../utils'
import { renderMarkdown } from '../../utils/marked'
import { renderLinks, renderMath } from '../../utils'
import type { Comment, TakoioConfig } from '../../types'
import TkAvatar from './TkAvatar.vue'
import TkUa from './TkUa.vue'
import CommentReactionBar from './submit/components/CommentReactionBar.vue'

interface Props {
  comment: Comment
  options: TakoioConfig
  isReply?: boolean
  depth?: number
}

const props = withDefaults(defineProps<Props>(), { isReply: false, depth: 0 })
defineEmits<{ (e: 'reply', comment: Comment): void }>()

const renderedContent = ref('')
const contentRef = ref<HTMLElement>()
const showAllReplies = ref(false)

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
  const source = props.comment.renderedComment || props.comment.comment || ''
  const html = await renderMarkdown(source)
  renderedContent.value = html
  await nextTick()
  if (contentRef.value) {
    renderLinks(contentRef.value)
    await renderMath(contentRef.value, props.options.katex)
  }
}
const formatDate = (ts: number): string => {
  if (!ts) return ''
  return new Date(ts).toLocaleString((props.options as any).lang || 'zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

watch(() => [props.comment.renderedComment, props.comment.comment], () => { renderContent() }, { immediate: true })
</script>

<style scoped>
.tk-icon-12 { width: 12px; height: 12px; flex-shrink: 0; display: inline-block; vertical-align: middle; }
.tk-icon-14 { width: 14px; height: 14px; flex-shrink: 0; display: inline-block; vertical-align: middle; }
.tk-comment { display:flex;gap:14px;padding:16px;
  background:transparent;
  border-radius:var(--tk-r-card);
  transition:background .22s cubic-bezier(.22,.61,.36,1);}
@media(hover:hover){.tk-comment:hover{background:var(--tk-bg-subtle);}}
.tk-comment-reply { margin-top: 6px; margin-left: 24px; padding-left: 12px; border-left: 1px solid var(--tk-border); border-radius: 0; position: relative; }
.tk-comment-reply::before { content: ''; position: absolute; left: -1px; top: 0; bottom: 0; width: 1px; background: var(--tk-border-soft); }
.tk-comment-reply{background:transparent!important;border:none!important;box-shadow:none!important;}
.tk-replies .tk-comment-reply { margin-left: 16px; padding-left: 8px; }
.tk-replies .tk-replies .tk-comment-reply { margin-left: 12px; padding-left: 6px; }
.tk-replies .tk-replies .tk-comment:hover { background: var(--tk-bg-subtle); }
.tk-replies .tk-replies .tk-comment-reply .tk-comment-body { font-size: 13px; opacity: 0.92; }
.tk-comment-flat { margin-left: 0 !important; padding-left: 0 !important; border-left: none !important; }
.tk-comment-flat::before { display: none !important; }
.tk-collapse-btn { display: block; margin: 8px 0 4px 24px; padding: 4px 12px; background: none; border: none; color: var(--tk-brand); font-size: 13px; cursor: pointer; font-family: inherit; opacity: .7; }
.tk-collapse-btn:hover { opacity: 1; text-decoration: underline; }
.tk-comment-body { flex: 1; min-width: 0; }
.tk-comment-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }
.tk-comment-left { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.tk-nick { font-weight: 600; font-size: 14px; color: inherit; }
.tk-nick a { color: inherit; text-decoration: none; }
.tk-nick a:hover { text-decoration: underline; }
.tk-nick.tk-master { color:var(--tk-warning); }
.tk-nick.tk-admin { color:var(--tk-success); }
.tk-tag{display:inline-flex;align-items:center;font-size:11px;font-weight:600;
  padding:1px 8px;border-radius:var(--tk-r-pill);border:none;line-height:1.6;margin-left:4px;}
.tk-tag-warning{background:var(--tk-tag-warning-bg,color-mix(in srgb,var(--tk-warning) 14%,transparent));color:var(--tk-tag-warning-fg,var(--tk-warning));}
.tk-tag-success{background:var(--tk-tag-success-bg,color-mix(in srgb,var(--tk-success) 14%,transparent));color:var(--tk-tag-success-fg,var(--tk-success));}
.tk-tag-danger{background:var(--tk-tag-danger-bg,color-mix(in srgb,var(--tk-danger) 14%,transparent));color:var(--tk-tag-danger-fg,var(--tk-danger));}
.tk-tag-info{background:var(--tk-tag-info-bg,color-mix(in srgb,var(--tk-info) 16%,transparent));color:var(--tk-tag-info-fg,var(--tk-text-2));}
.tk-time { font-size: 12px; color: inherit; opacity: .5; }
.tk-comment-actions { display: flex; align-items: center; gap: 2px; flex-shrink: 0; }
.tk-btn-icon { display: inline-flex; align-items: center; gap: 3px; background: none; border: none; cursor: pointer; font-size: 13px; padding: 2px 6px; color: inherit; opacity: .55; transition: all .15s; border-radius: var(--tk-r-input); font-family: inherit; }
.tk-btn-icon:disabled { pointer-events: none; }
.tk-btn-icon:hover { opacity: 1; background: var(--tk-bg-muted); }
.tk-btn-icon.tk-liked { color: var(--tk-brand); opacity: 1; font-weight: 600; }
.tk-btn-icon.tk-disliked { color: var(--tk-danger); opacity: 1; }
.tk-comment-content { word-break: break-word; line-height: 1.75; font-size: var(--tk-fs-base); color: inherit; }
.tk-time-sep { margin: 0 4px; opacity: .35; }
.tk-reply-at { color: var(--tk-brand); font-weight: 500; margin-right: 4px; }
.tk-pending-notice { padding: 8px 12px; background: var(--tk-bg-muted); border-radius: var(--tk-r-input); font-size: 13px; color: var(--tk-warning); }
.tk-comment-content :deep(p) { margin: 4px 0; }
.tk-comment-content :deep(blockquote) { border-left: 3px solid var(--tk-brand-light); padding: 4px 10px; margin: 8px 0; color: inherit; opacity: .7; }
.tk-comment-content :deep(code) { font-size: .88em; padding: 2px 5px; border-radius: 4px; }
.tk-comment-content :deep(pre) { margin: 8px 0; }
.tk-comment-image { margin-top: 8px; }
.tk-comment-image img { max-width: 360px; max-height: 360px; border-radius: var(--tk-r-card); box-shadow: var(--tk-shadow-paper); }
.tk-img-broken { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; font-size: 12px; color: var(--tk-text-3); background: var(--tk-bg-muted); border-radius: var(--tk-r-input); border: 1px dashed var(--tk-border); }
.tk-comment-content :deep(.tk-owo-emotion) { height: 1.5em; width: 1.5em; vertical-align: middle; display: inline-block; margin: 0 3px; object-fit: contain; }
.tk-comment-content :deep(.tk-comment-inline-image) { max-width: 100%; max-height: 300px; border-radius: var(--tk-r-card); display: block; margin: 8px 0; }
.tk-comment-reactions { margin-top: 6px; }
.tk-comment-meta { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--tk-border-soft); display: flex; align-items: center; gap: 14px; font-size: 11px; color: var(--tk-text-3); line-height: 1; }
.tk-meta-item { display: inline-flex; align-items: center; gap: 3px; }
.tk-replies { margin-top: 8px; }
@media (max-width: 640px) {
  .tk-comment { padding: 12px 10px; gap: 8px; }
  .tk-comment-body { overflow: hidden; }
  .tk-comment-reply { margin-left: 12px; padding-left: 8px; }
  .tk-replies .tk-comment-reply { margin-left: 8px; }
  .tk-replies .tk-replies .tk-comment-reply { margin-left: 6px; padding-left: 4px; }
}
</style>
