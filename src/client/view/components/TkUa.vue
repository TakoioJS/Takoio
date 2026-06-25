<template>
  <span v-if="uaDisplay" class="tk-ua">
    <Icon v-if="uaDisplay.osIcon" :icon="uaDisplay.osIcon" width="12" />
    <Monitor v-else-if="uaDisplay.isDesktop" :size="12" />
    <Smartphone v-else :size="12" />
    <span v-if="uaDisplay.os">{{ uaDisplay.os }}</span>
    
    <Icon v-if="uaDisplay.browserIcon" :icon="uaDisplay.browserIcon" width="12" class="tk-ua-ml" />
    <Globe v-else-if="uaDisplay.browser" :size="12" class="tk-ua-ml" />
    <span v-if="uaDisplay.browser">{{ uaDisplay.browser }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Monitor, Smartphone, Globe } from 'lucide-vue-next'
import { Icon } from '@iconify/vue'

const props = defineProps<{ ua?: string }>()

const uaDisplay = computed(() => {
  const ua = props.ua || ''
  if (!ua) return null
  let browser = ''
  let os = ''
  let osIcon = ''
  let browserIcon = ''
  let isDesktop = true
  
  // OS — Windows NT kernel version → display name mapping
  // ponytail: Win10 and Win11 both report NT 10.0, cannot distinguish from UA alone
  if (ua.includes('Windows NT 10.0')) { os = 'Windows 10'; osIcon = 'logos:microsoft-windows-icon'; }
  else if (ua.includes('Windows NT 6.3')) { os = 'Windows 8.1'; osIcon = 'logos:microsoft-windows-icon'; }
  else if (ua.includes('Windows NT 6.2')) { os = 'Windows 8'; osIcon = 'logos:microsoft-windows-icon'; }
  else if (ua.includes('Windows NT 6.1')) { os = 'Windows 7'; osIcon = 'logos:microsoft-windows-icon'; }
  else if (ua.includes('Windows NT')) {
    const n = ua.match(/Windows NT ([\d.]+)/)
    os = n ? `Windows ${n[1].split('.')[0]}` : 'Windows'
    osIcon = 'logos:microsoft-windows-icon'
  }
  else if (ua.includes('Mac OS X')) {
    const match = ua.match(/Mac OS X (\d+[._]\d+)/)
    os = match ? `macOS ${match[1].split(/[._]/)[0]}` : 'macOS'
    osIcon = 'logos:apple'
  }
  else if (ua.includes('Android')) {
    isDesktop = false
    const match = ua.match(/Android (\d+(\.\d+)?)/)
    os = match ? `Android ${match[1].split('.')[0]}` : 'Android'
    osIcon = 'logos:android-icon'
  }
  else if (ua.includes('iPhone') || ua.includes('iPad')) {
    isDesktop = false
    const match = ua.match(/OS (\d+[._]\d+)/)
    os = match ? `iOS ${match[1].split(/[._]/)[0]}` : 'iOS'
    osIcon = 'logos:apple'
  }
  else if (ua.includes('Linux')) {
    if (ua.includes('Mobile')) isDesktop = false
    os = 'Linux'
    osIcon = 'logos:linux-tux'
  }

  // Browser
  let version = ''
  if (ua.includes('Edg/')) { 
    browser = 'Edge'; browserIcon = 'logos:microsoft-edge';
    const match = ua.match(/Edg\/(\d+\.\d+)/); 
    if (match) version = match[1].split('.')[0]; 
  }
  else if (ua.includes('Chrome/') && !ua.includes('Edg')) { 
    browser = 'Chrome'; browserIcon = 'logos:chrome';
    const match = ua.match(/Chrome\/(\d+\.\d+)/); 
    if (match) version = match[1].split('.')[0]; 
  }
  else if (ua.includes('Firefox/')) { 
    browser = 'Firefox'; browserIcon = 'logos:firefox';
    const match = ua.match(/Firefox\/(\d+(\.\d+)?)/); 
    if (match) version = match[1].split('.')[0]; 
  }
  else if (ua.includes('Safari/') && !ua.includes('Chrome')) { 
    browser = 'Safari'; browserIcon = 'logos:safari';
    const match = ua.match(/Version\/(\d+\.\d+)/); 
    if (match) version = match[1].split('.')[0]; 
  }
  else if (ua.includes('MSIE') || ua.includes('Trident/')) {
    browser = 'IE'; browserIcon = 'logos:internetexplorer';
  }

  if (!browser && !os) return null

  return { 
    os,
    osIcon,
    browser: [browser, version].filter(Boolean).join(' '),
    browserIcon,
    isDesktop
  }
})
</script>

<style scoped>
.tk-ua {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.tk-ua-ml {
  margin-left: 4px;
}
</style>
