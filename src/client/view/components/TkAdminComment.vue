<template>
  <div class="tk-admin-comment">
    <!-- 工具栏 -->
    <div class="tk-ac-toolbar">
      <el-select v-model="filter" size="small" style="width:80px" @change="onFilterChange">
        <el-option value="all" :label="t('all')" />
        <el-option value="visible" :label="t('show')" />
        <el-option value="hidden" :label="t('hide')" />
        <el-option value="spam" :label="t('spam')" />
        <el-option value="pending" :label="t('pending')" />
      </el-select>
      <el-input
        v-model="search"
        size="small"
        :placeholder="t('search') + ' (' + t('searchAll') + ')'"
        clearable
        style="width:200px"
        @input="onSearchDebounced"
        @clear="onSearchClear"
      />
      <el-button size="small" :icon="Refresh" @click="loadComments" circle />
      <span v-if="selectedIds.length > 0" class="tk-ac-batch">
        <el-button size="small" @click="batchHide">{{ t('batchHide') }}({{ selectedIds.length }})</el-button>
        <el-button size="small" @click="batchShow">{{ t('batchShow') }}</el-button>
        <el-button size="small" type="danger" @click="batchDelete">{{ t('batchDelete') }}</el-button>
      </span>
    </div>

    <div v-loading="loading" class="tk-ac-list">
      <div v-if="comments.length === 0 && !loading" class="tk-ac-empty">
        {{ t('noComment') }}
      </div>

      <div
        v-for="item in comments"
        :key="item.id"
        :class="['tk-ac-item', { 'tk-ac-selected': selectedIds.includes(item.id) }]"
        @click.ctrl="toggleSelect(item)"
        @click.meta="toggleSelect(item)"
      >
        <el-checkbox
          :model-value="selectedIds.includes(item.id)"
          size="small"
          class="tk-ac-check"
          @change="toggleSelect(item)"
        />
        <span :class="['tk-ac-dot', stateClass(item)]" />

        <img
          :src="getAvatar(item)"
          class="tk-ac-avatar"
          :alt="item.nick"
          @error="onImgError"
        />

        <div class="tk-ac-body">
          <div class="tk-ac-row1">
            <span class="tk-ac-name">{{ item.nick }}</span>
            <span v-if="item.mail" class="tk-ac-mail">{{ item.mail }}</span>
            <span class="tk-ac-url" :title="item.url">{{ item.url }}</span>
            <span class="tk-ac-time">{{ formatTime(item.created) }}</span>
          </div>
          <div class="tk-ac-content tk-content" v-html="item.renderedComment || item.comment" />
          <div class="tk-ac-meta">
            <span class="tk-ac-meta-item">
              <div :title="item.ua" style="font-size: 12px; line-height: 1.5;">
                <TkUa v-if="item.ua" :ua="item.ua" />
                <span v-else>-</span>
              </div>
            </span>
            <span class="tk-ac-meta-item tk-ac-ip-wrap">
              <el-tag v-if="item.ipRegion" size="small" class="tk-ac-region" type="success">{{ item.ipRegion }}</el-tag>
              <el-tag size="small" type="info" class="tk-ac-ip">{{ item.ip || '-' }}</el-tag>
              <el-button v-if="!item.ipRegion && item.ip" size="small" link :icon="RefreshRight" @click="refreshRegion(item)" :title="t('refreshIpRegion')"></el-button>
            </span>
          </div>
          <div class="tk-ac-actions">
            <el-button link size="small" @click="viewComment(item)">{{ t('view') }}</el-button>
            <el-button link size="small" type="primary" @click="openEdit(item)">{{ t('edit') }}</el-button>
            <el-button link size="small" @click="toggleTop(item)">{{ item.isTop ? t('unpin') : t('pin') }}</el-button>
            <el-button link size="small" @click="toggleHide(item)">
              {{ item.state === 'hidden' ? t('show') : t('hide') }}
            </el-button>
            <el-button link size="small" type="danger" @click="onDeleteOne(item)">
              {{ t('delete') }}
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <div class="tk-ac-pagination">
      <span class="tk-ac-total">{{ t('total') }}: {{ total }}</span>
      <el-pagination
        v-model:current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="prev, pager, next"
        size="small"
        @current-change="loadComments"
      />
    </div>

    <!-- 编辑对话框 -->
    <el-dialog v-model="editVisible" :title="t('editComment')" width="500px">
      <el-form label-width="60px" size="small">
        <el-form-item :label="t('nickname')">
          <el-input v-model="editForm.nick" />
        </el-form-item>
        <el-form-item :label="t('email')">
          <el-input v-model="editForm.mail" />
        </el-form-item>
        <el-form-item :label="t('link')">
          <el-input v-model="editForm.link" />
        </el-form-item>
        <el-form-item :label="t('commentContent')">
          <el-input v-model="editForm.comment" type="textarea" :rows="6" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="editVisible = false" size="small">{{ t('cancel') }}</el-button>
          <el-button type="primary" @click="saveEdit" :loading="editSaving" size="small">{{ t('save') }}</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Monitor, RefreshRight } from '@element-plus/icons-vue'
import { t, adminRequest, request } from '../../utils'
import { renderMarkdown } from '../../utils/marked'
import type { Comment, TakoioConfig } from '../../types'
import TkUa from './TkUa.vue'

interface Props {
  options: TakoioConfig
  token?: string
}

const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'expired'): void }>()

const comments = ref<Comment[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(50)
const loading = ref(false)
const search = ref('')
const filter = ref<'all' | 'visible' | 'hidden' | 'spam' | 'pending'>('all')
const selectedIds = ref<string[]>([])
let searchTimer: ReturnType<typeof setTimeout> | null = null

const formatTime = (ts: number): string => {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const stateClass = (row: Comment): string => {
  if (row.state === 'hidden') return 'tk-ac-dot-hide'
  if (row.state === 'spam' || row.isSpam) return 'tk-ac-dot-spam'
  if (row.state === 'pending') return 'tk-ac-dot-pending'
  return 'tk-ac-dot-ok'
}

const getAvatar = (item: Comment): string => {
  const base = (props.options.GRAVATAR_URL || 'https://weavatar.com/avatar/').replace(/\/+$/, '') + '/'
  const hash = item.mailMd5 || encodeURIComponent(item.nick || '?')
  return `${base}${hash}?d=identicon&s=40`
}

const onImgError = (e: Event): void => {
  (e.target as HTMLElement).style.display = 'none'
}

const onSearchClear = (): void => {
  search.value = ''
  page.value = 1
  loadComments()
}

const authAdmin = (path: string, method: string = 'GET', body?: any): Promise<any> => {
  return adminRequest(props.options.envId, props.token || '', path, method, body)
}

const loadComments = async (): Promise<void> => {
  loading.value = true
  try {
    console.log('[Takoio Admin] 加载评论，token:', props.token ? '已提供' : '无')
    const qs = new URLSearchParams({ page: String(page.value), pageSize: String(pageSize.value) })
    if (search.value) qs.set('search', search.value)
    if (filter.value && filter.value !== 'all') qs.set('filter', filter.value)
    const r = await authAdmin(`/api/comments/admin?${qs}`)
    console.log('[Takoio Admin] 评论数据:', r)
    const data = r.data || []
    for (const item of data) {
      if (item.comment) {
        item.renderedComment = await renderMarkdown(item.comment)
      }
    }
    comments.value = data
    total.value = r.total || 0
  } catch (e) {
    console.error('[Takoio Admin] 加载评论失败:', e)
    if ((e as any)?.message?.includes('权限')) emit('expired')
  }
  finally { loading.value = false }
}

const onSearchDebounced = (): void => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { page.value = 1; loadComments() }, 300)
}

const viewComment = (item: Comment): void => {
  const href = item.href || item.url
  if (href) window.open(href, '_blank')
}

const toggleSelect = (item: Comment): void => {
  const idx = selectedIds.value.indexOf(item.id)
  if (idx >= 0) selectedIds.value.splice(idx, 1)
  else selectedIds.value.push(item.id)
}

const toggleHide = async (row: Comment): Promise<void> => {
  try {
    const hide = row.state !== 'hidden'
    await authAdmin(`/api/comments/${row.id}/hide`, 'PATCH', { hide })
    row.state = hide ? 'hidden' : 'visible'
    ElMessage.success(t('submitSuccess'))
  } catch (e: any) {
    ElMessage.error(t('operationFailed') + ': ' + (e?.message || ''))
  }
}

const onDeleteOne = async (row: Comment): Promise<void> => {
  try { await ElMessageBox.confirm(t('confirmDelete'), t('confirm'), { type: 'warning' }) }
  catch { return /* user cancelled */ }

  try {
    await authAdmin(`/api/comments/${row.id}`, 'DELETE')
    ElMessage.success(t('submitSuccess'))
    loadComments()
  } catch (e: any) {
    ElMessage.error(t('operationFailed') + ': ' + (e?.message || '删除失败'))
  }
}

const batchHide = async (): Promise<void> => {
  try {
    for (const id of selectedIds.value) await authAdmin(`/api/comments/${id}/hide`, 'PATCH', { hide: true })
    selectedIds.value = []; loadComments()
  } catch (e: any) {
    ElMessage.error(t('operationFailed') + ': ' + (e?.message || ''))
  }
}
const batchShow = async (): Promise<void> => {
  try {
    for (const id of selectedIds.value) await authAdmin(`/api/comments/${id}/hide`, 'PATCH', { hide: false })
    selectedIds.value = []; loadComments()
  } catch (e: any) {
    ElMessage.error(t('operationFailed') + ': ' + (e?.message || ''))
  }
}
const batchDelete = async (): Promise<void> => {
  try { await ElMessageBox.confirm(`${t('confirmBatchDelete')} (${selectedIds.value.length})`, t('confirm'), { type: 'warning' }) }
  catch { return /* user cancelled */ }

  try {
    for (const id of selectedIds.value) await authAdmin(`/api/comments/${id}`, 'DELETE')
    selectedIds.value = []; ElMessage.success(t('submitSuccess')); loadComments()
  } catch (e: any) {
    ElMessage.error(t('operationFailed') + ': ' + (e?.message || '批量删除失败'))
  }
}

const onFilterChange = (): void => { page.value = 1; loadComments() }

const editVisible = ref(false)
const editSaving = ref(false)
const editForm = ref({
  id: '',
  nick: '',
  mail: '',
  link: '',
  comment: ''
})
let editingItem: Comment | null = null

const openEdit = (item: Comment) => {
  editingItem = item
  editForm.value = {
    id: item.id,
    nick: item.nick,
    mail: item.mail || '',
    link: item.link || '',
    comment: item.comment || ''
  }
  editVisible.value = true
}

const saveEdit = async () => {
  editSaving.value = true
  try {
    await authAdmin(`/api/comments/${editForm.value.id}`, 'PUT', editForm.value)
    ElMessage.success(t('saveSuccess'))
    editVisible.value = false
    if (editingItem) {
      editingItem.nick = editForm.value.nick
      editingItem.mail = editForm.value.mail
      editingItem.link = editForm.value.link
      editingItem.comment = editForm.value.comment
    }
  } catch (e: any) {
    ElMessage.error(t('saveFailed') + ': ' + e.message)
  } finally {
    editSaving.value = false
  }
}

const toggleTop = async (row: Comment) => {
  try {
    const isTop = !row.isTop
    await authAdmin(`/api/comments/${row.id}/top`, 'PATCH', { isTop })
    row.isTop = isTop
    ElMessage.success(t('operationSuccess'))
  } catch (e: any) {
    ElMessage.error(t('operationFailed') + ': ' + e.message)
  }
}

const refreshRegion = async (row: Comment) => {
  try {
    const r = await authAdmin(`/api/comments/${row.id}/ip-region`)
    if ((r as any)?.ipRegion) {
      row.ipRegion = (r as any).ipRegion
      ElMessage.success(t('regionRefreshed'))
    } else {
      ElMessage.info(t('regionNotFound'))
    }
  } catch (e: any) {
    ElMessage.error('刷新失败: ' + e.message)
  }
}

onMounted(() => { loadComments() })
</script>

<style scoped>
.tk-admin-comment { background: #fff; border-radius: 8px; padding: 16px; }

.tk-ac-toolbar {
  display: flex; align-items: center; flex-wrap: wrap; gap: 6px;
  margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid var(--tk-admin-border);
}
.tk-ac-batch { display: flex; gap: 4px; margin-left: auto; }

.tk-ac-list { min-height: 200px; }
.tk-ac-empty {
  text-align: center; padding: 60px 0; color: var(--tk-admin-text-secondary); font-size: 14px;
}

.tk-ac-item {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px 12px; border-bottom: 1px solid var(--tk-admin-border);
  transition: background .15s; cursor: default;
}
.tk-ac-item:hover { background: #f8fafc; }
.tk-ac-selected { background: var(--tk-brand-light); }

.tk-ac-check { margin-top: 3px; flex-shrink: 0; }
.tk-ac-dot {
  width: 8px; height: 8px; border-radius: 50%; margin-top: 7px; flex-shrink: 0;
}
.tk-ac-avatar {
  width: 28px; height: 28px; border-radius: 50%; margin-top: 2px; flex-shrink: 0;
  object-fit: cover; background: #f8fafc;
}
.tk-ac-dot-ok { background: #22c55e; }
.tk-ac-dot-hide { background: #f59e0b; }
.tk-ac-dot-spam { background: #ef4444; }
.tk-ac-dot-pending { background: #94a3b8; }

.tk-ac-body { flex: 1; min-width: 0; }
.tk-ac-row1 {
  display: flex; align-items: center; gap: 8px; margin-bottom: 4px;
}
.tk-ac-name { font-weight: 600; font-size: 13px; color: var(--tk-admin-text); }
.tk-ac-mail { font-size: 11px; color: var(--tk-admin-text-secondary); }
.tk-ac-url {
  font-size: 12px; color: var(--tk-brand); margin-left: auto;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 150px;
}
.tk-ac-time { font-size: 11px; color: var(--tk-admin-text-secondary); white-space: nowrap; }

.tk-ac-content {
  font-size: 13px; color: var(--tk-admin-text-secondary); line-height: 1.6;
  word-break: break-word;
}
.tk-ac-content :deep(p) { margin: 0; display: inline; }
.tk-ac-content :deep(img) { max-height: 32px; vertical-align: middle; border-radius: 2px; }

.tk-ac-meta {
  margin-top: 3px; font-size: 11px; color: var(--tk-admin-text-secondary);
  display: flex; gap: 12px; align-items: center; flex-wrap: wrap;
}
.tk-ac-meta-item {
  display: flex; gap: 3px; align-items: center;
}
.tk-ac-meta-item .el-icon { font-size: 12px; }
.tk-ac-ip-wrap { gap: 4px; }
.tk-ac-ip { font-family: monospace; font-size: 11px; }
.tk-ac-region { margin-left: 0; font-size: 11px; }

.tk-ac-actions { margin-top: 6px; }
.tk-ac-actions .el-button { font-size: 12px; }

.tk-ac-pagination {
  display: flex; justify-content: space-between; align-items: center;
  margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--tk-admin-border);
}
.tk-ac-total { font-size: 13px; color: var(--tk-admin-text-secondary); }
</style>
