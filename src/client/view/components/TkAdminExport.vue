<template>
  <div class="tk-admin-export">
    <h3>{{ t('export') }}</h3>
    <p class="tk-export-desc">{{ t('exportDesc') }}</p>
    <div class="tk-export-btns">
      <el-button @click="onExport('takoio')" :loading="exporting" :icon="Download">
        {{ t('exportJson') }}
      </el-button>
      <el-button @click="onExport('csv')" :loading="exporting" :icon="Download">
        {{ t('exportCsv') }}
      </el-button>
    </div>
    <div v-if="exportLog" class="tk-admin-log" style="margin-top: 16px; padding: 10px; background: var(--tk-admin-bg-secondary, #f5f5f5); border-radius: 4px; font-family: monospace; font-size: 12px; color: var(--tk-admin-text-secondary, #666); white-space: pre-wrap; max-height: 200px; overflow-y: auto;">{{ exportLog }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElButton, ElMessage } from 'element-plus'
import { Download } from '@element-plus/icons-vue'
import { t, adminRequest } from '../../utils'
import type { TakoioConfig } from '../../types'

interface Props {
  options: TakoioConfig
  token?: string
}

const props = defineProps<Props>()
const exporting = ref(false)
const exportLog = ref('')

const downloadFile = (content: string, filename: string, type: string): void => {
  const blob = new Blob(['\uFEFF' + content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

const formatJson = (data: any): string => {
  return JSON.stringify(data, null, 2)
}

const formatCsv = (comments: any[]): string => {
  const headers = ['id', 'url', 'nick', 'mail', 'link', 'comment', 'pid', 'rid', 'ua', 'ip', 'state', 'created', 'like']
  const escapeCsv = (v: any): string => '"' + String(v ?? '').replace(/"/g, '""').replace(/\n/g, '\\n') + '"'
  const lines = [headers.join(',')]
  for (const c of comments) {
    lines.push(headers.map(h => escapeCsv(c[h])).join(','))
  }
  return lines.join('\n')
}

const onExport = async (format: 'json' | 'csv' | 'takoio'): Promise<void> => {
  exporting.value = true
  exportLog.value = `开始导出 ${format} 格式数据...`
  try {
    const result = await adminRequest(props.options.envId, props.token || '', `/api/admin/export?format=${format}`)

    const dataToExport = (result as any).data || []
    const now = new Date().toISOString().slice(0, 10)
    const filename = `takoio-export-${now}.${format === 'csv' ? 'csv' : 'json'}`

    if (format === 'csv') {
      downloadFile(formatCsv(dataToExport), filename, 'text/csv')
    } else {
      downloadFile(formatJson(dataToExport), filename, 'application/json')
    }
    const total = (result as any).total || (Array.isArray(dataToExport) ? dataToExport.length : Object.keys(dataToExport).length)
    ElMessage.success(`导出成功，共包含 ${total} 条数据`)
    exportLog.value += `\n导出成功！数据量: ${total}`
    if (format === 'takoio') {
      exportLog.value += `\n导出了 Takoio 数据，包含文章反应、访客等，但不包含后台设置。`
    }
  } catch (e: any) {
    ElMessage.error(t('submitFailed'))
    exportLog.value += `\n导出失败：${e.message}`
  } finally {
    exporting.value = false
  }
}
</script>

<style scoped>
.tk-admin-export {
  background: #fff; border-radius: 8px; padding: 16px;
}
.tk-export-desc {
  font-size: 13px; color: var(--tk-admin-text-secondary); margin-bottom: 12px;
}
.tk-export-btns { display: flex; gap: 12px; }
</style>
