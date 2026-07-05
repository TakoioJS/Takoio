<template>
  <div class="tk-comments">
    <TkSubmit
      :options="mergedOptions"
      :site-config="siteConfig"
      :reply-to="replyTarget"
      @posted="onPosted"
      @clear-reply="replyTarget = null"
      @admin="$emit('admin')"
    />

    <div class="tk-comments-header">
      <div class="tk-comments-count">
        <span class="tk-count-text"><strong>{{ total }}</strong> {{ countLabel }}</span>
        <button
          class="tk-refresh-btn"
          :title="t('refreshTip')"
          @click="fetchComments"
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
          ><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
        </button>
      </div>
      <div
        class="tk-sort"
        role="tablist"
      >
        <button
          v-for="opt in sortOptions"
          :key="opt.value"
          :class="['tk-sort-btn', { active: sort === opt.value }]"
          role="tab"
          :aria-pressed="sort === opt.value"
          @click="sort = opt.value"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>

    <div
      v-if="loading"
      class="tk-loading-skeleton"
    >
      <div
        v-for="i in pageSize"
        :key="i"
        class="tk-skeleton"
        :style="i > 1 ? 'margin-top:16px' : undefined"
      >
        <div
          class="tk-skeleton-line"
          :style="{ width: `${40 + Math.random() * 50}%` }"
        /><div
          class="tk-skeleton-line"
          :style="{ width: `${60 + Math.random() * 35}%` }"
        /><div
          class="tk-skeleton-line"
          :style="{ width: `${30 + Math.random() * 40}%` }"
        />
      </div>
    </div>

    <div
      v-else-if="errorMsg"
      class="tk-error-state"
    >
      <i
        class="i-jam-alert tk-icon-32"
        style="color: var(--tk-danger); margin-bottom: 8px;"
      />
      <p>{{ errorMsg }}</p>
      <button
        class="tk-btn-retry"
        @click="fetchComments"
      >
        {{ t('retry') || '重试' }}
      </button>
    </div>
    <div
      v-else-if="comments.length === 0"
      class="tk-empty-state"
    >
      <i
        class="i-jam-comments tk-icon-48"
        style="color: var(--tk-text-3); margin-bottom: 10px;"
      />
      <p style="color: var(--tk-text-3); font-size: 13px;">
        {{ t('noComment') }}
      </p>
    </div>

    <div
      v-else
      class="tk-thread-card"
    >
      <div
        v-if="currentUser"
        class="tk-auth-bar"
      >
        <div class="tk-auth-bar-left">
          <span class="tk-auth-bar-avatar">
            <img
              v-if="currentUser.avatar"
              :src="currentUser.avatar"
              :alt="currentUser.name"
              referrerpolicy="no-referrer"
            >
            <span
              v-else
              class="tk-auth-bar-avatar-placeholder"
            >{{ (currentUser.name || '?')[0] }}</span>
          </span>
          <div class="tk-auth-bar-info">
            <span class="tk-auth-bar-name">{{ currentUser.name }}</span>
            <span class="tk-auth-bar-provider">
              {{ ({ github: 'GitHub', google: 'Google', email: '邮箱' } as Record<string, string>)[currentUser.provider] || currentUser.provider }}
            </span>
          </div>
        </div>
        <button
          type="button"
          class="tk-auth-bar-logout"
          @click="onLogout"
        >
          {{ t('logout') || '退出' }}
        </button>
      </div>
      <div class="tk-comments-list">
        <TransitionGroup name="tk-comment-list">
          <TkComment
            v-for="comment in comments"
            :key="comment.id"
            :comment="comment"
            :options="mergedOptions"
            @reply="onReplyClick"
          />
        </TransitionGroup>
      </div>
    </div>

    <div
      v-if="infiniteMode && hasMore"
      ref="sentinelRef"
      class="tk-infinite-sentinel"
    >
      <span
        v-if="loadingMore"
        class="tk-loading"
      >{{ t('loading') }}</span>
      <span
        v-else
        class="tk-load-more"
        @click="loadMore"
      >{{ t('loadMore') }}</span>
    </div>

    <TkPagination
      v-if="!infiniteMode && total > pageSize"
      :current="page"
      :total="total"
      :page-size="pageSize"
      @change="onPageChange"
    />
    <TkFooter :options="mergedOptions" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, computed, onBeforeUnmount, inject, type Ref } from 'vue'
import { t, getComments, getUrl, normalizePath, type NormalizePathOpts } from '../../utils'
import { onAuthChange, getAuthState, logout, type AuthUser } from '../../utils/auth'
import type { Comment, TakoioConfig } from '../../types'
import TkSubmit from './TkSubmit.vue'
import TkComment from './TkComment.vue'
import TkFooter from './TkFooter.vue'
import TkPagination from './TkPagination.vue'

interface Props { options: TakoioConfig }
const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'admin'): void; (e: 'comment-posted', comment: Comment): void }>()

// 注入 App.vue 提供的共享 siteConfig ref，拉取评论后回填，供 TkSummary 双控读取
const siteConfig = inject<Ref<Record<string, any>>>('takoio-site-config', ref<Record<string, any>>({}))

const mergedOptions = computed(() => {
  const cfg = siteConfig.value
  if (!cfg || !Object.keys(cfg).length) return props.options
  const features = Array.isArray(cfg.COMMENT_FEATURES) ? cfg.COMMENT_FEATURES : null
  return {
    ...props.options,
    // 当 COMMENT_FEATURES 数组存在时，以数组为准（在数组中=启用，不在=禁用）
    // 否则回退到独立配置键，最后回退到用户初始配置
    enableCommentReaction: features !== null
      ? features.includes('commentReaction')
      : props.options.enableCommentReaction,
    enableArticleReaction: features !== null
      ? features.includes('articleReaction')
      : (cfg.ENABLE_ARTICLE_REACTION !== undefined ? cfg.ENABLE_ARTICLE_REACTION : props.options.enableArticleReaction),
    enableLinkInput: features !== null
      ? features.includes('linkInput')
      : (cfg.ENABLE_LINK_INPUT !== undefined ? cfg.ENABLE_LINK_INPUT : props.options.enableLinkInput),
    _showUaInfo: features !== null
      ? features.includes('uaInfo')
      : (cfg.SHOW_UA_INFO !== undefined ? cfg.SHOW_UA_INFO : props.options._showUaInfo),
    ...(cfg.SHOW_IP_REGION !== undefined && { _showIpRegion: cfg.SHOW_IP_REGION }),
    ...(cfg.COMMENT_LINK_REQUIRED !== undefined && { commentLinkRequired: cfg.COMMENT_LINK_REQUIRED }),
    ...(cfg.ADMIN_KEYWORD !== undefined && { adminKeyword: cfg.ADMIN_KEYWORD }),
    ...(cfg.ENABLE_CODE_HIGHLIGHT !== undefined && { enableCodeHighlight: cfg.ENABLE_CODE_HIGHLIGHT }),
    ...(cfg.CODE_HIGHLIGHT_THEME !== undefined && { codeHighlightTheme: cfg.CODE_HIGHLIGHT_THEME }),
    ...(cfg.CODE_SHOW_LANGUAGE !== undefined && { codeShowLanguage: cfg.CODE_SHOW_LANGUAGE }),
    ...(cfg.CODE_SHOW_COPY !== undefined && { codeShowCopy: cfg.CODE_SHOW_COPY }),
    ...(cfg.ENABLE_CAPTCHA !== undefined && { enableCaptcha: cfg.ENABLE_CAPTCHA }),
    ...(cfg.CAPTCHA_PROVIDER !== undefined && { captchaProvider: cfg.CAPTCHA_PROVIDER }),
    ...(cfg.CAPTCHA_TYPE !== undefined && { captchaType: cfg.CAPTCHA_TYPE }),
    ...(cfg.CAPTCHA_SITE_KEY !== undefined && { captchaSiteKey: cfg.CAPTCHA_SITE_KEY }),
    ...(cfg.GLOBAL_COLOR && { brandColor: cfg.GLOBAL_COLOR }),
  }
})

// 路径规范化选项（从用户 init 配置透传）
const normalizeOpts = computed<NormalizePathOpts>(() => ({
  pathNormalize: mergedOptions.value.pathNormalize,
  pathTransform: mergedOptions.value.pathTransform,
}))

// auto 模式探测后确定的实际请求 path（缓存，避免每次 fetch/loadMore 重复探测）
// 非 auto 模式由 resolveTargetUrl 同步计算后立即赋值
const resolvedUrl = ref<string | null>(null)

/**
 * 解析当前页面的目标 URL。
 * - 非 auto 模式：同步规范化（getUrl + normalizePath），直接返回
 * - auto 模式：双请求探测——先请求去尾斜杠 path，total>0 则采用；
 *   否则请求加尾斜杠 path，total>0 则采用；都为 0 则回退去尾斜杠（新评论默认归属）
 *   两个候选相同时只请求一次。探测结果缓存到 resolvedUrl。
 */
const resolveTargetUrl = async (signal: AbortSignal): Promise<string | null> => {
  const rawPath = getUrl(mergedOptions.value.path) // 先解析 magic-string，不做规范化
  const mode = normalizeOpts.value.pathNormalize
  if (mode !== 'auto') {
    // 同步规范化
    const url = normalizePath(rawPath, normalizeOpts.value)
    resolvedUrl.value = url
    return url
  }
  // auto 双请求探测
  const candidateA = rawPath.replace(/\/+$/, '') || '/'
  const candidateB = rawPath.endsWith('/') ? rawPath : rawPath + '/'
  // 两候选相同（如根路径 '/'），无需探测
  if (candidateA === candidateB) {
    resolvedUrl.value = candidateA
    return candidateA
  }
  // 先探测 candidateA（去尾斜杠）
  try {
    const resultA = await getComments(mergedOptions.value.envId, { url: candidateA, page: 1, pageSize: 1, sort: sort.value, signal })
    if (signal.aborted) return null
    if (resultA.total > 0) { resolvedUrl.value = candidateA; return candidateA }
  } catch (e) {
    if (e instanceof Error && e.name === 'TakoioCancelledError') return null
    // 探测失败则继续尝试 candidateB
  }
  // 再探测 candidateB（加尾斜杠）
  try {
    const resultB = await getComments(mergedOptions.value.envId, { url: candidateB, page: 1, pageSize: 1, sort: sort.value, signal })
    if (signal.aborted) return null
    if (resultB.total > 0) { resolvedUrl.value = candidateB; return candidateB }
  } catch (e) {
    if (e instanceof Error && e.name === 'TakoioCancelledError') return null
  }
  // 都为 0 或都失败 → 回退去尾斜杠（作为新评论的默认归属）
  resolvedUrl.value = candidateA
  return candidateA
}

const comments = ref<Comment[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = computed(() => mergedOptions.value.pageSize || 10)
const sort = ref<'newest' | 'oldest' | 'hottest'>(mergedOptions.value.sort || 'newest')
const loading = ref(false)
const replyTarget = ref<Comment | null>(null)
const errorMsg = ref('')
const loadingMore = ref(false)
const allComments = ref<Comment[]>([])
const sentinelRef = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

// 当前登录用户状态（社交登录后填充）
const currentUser = ref<AuthUser | null>(getAuthState()?.user || null)
let unsubscribeAuth: (() => void) | null = null
const onLogout = async () => {
  await logout()
  // onAuthChange 会自动触发 currentUser = null
}

// 组件级 AbortController：防止快速切换排序/翻页时的竞态请求
let fetchController: AbortController | null = null

const cancelOngoingFetch = (): void => {
  if (fetchController) {
    fetchController.abort()
    fetchController = null
  }
}

// 无限滚动模式下 DOM 节点累积上限：超过后丢弃最早加载的，仅保留最新批次。
// 旧评论已滚出视口，移除其 DOM 节点可避免渲染/内存压力；完整历史请用分页模式。
const MAX_INFINITE_COMMENTS = 200

const infiniteMode = computed(() => mergedOptions.value.paginationMode === 'readmore')
const hasMore = computed(() => allComments.value.length < total.value)

const buildCommentMap = (comments: Comment[]): Map<string, Comment> => {
  const map = new Map<string, Comment>()
  const traverse = (list: Comment[]) => {
    for (const c of list) {
      map.set(c.id, c)
      if (c.children?.length) traverse(c.children)
    }
  }
  traverse(comments)
  return map
}

const resolveReplyToNick = (comments: Comment[]): void => {
  const map = buildCommentMap(comments)
  const resolve = (list: Comment[]) => {
    for (const c of list) {
      if (c.rid && c.rid !== c.pid) {
        const target = map.get(c.rid)
        if (target) c.replyToNick = target.nick
      }
      if (c.children?.length) resolve(c.children)
    }
  }
  resolve(comments)
}

const loadMore = async (): Promise<void> => {
  if (loadingMore.value || !hasMore.value) return
  cancelOngoingFetch()
  fetchController = new AbortController()
  const signal = fetchController.signal

  loadingMore.value = true; page.value += 1
  try {
    const targetUrl = resolvedUrl.value || getUrl(mergedOptions.value.path, normalizeOpts.value)
    const result = await getComments(mergedOptions.value.envId, { url: targetUrl, page: page.value, pageSize: pageSize.value, sort: sort.value, signal })
    const newComments = result.data || []
    resolveReplyToNick(newComments)
    let combined = [...allComments.value, ...newComments]
    // 超出上限时丢弃最早的，保留最新（已滚出视口的旧评论无需保留在 DOM）
    if (combined.length > MAX_INFINITE_COMMENTS) {
      combined = combined.slice(combined.length - MAX_INFINITE_COMMENTS)
    }
    allComments.value = combined; comments.value = allComments.value
    if (result.total !== undefined) total.value = result.total
  } catch { if (signal.aborted) return; page.value -= 1 } finally { loadingMore.value = false }
}

const countLabel = computed(() => total.value === 0 || total.value > 1 ? t('comment') : t('commentOne'))
const sortOptions = [
  { value: 'newest' as const, label: t('sortNewest') },
  { value: 'oldest' as const, label: t('sortOldest') },
  { value: 'hottest' as const, label: t('sortHottest') }
]

const fetchComments = async (): Promise<void> => {
  cancelOngoingFetch()
  fetchController = new AbortController()
  const signal = fetchController.signal

  loading.value = true; errorMsg.value = ''
  try {
    const targetUrl = await resolveTargetUrl(signal)
    if (signal.aborted) return
    const result = await getComments(mergedOptions.value.envId, {
      url: targetUrl!,
      page: page.value,
      pageSize: pageSize.value,
      sort: sort.value,
      signal,
      // 当前登录用户的 social token：让作者本人能看到自己的私密评论
      viewerToken: getAuthState()?.token || undefined,
    })
    const fetched = result.data || []
    resolveReplyToNick(fetched)
    if (infiniteMode.value) allComments.value = fetched
    comments.value = fetched; total.value = result.total || 0
    const cfg = result.config
    if (cfg) {
      siteConfig.value = cfg
    }
    if (comments.value.length === 0) mergedOptions.value.onCommentsEmpty?.()
    else mergedOptions.value.onCommentsLoaded?.(comments.value)
  } catch (e) {
    // 请求被取消（新的 fetch 已发起），忽略此响应
    if (e instanceof Error && e.name === 'TakoioCancelledError') return
    loading.value = false; errorMsg.value = e instanceof Error ? e.message : 'Failed to load comments'
    console.warn('[Takoio Dev]', e instanceof Error ? e.message : String(e))
    if (e instanceof Error) mergedOptions.value.onError?.(e)
    return
  } finally { loading.value = false }
}

const findCommentInTree = (comments: Comment[], id: string): Comment | null => {
  for (const c of comments) {
    if (c.id === id) return c
    if (c.children?.length) {
      const found = findCommentInTree(c.children, id)
      if (found) return found
    }
  }
  return null
}

const onPosted = (comment: Comment): void => {
  if (comment.pid) {
    const parent = comments.value.find(c => c.id === comment.pid)
    if (parent) {
      if (!parent.children) parent.children = []
      if (comment.rid && comment.rid !== comment.pid) {
        const target = findCommentInTree([parent, ...(parent.children || [])], comment.rid)
        if (target) comment.replyToNick = target.nick
      }
      parent.children.push(comment)
      parent.replyCount = parent.children.length
    } else if (!infiniteMode.value) {
      fetchComments()
    }
  } else {
    if (sort.value === 'oldest') comments.value = [...comments.value, comment]
    else comments.value = [comment, ...comments.value]
  }
  total.value += 1; replyTarget.value = null; emit('comment-posted', comment)
}

const onReplyClick = (comment: Comment): void => {
  replyTarget.value = comment
  const el = sentinelRef.value || document.querySelector('.tk-submit')
  el?.scrollIntoView({ behavior: 'smooth' })
}

const onPageChange = (newPage: number): void => {
  page.value = newPage
  replyTarget.value = null
  fetchComments()
  const el = document.querySelector('.tk-comments')
  el?.scrollIntoView({ behavior: 'smooth' })
}

watch(sort, () => { page.value = 1; fetchComments() })

watch(() => mergedOptions.value.paginationMode, () => {
  page.value = 1; allComments.value = []; comments.value = []; total.value = 0
  replyTarget.value = null
  if (infiniteMode.value) setupInfiniteObserver()
  else observer?.disconnect()
})

const setupInfiniteObserver = (): void => {
  if (!infiniteMode.value || typeof IntersectionObserver === 'undefined') return
  observer?.disconnect()
  observer = new IntersectionObserver((entries) => { if (entries[0]?.isIntersecting && hasMore.value && !loadingMore.value) loadMore() }, { rootMargin: '200px' })
  if (sentinelRef.value) observer.observe(sentinelRef.value)
}
watch(sentinelRef, (el) => { if (el && infiniteMode.value) { observer?.disconnect(); setupInfiniteObserver() } })
onMounted(() => { fetchComments(); if (infiniteMode.value) setupInfiniteObserver(); unsubscribeAuth = onAuthChange((state) => { currentUser.value = state?.user || null }) })
onBeforeUnmount(() => { observer?.disconnect(); cancelOngoingFetch(); if (unsubscribeAuth) unsubscribeAuth() })
</script>

<style scoped>
.tk-icon-32 { width: 32px; height: 32px; flex-shrink: 0; display: inline-block; vertical-align: middle; }
.tk-icon-48 { width: 48px; height: 48px; flex-shrink: 0; display: inline-block; vertical-align: middle; }
.tk-comments { max-width: 100%; margin: 0; padding: 0; }
.tk-comments-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; margin-bottom: 12px; }
.tk-comments-count { display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 500; color: inherit; padding: 4px 8px 4px 12px; border-radius: 16px; }
.tk-count-text strong { font-weight: 600; font-variant-numeric:tabular-nums; }
.tk-refresh-btn { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: transparent; border: none; cursor: pointer; opacity: 0.5; border-radius: 50%; color: inherit; padding: 0; }
.tk-refresh-btn:hover { opacity: 0.8; }
.tk-sort { display: flex; align-items: center; border-radius: 20px; padding: 3px; gap: 2px; background: var(--tk-bg-muted); }
.tk-sort-btn { background: transparent; border: none; color: inherit; opacity: 0.6; font-size: 13px; font-weight: 500; cursor: pointer; padding: 4px 14px; border-radius: 18px; transition: all 0.3s; font-family: inherit; }
.tk-sort-btn:hover { opacity: 1; background: var(--tk-bg-muted); }
.tk-sort-btn.active { opacity: 1; color: var(--tk-brand); background: var(--tk-brand-light); }
.tk-loading-skeleton { padding: 24px; }
.tk-skeleton { display: flex; flex-direction: column; gap: 12px; padding: 16px; border-radius: var(--tk-r-card); background: var(--tk-bg-subtle); }
.tk-skeleton-line { height: 14px; border-radius: 4px; background: linear-gradient(90deg, rgba(0,0,0,0.08) 25%, rgba(0,0,0,0.14) 50%, rgba(0,0,0,0.08) 75%); background: linear-gradient(90deg, color-mix(in srgb,currentColor 8%,transparent) 25%, color-mix(in srgb,currentColor 14%,transparent) 50%, color-mix(in srgb,currentColor 8%,transparent) 75%); background-size: 200% 100%; animation: tk-shimmer 1.5s infinite; }
.tk-root[data-theme="dark"] .tk-skeleton-line { background: linear-gradient(90deg, rgba(255,255,255,0.08) 25%, rgba(255,255,255,0.14) 50%, rgba(255,255,255,0.08) 75%); background: linear-gradient(90deg, color-mix(in srgb,currentColor 8%,transparent) 25%, color-mix(in srgb,currentColor 14%,transparent) 50%, color-mix(in srgb,currentColor 8%,transparent) 75%); }
@keyframes tk-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
.tk-loading { text-align: center; padding: 24px 0; color: inherit; opacity: .6; font-size: 14px; }
.tk-infinite-sentinel { text-align: center; padding: 16px 0; }
.tk-load-more { color: var(--tk-brand); cursor: pointer; font-size: 13px; opacity: 0.7; transition: opacity 0.2s; }
.tk-load-more:hover { opacity: 1; }
.tk-thread-card {
  /* 设计稿：评论列表单卡片容器（半透明背景，融入更多站点主题） */
  background: transparent;
  border: 1px solid var(--tk-border);
  border-radius: var(--tk-r-card);
  box-shadow: var(--tk-shadow-card);
  padding: var(--tk-space-lg);
  transition: background 0.2s ease, border-color 0.2s ease;
}
.tk-comments-list { display: flex; flex-direction: column; gap: 0; }
.tk-comment-list-enter-active, .tk-comment-list-leave-active { transition: all 0.5s cubic-bezier(.22,.61,.36,1); }
.tk-comment-list-enter-from { opacity: 0; transform: translateY(8px); }
.tk-comment-list-leave-to { opacity: 0; transform: scale(0.96); }
.tk-comment-list-move { transition: transform 0.5s cubic-bezier(.22,.61,.36,1); }

/* error / empty state */
.tk-error-state, .tk-empty-state { display: flex; flex-direction: column; align-items: center; padding: 36px 24px; }
.tk-error-state p, .tk-empty-state p { margin: 0; }
.tk-btn-retry { margin-top: 12px; padding: 6px 20px; background: var(--tk-brand); color: #fff; border: none; border-radius: var(--tk-r-input); cursor: pointer; font-size: 13px; font-family: inherit; font-weight: 600; }
.tk-btn-retry:hover { filter: brightness(1.1); }

/* 当前登录身份状态条（社交登录用户可见） */
.tk-auth-bar {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 10px 14px; margin-bottom: 12px;
  background: var(--tk-bg-muted, #f5f5f5);
  border: 1px solid var(--tk-border, #e5e5e5);
  border-radius: var(--tk-r-input, 8px);
}
.tk-auth-bar-left {
  display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1;
}
.tk-auth-bar-avatar {
  width: 32px; height: 32px; border-radius: 50%; overflow: hidden;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--tk-brand, #fbbf24); color: #fff; flex-shrink: 0;
}
.tk-auth-bar-avatar img { width: 100%; height: 100%; object-fit: cover; }
.tk-auth-bar-avatar-placeholder { font-size: 14px; font-weight: 600; }
.tk-auth-bar-info { display: flex; flex-direction: column; min-width: 0; gap: 2px; }
.tk-auth-bar-name { font-size: 14px; font-weight: 500; }
.tk-auth-bar-provider {
  display: inline-block; align-self: flex-start;
  padding: 1px 8px; background: var(--tk-bg-hover, #e5e5e5);
  border-radius: 9999px; font-size: 10px; text-transform: uppercase;
  color: var(--tk-text-tertiary, #999); font-weight: 500;
}
.tk-auth-bar-logout {
  padding: 4px 12px; background: transparent;
  border: 1px solid var(--tk-border, #e5e5e5);
  border-radius: var(--tk-r-input, 8px);
  font-size: 12px; color: var(--tk-text-secondary, #666);
  cursor: pointer; font-family: inherit; transition: all .15s;
  flex-shrink: 0;
}
.tk-auth-bar-logout:hover { border-color: var(--tk-danger, #ef4444); color: var(--tk-danger, #ef4444); }
</style>
