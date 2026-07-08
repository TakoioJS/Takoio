<template>
  <div class="dashboard">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">欢迎回来</h1>
      </div>
      <div class="header-right">
        <span v-if="lastRefreshTs" class="refresh-time">{{ formatRefreshTime(lastRefreshTs) }}</span>
        <n-button size="small" quaternary circle :title="`最后刷新：${lastRefreshTs ? formatRefreshTime(lastRefreshTs) : '未知'}`" :loading="refreshing" @click="onRefresh">
          <template #icon><n-icon><RefreshOutline /></n-icon></template>
        </n-button>
      </div>
    </div>

    <!-- 系统状态 -->
    <SystemStatus :sys-status="sysStatus" />

    <!-- 统计卡片 -->
    <div class="stats-grid">
      <component :is="stat.clickable ? 'router-link' : 'div'" v-for="stat in stats" :key="stat.key" :to="stat.clickable ? stat.to : undefined" class="stat-card" :class="{ clickable: stat.clickable }" :tabindex="stat.clickable ? 0 : undefined" :role="stat.clickable ? 'button' : undefined" :aria-label="stat.clickable ? `${stat.label}：${stat.value}，点击查看详情` : `${stat.label}：${stat.value}`" @keydown.enter="stat.clickable && stat.to && goTo(stat.to)">
        <div class="stat-icon" :style="{ background: stat.bgColor }">
          <n-icon size="22" :color="stat.iconColor"><component :is="stat.icon" /></n-icon>
        </div>
        <div class="stat-info">
          <div class="stat-label">{{ stat.label }}</div>
          <div class="stat-value">
            <n-skeleton v-if="statsLoading" text :width="56" :repeat="1" />
            <template v-else>{{ formatNumber(stat.value) }}</template>
          </div>
        </div>
      </component>
    </div>

    <!-- 最近评论 -->
    <RecentComments
      :comments="recentComments"
      :loading="commentsLoading"
      :load-error="loadError"
      @retry="onRefresh"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NIcon, NSkeleton, useMessage } from 'naive-ui'
import { ChatbubblesOutline, EyeOffOutline, ShieldOutline, RefreshOutline } from '@vicons/ionicons5'
import { commentsApi, type DashboardStats } from '../api/comments'
import { t } from '@shared/utils/i18n'
import { api } from '../api/client'
import { renderMarkdown } from '@shared/utils/marked'
import type { Comment } from '@shared/types'
import SystemStatus, { type SystemStatusData } from './components/SystemStatus.vue'
import RecentComments from './components/RecentComments.vue'

const message = useMessage()
const router = useRouter()

const CACHE_KEY = 'takoio:dashboard:cache'
const CACHE_TTL = 5 * 60 * 1000
interface CachedData { ts: number; stats: DashboardStats; comments: Comment[] }

const statsLoading = ref(false)
const commentsLoading = ref(false)
const refreshing = ref(false)
const loadError = ref(false)
const lastRefreshTs = ref(0)
const statsData = ref<DashboardStats | null>(null)
const recentComments = ref<(Comment & { _avatarError?: boolean })[]>([])
const sysStatus = ref<SystemStatusData>({ dev: false, dbType: 'sqlite', redisAvailable: false, summaryCount: 0 })

// 统计卡片
const stats = computed(() => {
  const s = statsData.value
  return [
    { key: 'total', label: '总评论数', value: s?.total ?? 0, icon: ChatbubblesOutline, bgColor: 'var(--accent-soft)', iconColor: 'var(--accent)', clickable: true, to: '/comments' },
    { key: 'pending', label: '待审核', value: s?.pending ?? 0, icon: EyeOffOutline, bgColor: 'var(--warning-soft)', iconColor: 'var(--warning)', clickable: true, to: '/comments?filter=pending' },
    { key: 'spam', label: '垃圾评论', value: s?.spam ?? 0, icon: ShieldOutline, bgColor: 'var(--danger-soft)', iconColor: 'var(--danger)', clickable: true, to: '/comments?filter=spam' },
  ]
})

// 工具函数
const formatRefreshTime = (ts: number): string => {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}
const formatNumber = (n: number): string => n.toLocaleString('zh-CN')
const goTo = (to: string) => router.push(to)

// 会话缓存
const readCache = (): CachedData | null => {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as CachedData
    return Date.now() - data.ts > CACHE_TTL ? null : data
  } catch { return null }
}
const writeCache = (data: Omit<CachedData, 'ts'>) => {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ...data, ts: Date.now() })) } catch { /* ignore */ }
}

// 数据加载
const loadStats = async () => {
  statsLoading.value = true
  try { statsData.value = await commentsApi.getDashboard() }
  catch (e: any) { message.error(t('statsLoadFailed') + '：' + (e.message || '')) }
  finally { statsLoading.value = false }
}

const loadComments = async () => {
  commentsLoading.value = true
  try {
    const res = await commentsApi.list({ page: 1, pageSize: 6, filter: 'all' })
    const data = res.data || []
    await Promise.all(data.map(async (item: Comment) => {
      item._safeContent = item.renderedComment || await renderMarkdown(item.comment || '')
    }))
    recentComments.value = data
  } catch (e: any) { loadError.value = true; message.error(t('commentsLoadFailed') + '：' + (e.message || '')) }
  finally { commentsLoading.value = false }
}

const loadAll = async (force = false) => {
  if (!force) {
    const cached = readCache()
    if (cached) {
      statsData.value = cached.stats; recentComments.value = cached.comments as any; lastRefreshTs.value = cached.ts
    }
  }
  refreshing.value = force; loadError.value = false
  await Promise.all([loadStats(), loadComments()])
  if (statsData.value && !loadError.value) {
    const commentsClean = recentComments.value.map(({ _avatarError, ...rest }) => rest) as any
    writeCache({ stats: statsData.value, comments: commentsClean })
    lastRefreshTs.value = Date.now()
  }
  refreshing.value = false
}

const loadSystemStatus = async () => {
  try { sysStatus.value = await api.get<SystemStatusData>('/api/admin/system') }
  catch { /* silent */ }
}

const onRefresh = () => loadAll(true)

onMounted(() => { loadAll(false); loadSystemStatus() })
</script>

<style scoped>
.dashboard { max-width: 1200px; }
.page-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 16px; gap: 12px; flex-wrap: wrap;
}
.header-left { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.page-title {
  margin: 0; font-size: 22px; font-weight: 600; color: var(--ink);
  font-family: var(--font-display); letter-spacing: -0.01em;
}
.refresh-time { font-size: 12px; color: var(--ink-3); }
.header-right { display: flex; align-items: center; gap: 8px; }
.stats-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 320px));
  gap: 12px; margin-bottom: 12px;
}
.stat-card {
  display: flex; align-items: center; gap: 14px;
  padding: 16px 16px 16px 20px; background: var(--paper);
  border: 1px solid var(--edge-soft); border-radius: var(--r-card);
  text-decoration: none; box-shadow: var(--shadow-paper);
  transition: transform 0.22s, box-shadow 0.22s, border-color 0.22s;
}
.stat-card.clickable { cursor: pointer; }
.stat-card.clickable:hover,
.stat-card.clickable:focus-visible {
  transform: translateY(-2px); border-color: var(--accent);
  box-shadow: var(--shadow-lift); outline: none;
}
.stat-icon {
  width: 44px; height: 44px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; opacity: 0.85;
}
.stat-info { flex: 1; min-width: 0; }
.stat-label { font-size: 12px; color: var(--ink-3); margin-bottom: 4px; }
.stat-value {
  font-size: 26px; font-weight: 600; color: var(--ink); line-height: 1.2;
  font-family: var(--font-display); font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}
@media (max-width: 480px) {
  .stats-grid { grid-template-columns: 1fr 1fr; gap: 8px; }
  .stat-card { padding: 12px; gap: 10px; }
  .stat-icon { width: 36px; height: 36px; }
  .stat-value { font-size: 20px; }
}
</style>