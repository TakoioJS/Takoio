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

          <div
            v-for="item in comments"
            :key="item.id"
            :class="['comment-item', { selected: selectedIds.includes(item.id) }]"
          >
            <n-checkbox
              :checked="selectedIds.includes(item.id)"
              size="small"
              class="comment-check"
              @update:checked="toggleSelect(item)"
            />
            <div class="avatar-wrap">
              <img
                :src="getAvatar(item)"
                class="comment-avatar"
                :alt="item.nick"
                @error="onImgError"
              >
              <span
                :class="['status-dot', stateClass(item)]"
                :title="stateLabel(item)"
              />
            </div>

            <div class="comment-body">
              <!-- 头部：昵称 + 状态标签 + 时间 -->
              <div class="comment-head">
                <div class="head-left">
                  <span class="comment-name">{{ item.nick }}</span>
                  <div class="status-tags">
                    <n-tag
                      v-if="item.isMaster"
                      size="tiny"
                      type="success"
                      round
                    >
                      博主
                    </n-tag>
                    <n-tag
                      v-if="item.isTop"
                      size="tiny"
                      type="warning"
                      round
                    >
                      置顶
                    </n-tag>
                    <n-tag
                      v-if="item.state === 'pending'"
                      size="tiny"
                      type="default"
                      round
                    >
                      待审
                    </n-tag>
                    <n-tag
                      v-else-if="item.state === 'hidden'"
                      size="tiny"
                      type="warning"
                      round
                    >
                      隐藏
                    </n-tag>
                    <n-tag
                      v-else-if="item.isSpam"
                      size="tiny"
                      type="error"
                      round
                    >
                      垃圾
                    </n-tag>
                  </div>
                </div>
                <span class="comment-time">{{ formatTime(item.created) }}</span>
              </div>

              <!-- 联系方式行 -->
              <div
                v-if="item.mail || item.link"
                class="comment-contact"
              >
                <span
                  v-if="item.mail"
                  class="contact-item"
                >
                  <n-icon size="11"><MailOutline /></n-icon>
                  <span class="contact-text">{{ item.mail }}</span>
                </span>
                <a
                  v-if="item.link"
                  :href="item.link"
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  class="contact-item contact-link"
                  :title="item.link"
                >
                  <n-icon size="11"><LinkOutline /></n-icon>
                  <span class="contact-text">{{ item.link }}</span>
                </a>
              </div>

              <!-- 原文链接 -->
              <div
                v-if="item.url || item.href"
                class="comment-source"
              >
                <n-icon size="11">
                  <DocumentTextOutline />
                </n-icon>
                <a
                  :href="sourceUrl(item)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="source-link"
                  :title="item.url"
                >
                  {{ item.url }}
                </a>
              </div>

              <!-- 评论内容 -->
              <div
                class="comment-content"
                v-html="(item as any)._safeContent || ''"
              />

              <!-- 底部信息行 -->
              <div class="comment-meta">
                <TkUa
                  v-if="item.ua"
                  :ua="item.ua"
                  class="meta-ua"
                />
                <span
                  v-if="item.ua && (item.ipRegion || isValidIp(item.ip))"
                  class="meta-divider"
                >·</span>
                <span
                  v-if="item.ipRegion"
                  class="meta-item"
                >
                  <n-tag
                    size="tiny"
                    type="success"
                    round
                  >{{ item.ipRegion }}</n-tag>
                </span>
                <span
                  v-if="isValidIp(item.ip)"
                  class="meta-item"
                >
                  <n-tag
                    size="tiny"
                    round
                  >{{ item.ip }}</n-tag>
                </span>
                <n-button
                  v-if="!item.ipRegion && isValidIp(item.ip)"
                  size="tiny"
                  quaternary
                  circle
                  title="解析IP归属地"
                  @click="refreshRegion(item)"
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
                <n-button
                  v-if="item.state === 'pending'"
                  size="tiny"
                  type="success"
                  secondary
                  @click="approveOne(item)"
                >
                  通过
                </n-button>
                <n-button
                  size="tiny"
                  type="primary"
                  secondary
                  @click="openReply(item)"
                >
                  回复
                </n-button>
                <n-button
                  size="tiny"
                  secondary
                  @click="openEdit(item)"
                >
                  编辑
                </n-button>
                <n-button
                  size="tiny"
                  secondary
                  @click="toggleTop(item)"
                >
                  {{ item.isTop ? '取消置顶' : '置顶' }}
                </n-button>
                <n-button
                  size="tiny"
                  secondary
                  @click="toggleHide(item)"
                >
                  {{ item.state === 'hidden' ? '显示' : '隐藏' }}
                </n-button>
                <n-button
                  size="tiny"
                  :type="item.isSpam ? 'warning' : 'error'"
                  secondary
                  @click="toggleSpam(item)"
                >
                  {{ item.isSpam ? '取消垃圾' : '标垃圾' }}
                </n-button>
                <n-button
                  size="tiny"
                  type="error"
                  secondary
                  @click="onDeleteOne(item)"
                >
                  删除
                </n-button>
              </div>
            </div>
          </div>
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
    <n-modal
      v-model:show="editVisible"
      preset="card"
      title="编辑评论"
      style="max-width: 520px;"
    >
      <n-form
        label-placement="left"
        label-width="60"
      >
        <n-form-item label="昵称">
          <n-input v-model:value="editForm.nick" />
        </n-form-item>
        <n-form-item label="邮箱">
          <n-input v-model:value="editForm.mail" />
        </n-form-item>
        <n-form-item label="链接">
          <n-input v-model:value="editForm.link" />
        </n-form-item>
        <n-form-item label="内容">
          <n-input
            v-model:value="editForm.comment"
            type="textarea"
            :rows="6"
          />
        </n-form-item>
      </n-form>
      <template #footer>
        <div style="display: flex; justify-content: flex-end; gap: 8px;">
          <n-button
            size="small"
            @click="editVisible = false"
          >
            取消
          </n-button>
          <n-button
            size="small"
            type="primary"
            :loading="editSaving"
            @click="saveEdit"
          >
            保存
          </n-button>
        </div>
      </template>
    </n-modal>

    <!-- 回复 Modal -->
    <n-modal
      v-model:show="replyVisible"
      preset="card"
      title="回复评论"
      style="max-width: 520px;"
    >
      <div
        v-if="replyTarget"
        class="reply-quote"
      >
        <div class="quote-meta">
          <span class="quote-name">{{ replyTarget.nick }}</span>
          <span class="quote-time">{{ formatTime(replyTarget.created) }}</span>
        </div>
        <div
          class="quote-content"
          v-html="(replyTarget as any)._safeContent || ''"
        />
      </div>
      <n-form
        label-placement="left"
        label-width="60"
      >
        <n-form-item label="昵称">
          <n-input
            v-model:value="replyForm.nick"
            placeholder="博主"
          />
        </n-form-item>
        <n-form-item label="邮箱">
          <n-input
            v-model:value="replyForm.mail"
            placeholder="博主邮箱（选填）"
          />
        </n-form-item>
        <n-form-item label="回复">
          <n-input
            v-model:value="replyForm.comment"
            type="textarea"
            :rows="5"
            placeholder="输入回复内容..."
          />
        </n-form-item>
      </n-form>
      <template #footer>
        <div style="display: flex; justify-content: flex-end; gap: 8px;">
          <n-button
            size="small"
            @click="replyVisible = false"
          >
            取消
          </n-button>
          <n-button
            size="small"
            type="primary"
            :loading="replySaving"
            @click="saveReply"
          >
            发送回复
          </n-button>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import {
  NSelect, NInput, NButton, NIcon, NCheckbox, NTag, NSpin,
  NPagination, NModal, NForm, NFormItem, useMessage, useDialog,
} from 'naive-ui'
import {
  RefreshOutline, RefreshCircleOutline, SearchOutline, ChatbubblesOutline,
  LinkOutline, DocumentTextOutline, MailOutline,
} from '@vicons/ionicons5'
import { useRoute, useRouter } from 'vue-router'
import { commentsApi } from '../../api/comments'
import { renderMarkdown } from '@shared/utils/marked'
import type { Comment } from '@shared/types'
import TkUa from '@shared/view/components/TkUa.vue'

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

const formatTime = (ts: number): string => {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
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

const getAvatar = (item: Comment): string => {
  const base = 'https://weavatar.com/avatar/'
  const hash = item.mailMd5 || encodeURIComponent(item.nick || '?')
  return `${base}${hash}?d=identicon&s=40`
}

const sourceUrl = (item: Comment): string => {
  return item.href || item.url || '#'
}

const isValidIp = (ip: string | undefined | null): boolean => {
  if (!ip || typeof ip !== 'string') return false
  const trimmed = ip.trim()
  if (!trimmed) return false
  // IPv4
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(trimmed)) {
    return trimmed.split('.').every(n => {
      const num = Number(n)
      return num >= 0 && num <= 255
    })
  }
  // IPv6 (简化校验)
  return /^[0-9a-fA-F:]+$/.test(trimmed) && trimmed.includes(':')
}

const onImgError = (e: Event) => { (e.target as HTMLElement).style.display = 'none' }
const onSearchClear = () => { search.value = ''; page.value = 1; loadComments() }

const loadComments = async () => {
  loading.value = true
  try {
    const params: Record<string, any> = { page: page.value, pageSize: pageSize.value }
    if (search.value) params.search = search.value
    if (filter.value !== 'all') params.filter = filter.value
    const r = await commentsApi.list(params)
    const data = r.data || []
    await Promise.all(data.map(async (item: Comment) => {
      (item as any)._safeContent = await renderMarkdown(item.renderedComment || item.comment || '')
    }))
    comments.value = data
    total.value = r.total || 0
  } catch (e: any) {
    message.error('加载失败: ' + (e.message || ''))
  } finally {
    loading.value = false
  }
}

const onSearchDebounced = () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { page.value = 1; loadComments() }, 300)
}

const toggleSelect = (item: Comment) => {
  const idx = selectedIds.value.indexOf(item.id)
  if (idx >= 0) selectedIds.value.splice(idx, 1)
  else selectedIds.value.push(item.id)
}

const toggleHide = async (row: Comment) => {
  try {
    const hide = row.state !== 'hidden'
    await commentsApi.hide(row.id, hide)
    row.state = hide ? 'hidden' : 'visible'
    message.success('操作成功')
  } catch (e: any) {
    message.error('操作失败: ' + (e.message || ''))
  }
}

const toggleSpam = async (row: Comment) => {
  try {
    const isSpam = !row.isSpam
    await commentsApi.setSpam(row.id, isSpam)
    row.isSpam = isSpam
    row.state = isSpam ? 'spam' : 'visible'
    message.success('操作成功')
  } catch (e: any) {
    message.error('操作失败: ' + (e.message || ''))
  }
}

const approveOne = async (row: Comment) => {
  try {
    await commentsApi.approve(row.id)
    row.state = 'visible'
    message.success('已通过审核')
  } catch (e: any) {
    message.error('操作失败: ' + (e.message || ''))
  }
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
        message.success('已删除')
        loadComments()
      } catch (e: any) {
        message.error('删除失败: ' + (e.message || ''))
      }
    },
  })
}

const batchHide = async () => {
  try {
    await commentsApi.batchHide(selectedIds.value, true)
    selectedIds.value = []
    loadComments()
    message.success('操作成功')
  } catch (e: any) { message.error('操作失败: ' + (e.message || '')) }
}

const batchShow = async () => {
  try {
    await commentsApi.batchHide(selectedIds.value, false)
    selectedIds.value = []
    loadComments()
    message.success('操作成功')
  } catch (e: any) { message.error('操作失败: ' + (e.message || '')) }
}

const batchSpam = async () => {
  try {
    await commentsApi.batchSpam(selectedIds.value, true)
    selectedIds.value = []
    loadComments()
    message.success('已标记为垃圾')
  } catch (e: any) { message.error('操作失败: ' + (e.message || '')) }
}

const batchApprove = async () => {
  try {
    await commentsApi.batchApprove(selectedIds.value)
    selectedIds.value = []
    loadComments()
    message.success('已通过审核')
  } catch (e: any) { message.error('操作失败: ' + (e.message || '')) }
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
        message.success('删除成功')
        loadComments()
      } catch (e: any) {
        message.error('删除失败: ' + (e.message || ''))
      }
    },
  })
}

const onFilterChange = () => {
  page.value = 1
  // 同步到 URL query，便于从 Dashboard 等页面带筛选跳转
  router.replace({ query: { ...route.query, filter: filter.value } }).catch(() => {})
  loadComments()
}
const onPageSizeChange = (size: number) => { pageSize.value = size; page.value = 1; loadComments() }

// ===== 编辑 =====
const editVisible = ref(false)
const editSaving = ref(false)
const editForm = ref({ id: '', nick: '', mail: '', link: '', comment: '' })
const openEdit = (item: Comment) => {
  editForm.value = { id: item.id, nick: item.nick, mail: item.mail || '', link: item.link || '', comment: item.comment || '' }
  editVisible.value = true
}

const saveEdit = async () => {
  editSaving.value = true
  try {
    await commentsApi.update(editForm.value.id, editForm.value)
    message.success('保存成功')
    editVisible.value = false
    loadComments()
  } catch (e: any) {
    message.error('保存失败: ' + (e.message || ''))
  } finally {
    editSaving.value = false
  }
}

// ===== 回复 =====
const replyVisible = ref(false)
const replySaving = ref(false)
const replyTarget = ref<Comment | null>(null)
const replyForm = ref({ nick: '', mail: '', comment: '' })

const openReply = (item: Comment) => {
  replyTarget.value = item
  replyForm.value = { nick: '', mail: '', comment: '' }
  replyVisible.value = true
}

const saveReply = async () => {
  if (!replyTarget.value) return
  if (!replyForm.value.comment.trim()) { message.warning('请输入回复内容'); return }
  if (!replyForm.value.nick.trim()) { message.warning('请输入昵称'); return }
  replySaving.value = true
  try {
    const target = replyTarget.value
    await commentsApi.reply({
      url: target.url || '/',
      href: target.href || target.url || '',
      nick: replyForm.value.nick,
      mail: replyForm.value.mail,
      comment: replyForm.value.comment,
      pid: target.id,
      rid: target.rid || target.id,
      ua: navigator.userAgent,
      title: '',
    })
    message.success('回复成功')
    replyVisible.value = false
    loadComments()
  } catch (e: any) {
    message.error('回复失败: ' + (e.message || ''))
  } finally {
    replySaving.value = false
  }
}

const toggleTop = async (row: Comment) => {
  try {
    await commentsApi.toggleTop(row.id, !row.isTop)
    row.isTop = !row.isTop
    message.success('操作成功')
  } catch (e: any) {
    message.error('操作失败: ' + (e.message || ''))
  }
}

const refreshRegion = async (row: Comment) => {
  try {
    const r = await commentsApi.refreshIpRegion(row.id)
    if (r.ipRegion) {
      row.ipRegion = r.ipRegion
      message.success('解析成功')
    } else {
      message.info('无法解析')
    }
  } catch (e: any) {
    message.error('操作失败: ' + (e.message || ''))
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

.comment-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--edge-soft);
  transition: background 0.2s cubic-bezier(.22,.61,.36,1);
}
.comment-item:last-child { border-bottom: none; }
.comment-item:hover {
  background: var(--edge-soft);
}
.comment-item.selected {
  background: var(--accent-soft);
}

.comment-check { margin-top: 6px; flex-shrink: 0; }

/* ---- 头像 + 状态点 ---- */
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

/* ---- 评论主体 ---- */
.comment-body { flex: 1; min-width: 0; }

/* 头部：昵称 + 标签 / 时间 */
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
.comment-name {
  font-weight: 600;
  font-size: 13.5px;
  color: var(--ink);
}
.status-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.comment-time {
  font-size: 11px;
  color: var(--ink-3);
  white-space: nowrap;
  flex-shrink: 0;
}

/* 联系方式行 */
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
  font-size: 11.5px;
  color: var(--ink-3);
  min-width: 0;
}
.contact-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 220px;
}
.contact-link {
  color: var(--accent);
  text-decoration: none;
}
.contact-link:hover { text-decoration: underline; }

/* 原文链接 */
.comment-source {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  color: var(--ink-3);
  margin-bottom: 6px;
}
.source-link {
  color: #2080f0;
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 400px;
}
.source-link:hover { text-decoration: underline; }

/* 评论内容 */
.comment-content {
  font-size: 13px;
  color: var(--ink-2);
  line-height: 1.6;
  word-break: break-word;
  margin: 2px 0 8px;
}
.comment-content :deep(p) { margin: 0; display: inline; }
.comment-content :deep(img) { max-height: 32px; vertical-align: middle; border-radius: 2px; }

/* 底部信息行 */
.comment-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 11px;
  color: var(--ink-3);
  margin-bottom: 8px;
}
.meta-item {
  display: inline-flex;
  gap: 4px;
  align-items: center;
}
.meta-ua {
  font-size: 11px;
  color: var(--ink-3);
}
.meta-divider {
  color: var(--edge);
  font-size: 10px;
}

/* 操作栏 */
.comment-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  padding-top: 8px;
  border-top: 1px dashed var(--edge-soft);
}

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

/* ---- 回复引用 ---- */
.reply-quote {
  background: var(--edge-soft);
  border-left: 3px solid var(--accent);
  padding: 10px 12px;
  border-radius: 4px;
  margin-bottom: 16px;
}
.quote-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.quote-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--ink);
}
.quote-time {
  font-size: 11px;
  color: var(--ink-3);
}
.quote-content {
  font-size: 12px;
  color: var(--ink-2);
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

/* ============ 移动端响应式 ============ */
@media (max-width: 768px) {
  .comments-page { gap: 10px; }

  .toolbar-card {
    flex-direction: column;
    align-items: stretch;
    padding: 10px;
  }
  .toolbar-left {
    gap: 6px;
  }
  .toolbar-left .n-select,
  .toolbar-left .n-input {
    width: 100% !important;
  }
  .toolbar-left .n-button {
    align-self: flex-start;
  }
  .batch-bar {
    flex-wrap: wrap;
    justify-content: flex-start;
  }

  .comment-item {
    padding: 12px 12px;
    gap: 10px;
  }
  .comment-avatar {
    width: 32px;
    height: 32px;
  }
  .source-link,
  .contact-text {
    max-width: 160px;
  }

  .comment-head {
    flex-wrap: wrap;
  }

  .comment-actions {
    gap: 4px;
  }
  .comment-actions :deep(.n-button) {
    padding: 0 8px;
  }

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

@media (max-width: 480px) {
  .comment-item {
    padding: 10px 10px;
    gap: 8px;
  }
  .comment-avatar {
    width: 30px;
    height: 30px;
  }
  .comment-content {
    font-size: 12.5px;
  }
  .comment-actions {
    gap: 4px;
  }
  .comment-actions :deep(.n-button) {
    padding: 0 6px;
    font-size: 12px;
  }
}
</style>
