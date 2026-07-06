<template>
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
      <template #icon>
        <n-icon><component :is="dbTagIcon" /></n-icon>
      </template>
      {{ dbTagLabel }}
    </n-tag>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NTag, NIcon } from 'naive-ui'
import {
  FlameOutline, CheckmarkCircleOutline,
  ServerOutline, CloudOfflineOutline,
  ServerSharp, LeafOutline, CloudCircleOutline, HardwareChipOutline,
} from '@vicons/ionicons5'

export interface SystemStatusData {
  dev: boolean
  dbType: string
  redisAvailable: boolean
  summaryCount: number
}

const props = defineProps<{
  sysStatus: SystemStatusData
}>()

const redisTagType = computed<'success' | 'error' | 'default'>(() => {
  if (props.sysStatus.dev) return 'default'
  return props.sysStatus.redisAvailable ? 'success' : 'error'
})
const redisTagLabel = computed(() => {
  return props.sysStatus.redisAvailable ? 'Redis 已连接' : 'Redis 未连接'
})
const redisTagIcon = computed(() => {
  return props.sysStatus.redisAvailable ? ServerOutline : CloudOfflineOutline
})

const dbTagLabel = computed(() => {
  const map: Record<string, string> = {
    sqlite: 'SQLite',
    postgres: 'PostgreSQL',
    postgresql: 'PostgreSQL',
    pg: 'PostgreSQL',
    mongodb: 'MongoDB',
  }
  return map[props.sysStatus.dbType.toLowerCase()] || props.sysStatus.dbType.toUpperCase()
})
const dbTagIcon = computed(() => {
  const t = props.sysStatus.dbType.toLowerCase()
  if (t === 'mongodb') return LeafOutline
  if (t === 'postgres' || t === 'postgresql' || t === 'pg') return ServerSharp
  if (t === 'sqlite') return HardwareChipOutline
  return CloudCircleOutline
})
</script>

<style scoped>
.system-status {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
</style>
