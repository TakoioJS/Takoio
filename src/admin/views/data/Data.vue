<template>
  <div class="data-page">
    <div class="data-stack">
      <!-- 数据导入 -->
      <div class="data-section">
        <div class="section-header">
          <n-icon
            size="18"
            class="section-icon"
          >
            <CloudUploadOutline />
          </n-icon>
          <span class="section-title">数据导入</span>
        </div>
        <div class="section-body">
          <div class="form-field">
            <label class="form-label">导入来源</label>
            <n-select
              v-model:value="importSource"
              :options="importSourceOptions"
            />
          </div>

          <!-- 文件上传（非 Disqus） -->
          <template v-if="importSource !== 'disqus' && importSource !== 'valine'">
            <div class="form-field">
              <label class="form-label">JSON 文件</label>
              <n-upload
                :auto-upload="false"
                :show-file-list="false"
                accept=".json"
                :multiple="false"
                @change="onFileChange"
              >
                <n-upload-dragger class="upload-dragger">
                  <div class="upload-inner">
                    <n-icon
                      size="32"
                      class="upload-icon"
                    >
                      <DocumentTextOutline />
                    </n-icon>
                    <p class="upload-text">
                      {{ fileName || '点击或拖拽 JSON 文件到此处' }}
                    </p>
                    <span class="upload-hint">支持 {{ importSourceOptions.find(o => o.value === importSource)?.label }} 导出的 JSON 格式</span>
                  </div>
                </n-upload-dragger>
              </n-upload>
            </div>
          </template>

          <!-- Valine 配置 -->
          <template v-if="importSource === 'valine'">
            <div class="form-field">
              <label class="form-label">LeanCloud AppId</label>
              <n-input
                v-model:value="valineAppId"
                placeholder="LeanCloud AppId"
              />
            </div>
            <div class="form-field">
              <label class="form-label">LeanCloud AppKey</label>
              <n-input
                v-model:value="valineAppKey"
                type="password"
                show-password-on="click"
                placeholder="LeanCloud AppKey"
              />
            </div>
          </template>

          <!-- Disqus 配置 -->
          <template v-if="importSource === 'disqus'">
            <div class="form-field">
              <label class="form-label">Disqus Forum (站点名)</label>
              <n-input
                v-model:value="disqusForum"
                placeholder="your-site"
              />
            </div>
            <div class="form-field">
              <label class="form-label">Disqus API Key</label>
              <n-input
                v-model:value="disqusApiKey"
                type="password"
                show-password-on="click"
                placeholder="Disqus API Key"
              />
            </div>
          </template>

          <n-button
            type="primary"
            :loading="importing"
            :disabled="!canImport"
            @click="onImport"
          >
            <template #icon>
              <n-icon><EnterOutline /></n-icon>
            </template>
            开始导入
          </n-button>

          <div
            v-if="importResult !== null"
            class="result-box"
          >
            <n-tag
              :type="importResult > 0 ? 'success' : 'error'"
              round
            >
              {{ importResult > 0 ? `成功导入 ${importResult} 条评论` : '导入失败' }}
            </n-tag>
          </div>
          <div
            v-if="importLog"
            class="log-box"
          >
            {{ importLog }}
          </div>
        </div>
      </div>

      <!-- 数据导出 -->
      <div class="data-section">
        <div class="section-header">
          <n-icon
            size="18"
            class="section-icon"
          >
            <CloudDownloadOutline />
          </n-icon>
          <span class="section-title">数据导出</span>
        </div>
        <div class="section-body">
          <p class="tip">
            导出评论数据用于备份或迁移
          </p>

          <n-space>
            <n-button
              :loading="exporting"
              @click="exportData('json')"
            >
              <template #icon>
                <n-icon><DownloadOutline /></n-icon>
              </template>
              导出 JSON
            </n-button>
            <n-button
              :loading="exporting"
              @click="exportData('csv')"
            >
              <template #icon>
                <n-icon><DownloadOutline /></n-icon>
              </template>
              导出 CSV
            </n-button>
          </n-space>

          <div
            v-if="exportLog"
            class="log-box"
          >
            {{ exportLog }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  NInput, NSelect, NButton, NUpload, NUploadDragger, NIcon, NTag, NSpace,
  useMessage, type UploadFileInfo,
} from 'naive-ui'
import {
  CloudUploadOutline, CloudDownloadOutline, DownloadOutline,
  DocumentTextOutline, EnterOutline,
} from '@vicons/ionicons5'
import { dataApi } from '../../api/data'

const message = useMessage()

const importSource = ref('takoio')
const fileData = ref('')
const fileName = ref('')
const valineAppId = ref('')
const valineAppKey = ref('')
const disqusForum = ref('')
const disqusApiKey = ref('')
const importing = ref(false)
const importResult = ref<number | null>(null)
const importLog = ref('')

const exporting = ref(false)
const exportLog = ref('')

const importSourceOptions = [
  { label: 'Takoio', value: 'takoio' },
  { label: 'Twikoo', value: 'twikoo' },
  { label: 'Artalk', value: 'artalk' },
  { label: 'Valine', value: 'valine' },
  { label: 'Waline', value: 'waline' },
  { label: 'Disqus', value: 'disqus' },
]

const canImport = computed(() => {
  if (importSource.value === 'disqus') return !!(disqusForum.value && disqusApiKey.value)
  if (importSource.value === 'valine') return !!(valineAppId.value && valineAppKey.value)
  return !!fileData.value
})

const onFileChange = async (options: { file: UploadFileInfo }) => {
  const file = options.file?.file
  if (!file) return
  try {
    fileData.value = await file.text()
    fileName.value = file.name || ''
    message.info(`已选择文件：${fileName.value}`)
  } catch {
    message.error('文件读取失败')
  }
}

const onImport = async () => {
  importing.value = true
  importResult.value = null
  importLog.value = `开始导入 ${importSource.value} 格式数据...\n`
  try {
    const source = importSource.value
    const data: any = {}
    if (source === 'disqus') {
      data.forum = disqusForum.value
      data.apiKey = disqusApiKey.value
    } else if (source === 'valine') {
      data.appId = valineAppId.value
      data.appKey = valineAppKey.value
    } else {
      data.json = JSON.parse(fileData.value)
    }
    const result = await dataApi.import(source, data)
    const count = result.count || 0
    if (count > 0) {
      importResult.value = count
      message.success(`成功导入 ${count} 条评论`)
      importLog.value += `导入成功！处理记录数：${count}\n`
      if (source === 'takoio') {
        importLog.value += '已恢复 Takoio 数据（包含文章反应、访客等），未覆盖现有后台配置。'
      }
    } else {
      importResult.value = -1
      message.error(result.error || '导入失败')
      importLog.value += `导入失败：${result.error || '未知错误'}`
    }
  } catch (e: any) {
    importResult.value = -1
    message.error('导入失败: ' + (e.message || ''))
    importLog.value += `导入请求失败：${e.message}\n`
  } finally {
    importing.value = false
  }
}

const downloadFile = (content: string, filename: string, type: string) => {
  const blob = new Blob(['\uFEFF' + content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const formatCsv = (comments: any[]): string => {
  const headers = ['id', 'url', 'nick', 'mail', 'link', 'comment', 'pid', 'rid', 'ua', 'ip', 'state', 'created']
  const escape = (v: any): string => '"' + String(v ?? '').replace(/"/g, '""').replace(/\n/g, '\\n') + '"'
  const lines = [headers.join(',')]
  for (const c of comments) {
    lines.push(headers.map(h => escape(c[h])).join(','))
  }
  return lines.join('\n')
}

const exportData = async (format: 'json' | 'csv') => {
  if (exporting.value) return
  exporting.value = true
  exportLog.value = `开始导出 ${format.toUpperCase()} 格式数据...`
  try {
    const result = await dataApi.export(format)
    const data = (result as any).data || result || []
    const now = new Date().toISOString().slice(0, 10)
    const ext = format === 'csv' ? 'csv' : 'json'
    const filename = `takoio-export-${now}.${ext}`
    if (format === 'csv') {
      downloadFile(formatCsv(Array.isArray(data) ? data : []), filename, 'text/csv')
    } else {
      downloadFile(JSON.stringify(data, null, 2), filename, 'application/json')
    }
    const total = (result as any).total || (Array.isArray(data) ? data.length : Object.keys(data).length)
    message.success(`导出成功，共 ${total} 条数据`)
    exportLog.value += `\n导出成功！数据量: ${total}`
  } catch (e: any) {
    message.error('导出失败: ' + (e.message || ''))
    exportLog.value += `\n导出失败：${e.message}`
  } finally {
    exporting.value = false
  }
}
</script>

<style scoped>
.data-page { max-width: 900px; }

.data-stack {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.data-section {
  background: var(--paper);
  border: 1px solid var(--edge-soft);
  border-radius: var(--r-card);
  overflow: hidden;
  box-shadow: var(--shadow-paper);
  transition: box-shadow 0.22s cubic-bezier(.22,.61,.36,1);
}
.data-section:hover { box-shadow: var(--shadow-lift); }

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--edge-soft);
  font-size: 15px;
  font-weight: 600;
  color: var(--ink);
  background: var(--paper);
}
.section-icon { color: var(--accent); }
.section-body { padding: 18px; }

.form-field { margin-bottom: 16px; }
.form-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--ink);
  margin-bottom: 6px;
}

.tip {
  font-size: 13px;
  color: var(--ink-2);
  margin: 0 0 16px;
  line-height: 1.5;
}

.upload-dragger {
  width: 100%;
}
.upload-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 20px;
}
.upload-icon {
  color: var(--accent);
}
.upload-text {
  margin: 0;
  font-size: 13px;
  color: var(--ink);
}
.upload-hint {
  font-size: 12px;
  color: var(--ink-3);
}

.result-box { margin-top: 16px; }

.log-box {
  margin-top: 16px;
  padding: 10px 12px;
  background: var(--paper-2);
  border: 1px solid var(--edge-soft);
  border-radius: var(--r-input);
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  color: var(--ink-2);
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 200px;
  overflow-y: auto;
}

</style>
