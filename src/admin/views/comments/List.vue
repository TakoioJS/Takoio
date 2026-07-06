<template>
  <div class="comments-page">
    <!-- 工具栏 -->
    <div class="toolbar-card">
      <div class="toolbar-left">
        <n-select
          v-model:value="filter"
          :options="filterOptions"
          size="small"
          style="width: 110px"
          @update:value="onFilterChange"
        />
        <n-input
          v-model:value="search"
          size="small"
          placeholder="搜索昵称、邮箱、内容、URL、IP..."
          clearable
          style="width: 260px"
          @update:value="onSearchDebounced"
          @clear="onSearchClear"
        >
          <template #prefix>
            <n-icon size="14">
              <SearchOutline />
            </n-icon>
          </template>
        </n-input>
        <n-button
          size="small"
          quaternary
          title="刷新"
          @click="loadComments"
        >
          <template #icon>
            <n-icon><RefreshOutline /></n-icon>
          </template>
        </n-button>
      </div>
      <div
        v-if="selectedIds.length > 0"
        class="batch-bar"
      >
        <span class="batch-count">已选 {{ selectedIds.length }} 条</span>
        <n-button
          size="small"
          @click="batchApprove"
        >
          通过
        </n-button>
        <n-button
          size="small"
          @click="batchShow"
        >
          显示
        </n-button>
        <n-button
          size="small"
          @click="batchHide"
        >
          隐藏
        </n-button>
        <n-button
          size="small"
          type="warning"
          @click="batchSpam"
        >
          垃圾
        </n-button>
        <n-button
          size="small"
          type="error"
          @click="batchDelete"
        >
          删除
        </n-button>
      </div>
    </div>

    <!-- 评论列表 -->
    <div class="list-card">
      <n-spin :show="loading">
        <div class="comment-list">
          <div
            v-if="comments.length === 0 && !loading"
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

          <CommentItem
            v-for="item in comments"
            :key="item.id"
            :comment="item"
            :selected="selectedIds.includes(item.id)"
            @select="toggleSelect"
            @approve="approveOne"
            @reply="openReply"
            @edit="openEdit"
            @delete="onDeleteOne"
            @refresh-region="refreshRegion"
            @more-action="onMoreAction"
          />
        </div>
      </n-spin>
    </div>

    <!-- 分页 -->
    <div class="pagination-bar">
      <span class="total-text">共 {{ total }} 条</span>
      <n-pagination
        v-model:page="page"
        :page-size="pageSize"
        :item-count="total"
        :page-sizes="[20, 50, 100]"
        show-size-picker
        size="small"
        @update:page="loadComments"
        @update:page-size="onPageSizeChange"
      />
    </div>

    <!-- 编辑 Modal -->
    <CommentEditModal
      :visible="editVisible"
      :comment="editTarget"
      :saving="editSaving"
      @update:visible="editVisible = $event"
      @save="saveEdit"
    />

    <!-- 回复 Modal -->
    <CommentReplyModal
      :visible="replyVisible"
      :comment="replyTarget"
      :loading="replySaving"
      @update:visible="replyVisible = $event"
      @send="saveReply"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import {
  NSelect, NInput, NButton, NIcon, NSpin, NPagination, useMessage, useDialog,
} from 'naive-ui'
import { RefreshOutline, SearchOutline, ChatbubblesOutline } from '@vicons/ionicons5'
import { useRoute, useRouter } from 'vue-router'
import { commentsApi } from '../../api/comments'
import { renderMarkdown } from '@shared/utils/marked'
import { t } from '@shared/utils/i18n'
import type { Comment } from '@shared/types'
import CommentItem from './components/CommentItem.vue'
import CommentEditModal from './components/CommentEditModal.vue'
import CommentReplyModal from './components/CommentReplyModal.vue'

const message = useMessage()
const dialog = useDialog()
const route = useRoute()
const router = useRouter()

const VALID_FILTERS = ['all', 'visible', 'hidden', 'spam', 'pending'] as const
type FilterValue = typeof VALID_FILTERS[number]

const applyQueryFilter = () => {
  const q = route.query.filter as string | undefined
  if (q && (VALID_FILTERS as readonly string[]).includes(q)) {
    filter.value = q as FilterValue
  }
}

const comments = ref<Comment[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(false)
const search = ref('')
const filter = ref<'all' | 'visible' | 'hidden' | 'spam' | 'pending'>('all')
const selectedIds = ref<string[]>([])
let searchTimer: ReturnType<typeof setTimeout> | null = null

const filterOptions = [
  { label: '全部', value: 'all' },
  { label: '可见', value: 'visible' },
  { label: '隐藏', value: 'hidden' },
  { label: '垃圾', value: 'spam' },
  { label: '待审', value: 'pending' },
]

const loadComments = async () => {
  loading.value = true
  try {
    const params: Record<string, any> = { page: page.value, pageSize: pageSize.value }
    if (search.value) params.search = search.value
    if (filter.value !== 'all') params.filter = filter.value
    const r = await commentsApi.list(params)
    const data = r.data || []
    await Promise.all(data.map(async (item: Comment) => {
      item._safeContent = await renderMarkdown(item.renderedComment || item.comment || '')
    }))
    comments.value = data
    total.value = r.total || 0
  } catch (e: any) {
    message.error(t('loadFailed') + ': ' + (e.message || ''))
  } finally {
    loading.value = false
  }
}

const onSearchDebounced = () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { page.value = 1; loadComments() }, 300)
}

const onSearchClear = () => { search.value = ''; page.value = 1; loadComments() }
const onFilterChange = () => { page.value = 1; router.replace({ query: { ...route.query, filter: filter.value } }).catch(() => {}); loadComments() }
const onPageSizeChange = (size: number) => { pageSize.value = size; page.value = 1; loadComments() }

// ===== 选择 =====
const toggleSelect = (item: Comment) => {
  const idx = selectedIds.value.indexOf(item.id)
  if (idx >= 0) selectedIds.value.splice(idx, 1)
  else selectedIds.value.push(item.id)
}

// ===== 单条操作 =====
const toggleHide = async (row: Comment) => {
  try {
    const hide = row.state !== 'hidden'
    await commentsApi.hide(row.id, hide)
    row.state = hide ? 'hidden' : 'visible'
    message.success(t('operationSuccess'))
  } catch (e: any) { message.error(t('operationFailed') + ': ' + (e.message || '')) }
}

const toggleSpam = async (row: Comment) => {
  try {
    const isSpam = !row.isSpam
    await commentsApi.setSpam(row.id, isSpam)
    row.isSpam = isSpam
    row.state = isSpam ? 'spam' : 'visible'
    message.success(t('operationSuccess'))
  } catch (e: any) { message.error(t('operationFailed') + ': ' + (e.message || '')) }
}

const approveOne = async (row: Comment) => {
  try {
    await commentsApi.approve(row.id)
    row.state = 'visible'
    message.success(t('approved'))
  } catch (e: any) { message.error(t('operationFailed') + ': ' + (e.message || '')) }
}

const toggleTop = async (row: Comment) => {
  try {
    await commentsApi.toggleTop(row.id, !row.isTop)
    row.isTop = !row.isTop
    message.success(t('operationSuccess'))
  } catch (e: any) { message.error(t('operationFailed') + ': ' + (e.message || '')) }
}

const onDeleteOne = (row: Comment) => {
  dialog.warning({
    title: '确认删除',
    content: '确定要删除这条评论吗？此操作不可恢复。',
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await commentsApi.delete(row.id)
        message.success(t('deleteSuccess'))
        loadComments()
      } catch (e: any) { message.error(t('deleteFailed') + ': ' + (e.message || '')) }
    },
  })
}

const refreshRegion = async (row: Comment) => {
  try {
    const r = await commentsApi.refreshIpRegion(row.id)
    if (r.ipRegion) {
      row.ipRegion = r.ipRegion
      message.success(t('regionResolved'))
    } else {
      message.info(t('regionUnresolved'))
    }
  } catch (e: any) { message.error(t('operationFailed') + ': ' + (e.message || '')) }
}

const onMoreAction = ({ comment, key }: { comment: Comment; key: string }) => {
  if (key === 'approve') approveOne(comment)
  else if (key === 'top') toggleTop(comment)
  else if (key === 'hide') toggleHide(comment)
  else if (key === 'spam') toggleSpam(comment)
}

// ===== 批量操作 =====
const batchApprove = async () => {
  try {
    await commentsApi.batchApprove(selectedIds.value)
    selectedIds.value = []
    loadComments()
    message.success(t('approved'))
  } catch (e: any) { message.error(t('operationFailed') + ': ' + (e.message || '')) }
}

const batchShow = async () => {
  try {
    await commentsApi.batchHide(selectedIds.value, false)
    selectedIds.value = []
    loadComments()
    message.success(t('operationSuccess'))
  } catch (e: any) { message.error(t('operationFailed') + ': ' + (e.message || '')) }
}

const batchHide = async () => {
  try {
    await commentsApi.batchHide(selectedIds.value, true)
    selectedIds.value = []
    loadComments()
    message.success(t('operationSuccess'))
  } catch (e: any) { message.error(t('operationFailed') + ': ' + (e.message || '')) }
}

const batchSpam = async () => {
  try {
    await commentsApi.batchSpam(selectedIds.value, true)
    selectedIds.value = []
    loadComments()
    message.success(t('markedAsSpam'))
  } catch (e: any) { message.error(t('operationFailed') + ': ' + (e.message || '')) }
}

const batchDelete = () => {
  dialog.warning({
    title: '批量删除',
    content: `确定要删除选中的 ${selectedIds.value.length} 条评论吗？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await commentsApi.batchDelete(selectedIds.value)
        selectedIds.value = []
        message.success(t('deleteSuccess'))
        loadComments()
      } catch (e: any) { message.error(t('deleteFailed') + ': ' + (e.message || '')) }
    },
  })
}

// ===== 编辑 =====
const editVisible = ref(false)
const editSaving = ref(false)
const editTarget = ref<Comment | null>(null)

const openEdit = (item: Comment) => {
  editTarget.value = item
  editVisible.value = true
}

const saveEdit = async (form: { id: string; nick: string; mail: string; link: string; comment: string }) => {
  editSaving.value = true
  try {
    await commentsApi.update(form.id, form)
    message.success(t('saveSuccess'))
    editVisible.value = false
    loadComments()
  } catch (e: any) {
    message.error(t('saveFailed') + ': ' + (e.message || ''))
  } finally {
    editSaving.value = false
  }
}

// ===== 回复 =====
const replyVisible = ref(false)
const replySaving = ref(false)
const replyTarget = ref<Comment | null>(null)

const openReply = (item: Comment) => {
  replyTarget.value = item
  replyVisible.value = true
}

const saveReply = async (form: { nick: string; mail: string; comment: string }) => {
  if (!replyTarget.value) return
  if (!form.comment.trim()) { message.warning(t('enterContent')); return }
  if (!form.nick.trim()) { message.warning(t('enterNickname')); return }
  replySaving.value = true
  try {
    const target = replyTarget.value
    await commentsApi.reply({
      url: target.url || '/',
      href: target.href || target.url || '',
      nick: form.nick,
      mail: form.mail,
      comment: form.comment,
      pid: target.id,
      rid: target.rid || target.id,
      ua: navigator.userAgent,
      title: '',
    })
    message.success(t('replySuccess'))
    replyVisible.value = false
    loadComments()
  } catch (e: any) {
    message.error(t('replyFailed') + ': ' + (e.message || ''))
  } finally {
    replySaving.value = false
  }
}

onMounted(() => {
  applyQueryFilter()
  loadComments()
})

// 监听路由 query 变化（从 Dashboard 跳转过来时）
watch(() => route.query.filter, (q) => {
  if (q && (VALID_FILTERS as readonly string[]).includes(q as string)) {
    if (filter.value !== q) {
      filter.value = q as FilterValue
      page.value = 1
      loadComments()
    }
  } else if (!q && filter.value !== 'all') {
    filter.value = 'all'
    page.value = 1
    loadComments()
  }
})
</script>

<style scoped>
.comments-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ---- 工具栏 ---- */
.toolbar-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  background: var(--paper);
  border: 1px solid var(--edge-soft);
  border-radius: 10px;
}
.toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.batch-bar {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}
.batch-count {
  font-size: 12px;
  color: var(--ink-2);
  font-weight: 500;
  margin-right: 4px;
}

/* ---- 列表卡片 ---- */
.list-card {
  background: var(--paper);
  border: 1px solid var(--edge-soft);
  border-radius: 10px;
  overflow: hidden;
}
.comment-list { min-height: 200px; }
.empty-state {
  text-align: center;
  padding: 64px 0;
  color: var(--ink-3);
  font-size: 13px;
}
.empty-state p { margin: 8px 0 0; }

/* ---- 分页 ---- */
.pagination-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--paper);
  border: 1px solid var(--edge-soft);
  border-radius: 10px;
}
.total-text {
  font-size: 12px;
  color: var(--ink-3);
  white-space: nowrap;
}

/* ============ 移动端响应式 ============ */
@media (max-width: 768px) {
  .comments-page { gap: 10px; }
  .toolbar-card {
    flex-direction: column;
    align-items: stretch;
    padding: 10px;
  }
  .toolbar-left { gap: 6px; }
  .toolbar-left .n-select,
  .toolbar-left .n-input { width: 100% !important; }
  .toolbar-left .n-button { align-self: flex-start; }
  .batch-bar { flex-wrap: wrap; justify-content: flex-start; }
  .pagination-bar {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }
  .pagination-bar :deep(.n-pagination) {
    justify-content: center;
    flex-wrap: wrap;
  }
}
</style>
