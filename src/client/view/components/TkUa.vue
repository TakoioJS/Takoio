<template>
  <span
    v-if="uaDisplay"
    class="tk-ua"
  >
    <!-- OS 图标：有 slug 用 Simple Icons，否则兜底 lucide -->
    <i
      v-if="uaDisplay.osIconClass"
      :class="['tk-ua-icon', uaDisplay.osIconClass]"
    />
    <i
      v-else-if="uaDisplay.isDesktop"
      class="i-lucide-monitor tk-ua-icon"
    />
    <i
      v-else
      class="i-lucide-smartphone tk-ua-icon"
    />
    <span v-if="uaDisplay.os">{{ uaDisplay.os }}</span>

    <!-- Browser 图标 -->
    <i
      v-if="uaDisplay.browserIconClass"
      :class="['tk-ua-icon', 'tk-ua-ml', uaDisplay.browserIconClass]"
    />
    <i
      v-else-if="uaDisplay.browser"
      class="i-lucide-globe tk-ua-icon tk-ua-ml"
    />
    <span v-if="uaDisplay.browser">{{ uaDisplay.browser }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ ua?: string }>()

// OS：按数组顺序匹配，命中即取 slug。通用 Linux 兜底放最后。
const OS_ICON_PREFIXES: Array<{ match: (os: string) => boolean, slug: string }> = [
  { match: os => os.startsWith('Windows'), slug: 'windows' },
  { match: os => os === 'macOS' || os.startsWith('macOS '), slug: 'macos' },
  { match: os => os.startsWith('iOS'), slug: 'apple' },
  { match: os => os.startsWith('iPadOS'), slug: 'apple' },
  { match: os => os.startsWith('Android'), slug: 'android' },
  { match: os => os === 'Ubuntu', slug: 'ubuntu' },
  { match: os => os === 'Debian', slug: 'debian' },
  { match: os => os === 'Fedora', slug: 'fedora' },
  { match: os => os === 'Arch Linux', slug: 'archlinux' },
  { match: os => os === 'Linux Mint', slug: 'linuxmint' },
  { match: os => os === 'Manjaro', slug: 'manjaro' },
  { match: os => os === 'openSUSE', slug: 'opensuse' },
  { match: os => os === 'Gentoo', slug: 'gentoo' },
  { match: os => os === 'Kali', slug: 'kalilinux' },
  { match: os => os === 'CentOS', slug: 'centos' },
  { match: os => os === 'Red Hat', slug: 'redhat' },
  { match: os => os === 'Linux', slug: 'linux' }, // 通用 Linux 兜底（最后匹配）
]

const BROWSER_ICON_SLUGS: Record<string, string> = {
  Edge: 'microsoftedge',
  Chrome: 'googlechrome',
  Firefox: 'firefoxbrowser',
  Safari: 'safari',
  IE: 'internetexplorer',
  Opera: 'opera',
  'Samsung Internet': 'samsung', // 无专用图标，用 Samsung 品牌图标
  Brave: 'brave',
  Vivaldi: 'vivaldi',
  // Yandex Browser 与 Chromium 无 Simple Icons 图标，回退到 lucide globe
  DuckDuckGo: 'duckduckgo',
}

const uaDisplay = computed(() => {
  const ua = props.ua || ''
  if (!ua) return null
  let browser = ''
  let os = ''
  let isDesktop = true

  // OS 识别（顺序敏感：Windows → macOS/iPadOS → Android → iPhone/iPad → Linux 发行版）
  if (ua.includes('Windows NT 10.0')) {
    os = 'Windows 10'
  } else if (ua.includes('Windows NT 6.3')) {
    os = 'Windows 8.1'
  } else if (ua.includes('Windows NT 6.2')) {
    os = 'Windows 8'
  } else if (ua.includes('Windows NT 6.1')) {
    os = 'Windows 7'
  } else if (ua.includes('Windows NT')) {
    const n = ua.match(/Windows NT ([\d.]+)/)
    os = n ? `Windows ${n[1].split('.')[0]}` : 'Windows'
  } else if (ua.includes('Mac OS X')) {
    // iPadOS 13+ 桌面模式 UA 报告为 Mac OS X 且含 iPad
    if (ua.includes('iPad')) {
      isDesktop = false
      const match = ua.match(/OS (\d+[._]\d+)/)
      os = match ? `iPadOS ${match[1].split(/[._]/)[0]}` : 'iPadOS'
    } else {
      const match = ua.match(/Mac OS X (\d+[._]\d+)/)
      os = match ? `macOS ${match[1].split(/[._]/)[0]}` : 'macOS'
    }
  } else if (ua.includes('Android')) {
    isDesktop = false
    const match = ua.match(/Android (\d+(\.\d+)?)/)
    os = match ? `Android ${match[1].split('.')[0]}` : 'Android'
  } else if (ua.includes('iPhone') || ua.includes('iPad')) {
    isDesktop = false
    const match = ua.match(/OS (\d+[._]\d+)/)
    os = match ? `iOS ${match[1].split(/[._]/)[0]}` : 'iOS'
  } else if (ua.includes('Linux')) {
    if (ua.includes('Mobile')) isDesktop = false
    // 尝试从 Firefox 类 UA 的 "X11; <Distro>; Linux" 模式解析发行版
    const distroMatch = ua.match(/X11; ([^;]+); Linux/i)
    if (distroMatch) {
      const distroRaw = distroMatch[1].trim()
      const distroMap: Record<string, string> = {
        Ubuntu: 'Ubuntu',
        Debian: 'Debian',
        Fedora: 'Fedora',
        'Arch Linux': 'Arch Linux',
        Arch: 'Arch Linux',
        'Linux Mint': 'Linux Mint',
        'Manjaro Linux': 'Manjaro',
        Manjaro: 'Manjaro',
        openSUSE: 'openSUSE',
        Gentoo: 'Gentoo',
        Kali: 'Kali',
        CentOS: 'CentOS',
        'Red Hat': 'Red Hat',
      }
      os = distroMap[distroRaw] || 'Linux'
    } else {
      os = 'Linux'
    }
  }

  // 浏览器识别（顺序敏感：Chromium 系须在 Chrome 之前判断）
  let version = ''
  if (ua.includes('Edg/')) {
    browser = 'Edge'
    const m = ua.match(/Edg\/(\d+\.\d+)/)
    if (m) version = m[1].split('.')[0]
  } else if (ua.includes('OPR/') || ua.includes('Opera/')) {
    browser = 'Opera'
    const m = ua.match(/(?:OPR|Opera)\/(\d+\.\d+)/)
    if (m) version = m[1].split('.')[0]
  } else if (ua.includes('SamsungBrowser/')) {
    browser = 'Samsung Internet'
    const m = ua.match(/SamsungBrowser\/(\d+\.\d+)/)
    if (m) version = m[1].split('.')[0]
  } else if (ua.includes('Brave/')) {
    browser = 'Brave'
    const m = ua.match(/Brave\/(\d+\.\d+)/)
    if (m) version = m[1].split('.')[0]
  } else if (ua.includes('Vivaldi/')) {
    browser = 'Vivaldi'
    const m = ua.match(/Vivaldi\/(\d+\.\d+)/)
    if (m) version = m[1].split('.')[0]
  } else if (ua.includes('YaBrowser/')) {
    browser = 'Yandex Browser'
    const m = ua.match(/YaBrowser\/(\d+\.\d+)/)
    if (m) version = m[1].split('.')[0]
  } else if (ua.includes('DuckDuckGo/')) {
    browser = 'DuckDuckGo'
    const m = ua.match(/DuckDuckGo\/(\d+\.\d+)/)
    if (m) version = m[1].split('.')[0]
  } else if (ua.includes('Chrome/') && !ua.includes('Edg')) {
    browser = 'Chrome'
    const m = ua.match(/Chrome\/(\d+\.\d+)/)
    if (m) version = m[1].split('.')[0]
  } else if (ua.includes('Chromium/')) {
    browser = 'Chromium'
    const m = ua.match(/Chromium\/(\d+\.\d+)/)
    if (m) version = m[1].split('.')[0]
  } else if (ua.includes('Firefox/')) {
    browser = 'Firefox'
    const m = ua.match(/Firefox\/(\d+(\.\d+)?)/)
    if (m) version = m[1].split('.')[0]
  } else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
    browser = 'Safari'
    const m = ua.match(/Version\/(\d+\.\d+)/)
    if (m) version = m[1].split('.')[0]
  } else if (ua.includes('MSIE') || ua.includes('Trident/')) {
    browser = 'IE'
  }

  if (!browser && !os) return null

  // OS 图标：按 OS_ICON_PREFIXES 顺序匹配
  let osSlug = ''
  for (const item of OS_ICON_PREFIXES) {
    if (os && item.match(os)) {
      osSlug = item.slug
      break
    }
  }
  const osIconClass = osSlug ? `i-simple-icons-${osSlug}` : ''

  // Browser 图标：精确名查表
  const browserIconClass = browser && BROWSER_ICON_SLUGS[browser]
    ? `i-simple-icons-${BROWSER_ICON_SLUGS[browser]}`
    : ''

  return {
    os,
    osIconClass,
    browser: [browser, version].filter(Boolean).join(' '),
    browserIconClass,
    isDesktop,
  }
})
</script>

<style scoped>
.tk-ua {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.tk-ua-icon {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  display: inline-block;
  vertical-align: middle;
  stroke-width: 2;
}
.tk-ua-ml {
  margin-left: 6px;
}
@media (max-width: 640px) {
  .tk-ua { gap: 3px; }
  .tk-ua-icon { width: 11px; height: 11px; }
  .tk-ua-ml { margin-left: 4px; }
}
</style>
