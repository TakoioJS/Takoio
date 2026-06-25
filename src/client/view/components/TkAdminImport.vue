<template>
  <div class="tk-admin-import">
    <h3>{{ t('import') }}</h3>

    <div class="tk-import-form">
      <el-form-item :label="t('importSource')">
        <el-select v-model="importSource" :placeholder="t('importSourceHint')">
          <el-option value="takoio" label="Takoio" />
          <el-option value="twikoo" label="Twikoo" />
          <el-option value="artalk" label="Artalk" />
          <el-option value="valine" label="Valine" />
          <el-option value="waline" label="Waline" />
          <el-option value="disqus" label="Disqus" />
        </el-select>
      </el-form-item>

      <template v-if="importSource !== 'disqus'">
        <el-upload
          :auto-upload="false"
          :show-file-list="false"
          :on-change="onFileChange"
          accept=".json"
          drag
        >
          <div class="tk-upload-area">
            <el-icon :size="32" color="var(--tk-admin-text-secondary)"><UploadFilled /></el-icon>
            <p>{{ fileName || t('uploadJsonHint') }}</p>
            <span class="tk-form-hint">{{ t('uploadJsonDesc') }}</span>
          </div>
        </el-upload>
      </template>

      <template v-if="importSource === 'disqus'">
        <el-input v-model="disqusForum" :placeholder="t('disqusForum')" style="margin-bottom:8px" />
        <el-input v-model="disqusApiKey" :placeholder="t('disqusApiKey')" />
      </template>

      <el-button
        type="primary"
        :loading="importing"
        :disabled="!canImport"
        @click="onImport"
        style="margin-top:16px"
      >
        {{ t('import') }}
      </el-button>
    </div>

    <div v-if="importResult !== null" class="tk-import-result">
      <el-tag :type="importResult > 0 ? 'success' : 'warning'">
        {{ t('importResult') }}: {{ importResult }} {{ t('commentTab') }}
      </el-tag>
    </div>
    <div v-if="importLog" class="tk-admin-log" style="margin-top: 16px; padding: 10px; background: var(--tk-admin-bg-secondary, #f5f5f5); border-radius: 4px; font-family: monospace; font-size: 12px; color: var(--tk-admin-text-secondary, #666); white-space: pre-wrap; max-height: 200px; overflow-y: auto;">{{ importLog }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  ElFormItem, ElSelect, ElOption, ElInput, ElUpload,
  ElButton, ElIcon, ElTag, ElMessage, type UploadFile
} from 'element-plus'
import { UploadFilled } from '@element-plus/icons-vue'
import { t, adminRequest, readAsText } from '../../utils'
import type { TakoioConfig } from '../../types'

interface Props {
  options: TakoioConfig
  token?: string
}

const props = defineProps<Props>()

const importSource = ref('takoio')
const fileData = ref('')
const fileName = ref('')
const disqusForum = ref('')
const disqusApiKey = ref('')
const importing = ref(false)
const importResult = ref<number | null>(null)
const importLog = ref('')

const canImport = computed(() => {
  if (importSource.value === 'disqus') return disqusForum.value && disqusApiKey.value
  return !!fileData.value
})

const onFileChange = async (file: UploadFile): Promise<void> => {
  const raw = file.raw
  if (!raw) return
  try {
    fileData.value = await readAsText(raw)
    fileName.value = raw.name
  } catch {
    ElMessage.error(t('uploadFailed'))
  }
}

const onImport = async (): Promise<void> => {
  importing.value = true
  importResult.value = null
  importLog.value = `开始导入 ${importSource.value} 格式数据...\n`
  try {
    const source = importSource.value
    const data: any = {}
    if (source === 'disqus') {
      data.forum = disqusForum.value
      data.apiKey = disqusApiKey.value
    } else {
      data.json = fileData.value
    }

    const result = await adminRequest(props.options.envId, props.token || '', `/api/admin/import/${source}`, 'POST', data)
    const count = (result as any).count || 0
    importResult.value = count
    if (count === 0 && (result as any).error) {
      ElMessage.error((result as any).error)
      importResult.value = -1
      importLog.value += `导入失败：${(result as any).error}`
    } else {
      ElMessage.success(`${t('importResult')}: ${count} ${t('commentTab')}`)
      importLog.value += `导入成功！处理记录数：${count}\n`
      if (source === 'takoio') {
        importLog.value += `已恢复 Takoio 数据（包含文章反应、访客等），未覆盖现有后台配置。`
      }
    }
  } catch (e: any) {
    ElMessage.error(t('submitFailed'))
    importLog.value += `导入请求失败：${e.message}`
  } finally {
    importing.value = false
  }
}
</script>

<style scoped>
.tk-admin-import {
  background: #fff; border-radius: 8px; padding: 16px; margin-bottom: 16px;
}
.tk-import-form { margin-top: 8px; }
.tk-upload-area {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 20px; cursor: pointer;
}
.tk-upload-area p {
  margin: 4px 0 0; font-size: 14px; color: var(--tk-admin-text-secondary);
}
.tk-import-result { margin-top: 12px; }
</style>
