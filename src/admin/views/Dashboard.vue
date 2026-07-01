<template>
  <div class="dashboard">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">
          欢迎回来
        </h1>
      </div>
      <div class="header-right">
        <span
          v-if="lastRefreshTs"
          class="refresh-time"
        >
          {{ formatRefreshTime(lastRefreshTs) }}
        </span>
        <n-button
          size="small"
          quaternary
          circle
          :title="`最后刷新：${lastRefreshTs ? formatRefreshTime(lastRefreshTs) : '未知'}`"
          :loading="refreshing"
          @click="onRefresh"
        >
          <template #icon>
            <n-icon><RefreshOutline /></n-icon>
          </template>
        </n-button>
      </div>
    </div>

    <!-- 系统状态 -->
    <div class="system-status">
      <n-tag
        size="small"
        :type="sysStatus.dev ? 'warning' : 'success'"
        round
      >
        <template #icon>
          <n-icon><component :is="sysStatus.dev ? FlameOutline : CheckmarkCircleOutline" /></n-icon>
        </template>
        {{ sysStatus.dev ? '热开发环境' : '生产环境' }}
      </n-tag>
      <n-tag
        size="small"
        :type="redisTagType"
        round
      >
        <template #icon>
          <n-icon><component :is="redisTagIcon" /></n-icon>
        </template>
        {{ redisTagLabel }}
      </n-tag>
      <n-tag
        size="small"
        type="info"
        round
      >
        {{ sysStatus.dbType }}
      </n-tag>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-grid">
      <component
        :is="stat.clickable ? 'router-link' : 'div'"
        v-for="stat in stats"
        :key="stat.key"
        :to="stat.clickable ? stat.to : undefined"
        class="stat-card"
        :class="{ clickable: stat.clickable }"
        :tabindex="stat.clickable ? 0 : undefined"
        :role="stat.clickable ? 'button' : undefined"
        :aria-label="stat.clickable ? `${stat.label}：${stat.value}，点击查看详情` : `${stat.label}：${stat.value}`"
        @keydown.enter="stat.clickable && stat.to && goTo(stat.to)"
      >
        <div
          class="stat-icon"
          :style="{ background: stat.bgColor }"
        >
          <n-icon
            size="22"
            :color="stat.iconColor"
          >
            <component :is="stat.icon" />
          </n-icon>
        </div>
        <div class="stat-info">
          <div class="stat-label">
            {{ stat.label }}
          </div>
          <div class="stat-value">
            <n-skeleton
              v-if="statsLoading"
              text
              :width="56"
              :repeat="1"
            />
            <template v-else>
              {{ formatNumber(stat.value) }}
            </template>
          </div>
        </div>
      </component>
    </div>

    <!-- 最近评论 -->
    <div class="panel-card recent-card">
      <div class="card-header">
        <span class="card-title">最近评论</span>
        <router-link
          to="/comments"
          class="view-all-link"
        >
          查看全部
          <n-icon size="14">
            <ArrowForwardOutline />
          </n-icon>
        </router-link>
      </div>
      <div class="card-body">
        <n-spin :show="commentsLoading">
          <n-skeleton
            v-if="commentsLoading && !recentComments.length"
            :repeat="6"
            text
            style="margin-bottom: 12px"
          />
          <div
            v-else-if="loadError"
            class="error-state"
          >
            <n-icon
              size="36"
              :depth="3"
            >
              <AlertCircleOutline />
            </n-icon>
            <p>加载失败</p>
            <n-button
              size="small"
              secondary
              @click="onRefresh"
            >
              重试
            </n-button>
          </div>
          <div
            v-else-if="recentComments.length === 0"
            class="empty-state"
          >
            <n-icon
              size="40"
              :depth="3"
            >
              <ChatbubblesOutline />
            </n-icon>
            <p>暂无评论</p>
          </div>
          <div
            v-else
            class="recent-grid"
          >
            <router-link
              v-for="c in recentComments"
              :key="c.id"
              :to="`/comments?filter=all`"
              class="recent-item"
            >
              <!-- header 行 -->
              <div class="recent-header">
                <div
                  class="avatar-wrap"
                  :style="{ background: avatarColor(c.nick) }"
                >
                  <img
                    v-if="!c._avatarError"
                    :src="getAvatar(c)"
                    class="recent-avatar"
                    :alt="c.nick ? `${c.nick} 的头像` : '用户头像'"
                    @error="c._avatarError = true"
                  >
                  <span
                    v-else
                    class="avatar-letter"
                  >{{ (c.nick || '?').slice(0, 1).toUpperCase() }}</span>
                </div>
                <div class="recent-body">
                  <div class="recent-meta">
                    <span class="recent-name">{{ c.nick || '匿名' }}</span>
                    <n-tag
                      v-if="c.isTop"
                      size="tiny"
                      type="warning"
                      round
                    >
                      置顶
                    </n-tag>
                    <n-tag
                      v-if="c.state === 'pending'"
                      size="tiny"
                      type="default"
                      round
                    >
                      待审
                    </n-tag>
                    <n-tag
                      v-else-if="c.state === 'hidden'"
                      size="tiny"
                      type="warning"
                      round
                    >
                      隐藏
                    </n-tag>
                    <n-tag
                      v-else-if="c.isSpam"
                      size="tiny"
                      type="error"
                      round
                    >
                      垃圾
                    </n-tag>
                    <span class="recent-time">{{ formatTime(c.created) }}</span>
                  </div>
                  <!-- 原文链接行 -->
                  <a
                    v-if="c.url || c.href"
                    :href="c.href || c.url"
                    target="_blank"
                    rel="noopener"
                    class="recent-link"
                    :title="c.href || c.url"
                    @click.stop
                  >
                    <n-icon size="12"><LinkOutline /></n-icon>
                    <span>{{ c.url || c.href }}</span>
                  </a>
                  <!-- 内容 -->
                  <div
                    class="recent-content"
                    v-html="(c as any)._safeContent || ''"
                  />
                </div>
                <n-icon
                  size="16"
                  class="recent-arrow"
                  :depth="3"
                >
                  <ChevronForwardOutline />
                </n-icon>
              </div>
            </router-link>
          </div>
        </n-spin>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  NButton, NIcon, NTag, NSpin, NSkeleton, useMessage,
} from 'naive-ui'
import {
  ChatbubblesOutline, EyeOffOutline, ShieldOutline,
  ArrowForwardOutline, RefreshOutline, LinkOutline, AlertCircleOutline,
  ChevronForwardOutline,
  FlameOutline, CheckmarkCircleOutline, ServerOutline, CloudOfflineOutline,
} from '@vicons/ionicons5'
import { commentsApi, type DashboardStats } from '../api/comments'
import { api } from '../api/client'
import { renderMarkdown } from '@shared/utils/marked'
import type { Comment } from '@shared/types'

const message = useMessage()
const router = useRouter()

const CACHE_KEY = 'takoio:dashboard:cache'
const CACHE_TTL = 5 * 60 * 1000

interface CachedData {
  ts: number
  stats: DashboardStats
  comments: Comment[]
}

const statsLoading = ref(false)
const commentsLoading = ref(false)
const refreshing = ref(false)
const loadError = ref(false)
const lastRefreshTs = ref(0)

const statsData = ref<DashboardStats | null>(null)
const recentComments = ref<(Comment & { _avatarError?: boolean })[]>([])

// 统计卡片定义
const stats = computed(() => {
  const s = statsData.value
  return [
    {
      key: 'total',
      label: '总评论数',
      value: s?.total ?? 0,
      icon: ChatbubblesOutline,
      bgColor: 'var(--accent-soft)',
      iconColor: 'var(--accent)',
      clickable: true,
      to: '/comments',
    },
    {
      key: 'pending',
      label: '待审核',
      value: s?.pending ?? 0,
      icon: EyeOffOutline,
      bgColor: 'var(--warning-soft)',
      iconColor: 'var(--warning)',
      clickable: true,
      to: '/comments?filter=pending',
    },
    {
      key: 'spam',
      label: '垃圾评论',
      value: s?.spam ?? 0,
      icon: ShieldOutline,
      bgColor: 'var(--danger-soft)',
      iconColor: 'var(--danger)',
      clickable: true,
      to: '/comments?filter=spam',
    },
  ]
})

// ===== 工具函数 =====
const formatNumber = (n: number): string => n.toLocaleString('zh-CN')

const formatTime = (ts: number): string => {
  const d = new Date(ts)
  const now = new Date()
  const diff = now.getTime() - ts
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const formatRefreshTime = (ts: number): string => {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
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

const goTo = (to: string) => router.push(to)

// ===== 数据加载 =====
const readCache = (): CachedData | null => {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as CachedData
    if (Date.now() - data.ts > CACHE_TTL) return null
    return data
  } catch {
    return null
  }
}

const writeCache = (data: Omit<CachedData, 'ts'>) => {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ...data, ts: Date.now() }))
  } catch {
    // ignore quota errors
  }
}

const loadStats = async () => {
  statsLoading.value = true
  try {
    statsData.value = await commentsApi.getDashboard()
  } catch (e: any) {
    message.error('统计加载失败：' + (e.message || ''))
  } finally {
    statsLoading.value = false
  }
}

const loadComments = async () => {
  commentsLoading.value = true
  try {
    const res = await commentsApi.list({ page: 1, pageSize: 6, filter: 'all' })
    const data = res.data || []
    await Promise.all(data.map(async (item: Comment) => {
      (item as any)._safeContent = await renderMarkdown(item.renderedComment || item.comment || '')
    }))
    recentComments.value = data as any
  } catch (e: any) {
    loadError.value = true
    message.error('评论加载失败：' + (e.message || ''))
  } finally {
    commentsLoading.value = false
  }
}

const loadAll = async (force = false) => {
  // 先用缓存即时渲染
  if (!force) {
    const cached = readCache()
    if (cached) {
      statsData.value = cached.stats
      recentComments.value = cached.comments as any
      lastRefreshTs.value = cached.ts
    }
  }
  // 后台刷新
  refreshing.value = force
  loadError.value = false
  await Promise.all([loadStats(), loadComments()])
  if (statsData.value && !loadError.value) {
    // 写入缓存时清除头像错误标记，恢复后重新尝试加载头像
    const commentsClean = recentComments.value.map(({ _avatarError, ...rest }) => rest) as any
    writeCache({
      stats: statsData.value,
      comments: commentsClean,
    })
    lastRefreshTs.value = Date.now()
  }
  refreshing.value = false
}

const onRefresh = () => loadAll(true)

// ===== 系统状态 =====
interface SystemStatus {
  dev: boolean
  dbType: string
  redisAvailable: boolean
  summaryCount: number
}

const sysStatus = ref<SystemStatus>({ dev: false, dbType: 'sqlite', redisAvailable: false, summaryCount: 0 })

const redisTagType = computed<'success' | 'error' | 'default'>(() => {
  if (sysStatus.value.dev) return 'default'
  return sysStatus.value.redisAvailable ? 'success' : 'error'
})
const redisTagLabel = computed(() => {
  return sysStatus.value.redisAvailable ? 'Redis 已连接' : 'Redis 未连接'
})
const redisTagIcon = computed(() => {
  return sysStatus.value.redisAvailable ? ServerOutline : CloudOfflineOutline
})

const loadSystemStatus = async () => {
  try {
    const r = await api.get<SystemStatus>('/api/admin/system')
    sysStatus.value = r
  } catch {
    // 静默失败，保持默认值
  }
}

onMounted(() => {
  loadAll(false)
  loadSystemStatus()
})

</script>

<style scoped>
.dashboard {
  max-width: 1200px;
}

/* ===== 系统状态 ===== */
.system-status {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

/* ===== 页面头部 ===== */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  gap: 12px;
  flex-wrap: wrap;
}
.header-left {
  display: flex;
  align-items: baseline;
  gap: 12px;
  flex-wrap: wrap;
}
.page-title {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  color: var(--ink);
  font-family: var(--font-display);
  letter-spacing: -0.01em;
}
.refresh-time {
  font-size: 12px;
  color: var(--ink-3);
}
.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ===== 统计卡片 ===== */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}
.stat-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 16px 16px 20px;
  background: var(--paper);
  border: 1px solid var(--edge-soft);
  border-radius: var(--r-card);
  text-decoration: none;
  box-shadow: var(--shadow-paper);
  transition: transform 0.22s cubic-bezier(.22,.61,.36,1), box-shadow 0.22s cubic-bezier(.22,.61,.36,1), border-color 0.22s;
}
.stat-card.clickable {
  cursor: pointer;
}
.stat-card.clickable:hover,
.stat-card.clickable:focus-visible {
  transform: translateY(-2px);
  border-color: var(--accent);
  box-shadow: var(--shadow-lift);
  outline: none;
}
.stat-icon {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  opacity: 0.85;
}
.stat-info {
  flex: 1;
  min-width: 0;
}
.stat-label {
  font-size: 12px;
  color: var(--ink-3);
  margin-bottom: 4px;
}
.stat-value {
  font-size: 26px;
  font-weight: 600;
  color: var(--ink);
  line-height: 1.2;
  font-family: var(--font-display);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}

/* ===== 面板卡片 ===== */
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
  margin-bottom: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.panel-card .card-body {
  padding: 4px 16px;
}

.card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--ink);
}
/* ===== 空状态 / 错误 ===== */
.empty-state {
  text-align: center;
  padding: 32px 0;
  color: var(--ink-3);
  font-size: 13px;
}
.empty-state p { margin: 8px 0 0; }
.error-state {
  text-align: center;
  padding: 32px 0;
  color: var(--ink-3);
  font-size: 13px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.error-state p { margin: 0; }

/* ===== 最近评论 ===== */
.view-all-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--accent);
  font-size: 12px;
  text-decoration: none;
  font-weight: 500;
}
.view-all-link:hover { opacity: 0.8; }

.recent-item {
  padding: 12px 0;
  text-decoration: none;
  color: inherit;
  display: block;
}
.recent-item:last-child { border-bottom: none; }
.recent-item:hover .recent-arrow { color: var(--accent); }

.recent-header {
  display: flex;
  gap: 10px;
}
.avatar-wrap {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: var(--edge-soft);
}
.recent-avatar {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  display: block;
}
.avatar-letter {
  font-size: 13px;
  font-weight: 600;
  color: #fff;
}

.recent-body {
  flex: 1;
  min-width: 0;
}
.recent-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
  flex-wrap: wrap;
}
.recent-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink);
}
.recent-time {
  font-size: 11px;
  color: var(--ink-3);
  margin-left: auto;
  white-space: nowrap;
}
.recent-link {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--ink-3);
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-decoration: none;
}
.recent-link:hover { color: var(--accent); }
.recent-content {
  font-size: 13px;
  color: var(--ink-2);
  line-height: 1.6;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.recent-content :deep(p) {
  margin: 0;
  display: inline;
}
.recent-content :deep(img) {
  max-height: 22px;
  vertical-align: middle;
}

.recent-arrow {
  flex-shrink: 0;
  align-self: flex-start;
  margin-top: 4px;
  color: var(--ink-4);
  transition: color 0.2s;
}
.recent-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}
@media (min-width: 900px) {
  .recent-grid {
    grid-template-columns: 1fr 1fr;
  }
}

/* ===== 超小屏 ===== */
@media (max-width: 480px) {
  .stats-grid {
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .stat-card {
    padding: 12px;
    gap: 10px;
  }
  .stat-icon {
    width: 36px;
    height: 36px;
  }
  .stat-value {
    font-size: 20px;
  }
  .panel-card .card-body {
    padding: 4px 12px;
  }
  .recent-item {
    padding: 10px 0;
  }
}
</style>
