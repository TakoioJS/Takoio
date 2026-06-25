<template>
  <div class="tk-comments">
    <TkSubmit
      :options="options"
      :site-config="siteConfig"
      :reply-to="replyTarget"
      @posted="onPosted"
      @clear-reply="replyTarget = null"
      @admin="$emit('admin')"
    />

    <div class="tk-comments-header">
      <div class="tk-comments-count">
        <span class="tk-count-text"><strong>{{ total }}</strong> {{ countLabel }}</span>
        <button class="tk-refresh-btn" title="刷新" @click="fetchComments">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        </button>
      </div>
      <div class="tk-sort" role="tablist">
        <button v-for="opt in sortOptions" :key="opt.value" :class="['tk-sort-btn', { active: sort === opt.value }]" role="tab" :aria-pressed="sort === opt.value" @click="sort = opt.value">{{ opt.label }}</button>
      </div>
    </div>

    <div v-if="loading" class="tk-loading-skeleton">
      <div class="tk-skeleton"><div class="tk-skeleton-line" style="width:60%"></div><div class="tk-skeleton-line" style="width:90%"></div><div class="tk-skeleton-line" style="width:40%"></div></div>
      <div class="tk-skeleton" style="margin-top:16px"><div class="tk-skeleton-line" style="width:70%"></div><div class="tk-skeleton-line" style="width:85%"></div><div class="tk-skeleton-line" style="width:50%"></div></div>
      <div class="tk-skeleton" style="margin-top:16px"><div class="tk-skeleton-line" style="width:55%"></div><div class="tk-skeleton-line" style="width:80%"></div><div class="tk-skeleton-line" style="width:45%"></div></div>
    </div>

    <div v-else-if="errorMsg" class="tk-error-msg">{{ errorMsg }}</div>
    <div v-else-if="comments.length === 0" class="tk-empty">{{ t('noComment') }}</div>

    <div v-else class="tk-comments-list">
      <TransitionGroup name="tk-comment-list">
        <TkComment v-for="comment in comments" :key="comment.id" :comment="comment" :options="options" @reply="onReplyClick" @liked="onLiked" />
      </TransitionGroup>
    </div>

    <div v-if="infiniteMode && hasMore" ref="sentinelRef" class="tk-infinite-sentinel">
      <span v-if="loadingMore" class="tk-loading">{{ t('loading') }}</span>
      <span v-else class="tk-load-more" @click="loadMore">{{ t('loadMore') }}</span>
    </div>

    <TkPagination v-if="!infiniteMode && total > pageSize" :current="page" :total="total" :page-size="pageSize" @change="onPageChange" />
    <TkFooter :options="options" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, computed, onBeforeUnmount } from 'vue'
import { t, getComments, getCommentsCountApi } from '../../utils'
import type { Comment, TakoioConfig } from '../../types'
import TkSubmit from './TkSubmit.vue'
import TkComment from './TkComment.vue'
import TkFooter from './TkFooter.vue'
import TkPagination from './TkPagination.vue'

interface Props { options: TakoioConfig }
const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'admin'): void; (e: 'comment-posted', comment: Comment): void }>()

const comments = ref<Comment[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = computed(() => props.options.pageSize || 10)
const siteConfig = ref<Record<string, any>>({})
const sort = ref<'newest' | 'oldest' | 'hottest'>(props.options.sort || 'newest')
const loading = ref(false)
const replyTarget = ref<Comment | null>(null)
const errorMsg = ref('')
const loadingMore = ref(false)
const allComments = ref<Comment[]>([])
const sentinelRef = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

const infiniteMode = computed(() => props.options.paginationMode === 'infinite')
const hasMore = computed(() => allComments.value.length < total.value)

const setBrandColor = (color: string): void => {
  if (!color) return
  const root = document.querySelector('.tk-root') as HTMLElement
  if (!root) return
  const hex = color.replace('#', '')
  const m = hex.match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (!m) return
  const [r, g, b] = [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]
  root.style.setProperty('--tk-brand', color)
  root.style.setProperty('--tk-brand-hover', `rgb(${Math.round(r * 0.9)}, ${Math.round(g * 0.9)}, ${Math.round(b * 0.9)})`)
  root.style.setProperty('--tk-brand-light', `rgba(${r}, ${g}, ${b}, 0.1)`)
  root.style.setProperty('--tk-brand-ring', `rgba(${r}, ${g}, ${b}, 0.4)`)
}

const loadMore = async (): Promise<void> => {
  if (loadingMore.value || !hasMore.value) return
  loadingMore.value = true; page.value += 1
  try {
    const result = await getComments(props.options.envId, { url: props.options.path || (typeof window !== 'undefined' ? window.location.pathname : '/'), page: page.value, pageSize: pageSize.value, sort: sort.value })
    const newComments = result.data || []
    for (const c of newComments) if (c.children?.length) for (const child of c.children) if (child.rid && child.rid !== child.pid) { const t = c.children.find((x: Comment) => x.id === child.rid); if (t) child.replyToNick = t.nick }
    allComments.value = [...allComments.value, ...newComments]; comments.value = allComments.value
    if (result.total !== undefined) total.value = result.total
  } catch { page.value -= 1 } finally { loadingMore.value = false }
}

const countLabel = computed(() => total.value === 0 || total.value > 1 ? t('comment') : t('commentOne'))
const sortOptions = [
  { value: 'newest' as const, label: t('sortNewest') },
  { value: 'oldest' as const, label: t('sortOldest') },
  { value: 'hottest' as const, label: t('sortHottest') }
]

const fetchComments = async (): Promise<void> => {
  loading.value = true; errorMsg.value = ''
  try {
    const result = await getComments(props.options.envId, { url: props.options.path || (typeof window !== 'undefined' ? window.location.pathname : '/'), page: page.value, pageSize: pageSize.value, sort: sort.value })
    const fetched = result.data || []
    for (const c of fetched) if (c.children?.length) for (const child of c.children) if (child.rid && child.rid !== child.pid) { const t = c.children.find((x: Comment) => x.id === child.rid); if (t) child.replyToNick = t.nick }
    if (infiniteMode.value) allComments.value = fetched
    comments.value = fetched; total.value = result.total || 0
    const cfg = result.config
    if (cfg) {
      siteConfig.value = cfg
      if (cfg.ENABLE_LIKE !== undefined) props.options.enableLike = cfg.ENABLE_LIKE
      if (cfg.ENABLE_DISLIKE !== undefined) props.options.enableDislike = cfg.ENABLE_DISLIKE
      if (cfg.ENABLE_EMOTION !== undefined) props.options.enableEmotion = cfg.ENABLE_EMOTION
      if (cfg.ENABLE_LINK_INPUT !== undefined) props.options.enableLinkInput = cfg.ENABLE_LINK_INPUT
      if (cfg.COMMENT_LINK_REQUIRED !== undefined) props.options.commentLinkRequired = cfg.COMMENT_LINK_REQUIRED
      if (cfg.ADMIN_KEYWORD !== undefined) props.options.adminKeyword = cfg.ADMIN_KEYWORD
      if (cfg.SHOW_IP_REGION !== undefined) props.options._showIpRegion = cfg.SHOW_IP_REGION
      if (cfg.SHOW_UA_INFO !== undefined) props.options._showUaInfo = cfg.SHOW_UA_INFO
      if (cfg.ENABLE_CODE_HIGHLIGHT !== undefined) props.options.enableCodeHighlight = cfg.ENABLE_CODE_HIGHLIGHT
      if (cfg.CODE_HIGHLIGHT_THEME !== undefined) props.options.codeHighlightTheme = cfg.CODE_HIGHLIGHT_THEME
      if (cfg.CODE_SHOW_LANGUAGE !== undefined) props.options.codeShowLanguage = cfg.CODE_SHOW_LANGUAGE
      if (cfg.CODE_SHOW_COPY !== undefined) props.options.codeShowCopy = cfg.CODE_SHOW_COPY
      if (cfg.ENABLE_CAPTCHA !== undefined) props.options.enableCaptcha = cfg.ENABLE_CAPTCHA
      if (cfg.CAPTCHA_PROVIDER !== undefined) props.options.captchaProvider = cfg.CAPTCHA_PROVIDER
      if (cfg.CAPTCHA_TYPE !== undefined) props.options.captchaType = cfg.CAPTCHA_TYPE
      if (cfg.CAPTCHA_SITE_KEY !== undefined) props.options.captchaSiteKey = cfg.CAPTCHA_SITE_KEY
      if (cfg.GLOBAL_COLOR) { props.options.brandColor = cfg.GLOBAL_COLOR; setBrandColor(cfg.GLOBAL_COLOR) }
    }
    if (comments.value.length === 0) props.options.onCommentsEmpty?.()
    else props.options.onCommentsLoaded?.(comments.value)
  } catch (e) {
    loading.value = false; errorMsg.value = (e as Error).message || 'Failed to load comments'
    console.warn('[Takoio Dev]', (e as Error).message); props.options.onError?.(e as Error)
    return
  } finally { loading.value = false }
}

const onPosted = (comment: Comment): void => {
  if (comment.pid) {
    const parent = comments.value.find(c => c.id === comment.pid)
    if (parent) {
      if (!parent.children) parent.children = []
      if (comment.rid && comment.rid !== comment.pid) { const t = parent.children.find(c => c.id === comment.rid); if (t) comment.replyToNick = t.nick }
      parent.children.push(comment); parent.replyCount = parent.children.length
    }
  } else comments.value = [comment, ...comments.value]
  total.value += 1; replyTarget.value = null; emit('comment-posted', comment)
}

const onReplyClick = (comment: Comment): void => { replyTarget.value = comment; document.querySelector('.tk-submit')?.scrollIntoView({ behavior: 'smooth' }) }
const onLiked = (): void => {}
const onPageChange = (newPage: number): void => { page.value = newPage; fetchComments(); document.querySelector('.tk-comments')?.scrollIntoView({ behavior: 'smooth' }) }

watch(sort, () => { page.value = 1; fetchComments() })

const setupInfiniteObserver = (): void => {
  if (!infiniteMode.value || typeof IntersectionObserver === 'undefined') return
  observer?.disconnect()
  observer = new IntersectionObserver((entries) => { if (entries[0]?.isIntersecting && hasMore.value && !loadingMore.value) loadMore() }, { rootMargin: '200px' })
  if (sentinelRef.value) observer.observe(sentinelRef.value)
}
watch(sentinelRef, (el) => { if (el && infiniteMode.value) { if (!observer) setupInfiniteObserver(); else observer.observe(el) } })
onMounted(() => { fetchComments(); if (infiniteMode.value) setupInfiniteObserver() })
onBeforeUnmount(() => { observer?.disconnect() })
</script>

<style scoped>
.tk-comments { max-width: 100%; margin: 0; padding: 0; }
.tk-comments-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; margin-bottom: 12px; }
.tk-comments-count { display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 500; color: inherit; padding: 4px 8px 4px 12px; border-radius: 16px; }
.tk-count-text strong { font-weight: 600; }
.tk-refresh-btn { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: transparent; border: none; cursor: pointer; opacity: 0.5; border-radius: 50%; color: inherit; padding: 0; }
.tk-refresh-btn:hover { opacity: 0.8; }
.tk-sort { display: flex; align-items: center; border-radius: 20px; padding: 3px; gap: 2px; }
.tk-sort-btn { background: transparent; border: none; color: inherit; opacity: 0.6; font-size: 13px; font-weight: 500; cursor: pointer; padding: 4px 14px; border-radius: 18px; transition: all 0.3s; font-family: inherit; }
.tk-sort-btn:hover { opacity: 1; background: rgba(128,128,128,0.04); }
.tk-sort-btn.active { opacity: 1; color: var(--tk-brand); background: rgba(128,128,128,0.06); }
.tk-loading-skeleton { padding: 24px; }
.tk-skeleton { display: flex; flex-direction: column; gap: 12px; padding: 16px; border-radius: 8px; background: rgba(128,128,128,0.03); }
.tk-skeleton-line { height: 14px; border-radius: 4px; background: linear-gradient(90deg, rgba(128,128,128,0.08) 25%, rgba(128,128,128,0.15) 50%, rgba(128,128,128,0.08) 75%); background-size: 200% 100%; animation: tk-shimmer 1.5s infinite; }
@keyframes tk-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
.tk-loading, .tk-empty, .tk-error-msg { text-align: center; padding: 24px 0; color: inherit; opacity: .6; font-size: 14px; }
.tk-infinite-sentinel { text-align: center; padding: 16px 0; }
.tk-load-more { color: var(--tk-brand); cursor: pointer; font-size: 13px; opacity: 0.7; transition: opacity 0.2s; }
.tk-load-more:hover { opacity: 1; }
.tk-comments-list { display: flex; flex-direction: column; gap: 10px; }
.tk-comment-list-enter-active, .tk-comment-list-leave-active { transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1); }
.tk-comment-list-enter-from { opacity: 0; transform: translateY(24px); }
.tk-comment-list-leave-to { opacity: 0; transform: scale(0.96); }
.tk-comment-list-move { transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1); }
</style>