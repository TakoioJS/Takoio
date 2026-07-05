<template>
  <div class="users-page">
    <!-- 工具栏 -->
    <div class="toolbar-card">
      <div class="toolbar-row">
        <div class="toolbar-left">
          <n-input
            v-model:value="searchQuery"
            placeholder="搜索用户名或邮箱..."
            clearable
            @keyup.enter="loadUsers(1)"
          >
            <template #prefix>
              <n-icon><SearchOutline /></n-icon>
            </template>
          </n-input>
          <n-button
            type="primary"
            @click="loadUsers(1)"
          >
            搜索
          </n-button>
        </div>
        <div class="toolbar-right">
          <n-button-group>
            <n-button
              v-for="tab in filterTabs"
              :key="tab.value"
              :type="filter === tab.value ? 'primary' : 'default'"
              size="small"
              @click="filter = tab.value; loadUsers(1)"
            >
              {{ tab.label }}
            </n-button>
          </n-button-group>
        </div>
      </div>
    </div>

    <!-- 用户列表 -->
    <div class="list-card">
      <n-spin :show="loading">
        <n-empty
          v-if="!loading && users.length === 0"
          description="暂无用户"
        />
        <div
          v-for="user in users"
          :key="user.id"
          class="user-row"
        >
          <div class="user-avatar">
            <n-avatar
              v-if="user.avatar"
              :src="user.avatar"
              :size="40"
            />
            <n-avatar
              v-else
              :size="40"
              :style="{ background: avatarColor(user.email) }"
            >
              {{ user.name.charAt(0).toUpperCase() }}
            </n-avatar>
          </div>
          <div class="user-info">
            <div class="user-name">
              {{ user.name }}
              <n-tag
                v-if="user.role === 'banned'"
                :bordered="false"
                type="error"
                size="tiny"
              >
                已封禁
              </n-tag>
            </div>
            <div class="user-meta">
              <span>{{ user.email }}</span>
              <span class="meta-sep">·</span>
              <span>{{ providerLabel(user.provider) }}</span>
              <span class="meta-sep">·</span>
              <span>登录 {{ user.loginCount }} 次</span>
              <span class="meta-sep">·</span>
              <span>最后活跃 {{ formatTime(user.lastLoginAt) }}</span>
            </div>
          </div>
          <div class="user-actions">
            <n-button
              v-if="user.role !== 'banned'"
              size="tiny"
              type="warning"
              @click="handleBan(user)"
            >
              封禁
            </n-button>
            <n-button
              v-else
              size="tiny"
              type="primary"
              @click="handleUnban(user)"
            >
              解封
            </n-button>
          </div>
        </div>
      </n-spin>
    </div>

    <!-- 分页 -->
    <div
      v-if="total > 0"
      class="pagination-bar"
    >
      <n-pagination
        :page="page"
        :page-size="pageSize"
        :item-count="total"
        @update:page="loadUsers"
      />
      <span class="pagination-info">共 {{ total }} 人</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { SearchOutline } from '@vicons/ionicons5'
import { usersApi, type UserItem } from '../../api/users'
import { useDialog } from 'naive-ui'

const dialog = useDialog()

const filterTabs = [
  { label: '全部', value: '' },
  { label: '正常', value: 'user' },
  { label: '已封禁', value: 'banned' },
]

const loading = ref(false)
const users = ref<UserItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const searchQuery = ref('')
const filter = ref('')

async function loadUsers (p?: number) {
  if (p) page.value = p
  loading.value = true
  try {
    const result = await usersApi.list(page.value, pageSize.value, searchQuery.value, filter.value)
    users.value = result.data
    total.value = result.total
  } finally {
    loading.value = false
  }
}

function providerLabel (provider: string): string {
  const map: Record<string, string> = { github: 'GitHub', google: 'Google', email: '邮箱' }
  return map[provider] || provider
}

function avatarColor (email: string): string {
  const colors = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f97316']
  let hash = 0
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

function formatTime (ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`
  return new Date(ts).toLocaleDateString()
}

function handleBan (user: UserItem) {
  dialog.warning({
    title: '封禁用户',
    content: `确定要封禁 "${user.name}"（${user.email}）？该用户将无法再提交评论。`,
    positiveText: '确定封禁',
    negativeText: '取消',
    onPositiveClick: async () => {
      await usersApi.ban(user.id)
      await loadUsers()
    },
  })
}

function handleUnban (user: UserItem) {
  dialog.info({
    title: '解封用户',
    content: `确定要解封 "${user.name}"（${user.email}）？`,
    positiveText: '确定解封',
    negativeText: '取消',
    onPositiveClick: async () => {
      await usersApi.unban(user.id)
      await loadUsers()
    },
  })
}

onMounted(() => loadUsers())
</script>

<style scoped>
.users-page {
  max-width: 1200px;
  margin: 0 auto;
}

.toolbar-card {
  background: var(--paper);
  border: 1px solid var(--edge-soft);
  border-radius: var(--r-card);
  padding: 16px 20px;
  margin-bottom: 16px;
  box-shadow: var(--shadow-paper);
}

.toolbar-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 200px;
}

.toolbar-right {
  flex-shrink: 0;
}

.list-card {
  background: var(--paper);
  border: 1px solid var(--edge-soft);
  border-radius: var(--r-card);
  box-shadow: var(--shadow-paper);
  overflow: hidden;
}

.user-row {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  gap: 14px;
  border-bottom: 1px solid var(--edge-softer);
  transition: background 0.15s;
}

.user-row:last-child {
  border-bottom: none;
}

.user-row:hover {
  background: var(--edge-soft);
}

.user-avatar {
  flex-shrink: 0;
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--ink);
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
}

.user-meta {
  font-size: 12px;
  color: var(--ink-soft);
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.meta-sep {
  color: var(--edge-strong);
}

.user-actions {
  flex-shrink: 0;
}

.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 16px;
  padding: 12px 20px;
  background: var(--paper);
  border: 1px solid var(--edge-soft);
  border-radius: var(--r-card);
  box-shadow: var(--shadow-paper);
}

.pagination-info {
  font-size: 12px;
  color: var(--ink-soft);
}

@media (max-width: 768px) {
  .toolbar-row {
    flex-direction: column;
    align-items: stretch;
  }

  .toolbar-right {
    display: flex;
    justify-content: center;
  }

  .user-row {
    flex-wrap: wrap;
    gap: 10px;
  }

  .user-actions {
    width: 100%;
    display: flex;
    justify-content: flex-end;
  }
}
</style>