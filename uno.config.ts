import { defineConfig, presetUno, presetIcons } from 'unocss'

// UA 图标类名运行时动态拼接，UnoCSS 静态扫描无法识别，需在 safelist 中显式声明
const UA_ICON_SLUGS = [
  // OS
  'windows', 'apple', 'android', 'linux',
  'ubuntu', 'debian', 'fedora', 'archlinux', 'linuxmint',
  'manjaro', 'opensuse', 'gentoo', 'centos', 'kalilinux', 'redhat',
  // Browser
  'googlechrome', 'microsoftedge', 'firefoxbrowser', 'safari',
  'internetexplorer', 'opera', 'samsung', 'brave', 'vivaldi', 'duckduckgo',
]

export default defineConfig({
  presets: [
    presetUno(),
    presetIcons({
      scale: 1.2,
      extraProperties: {
        'display': 'inline-block',
        'vertical-align': 'middle',
      },
    }),
  ],
  safelist: [
    ...UA_ICON_SLUGS.map(slug => `i-simple-icons-${slug}`),
  ],
  theme: {
    colors: {
      brand: {
        50: '#f0f9ff',
        100: '#e0f2fe',
        200: '#bae6fd',
        300: '#7dd3fc',
        400: '#38bdf8',
        500: '#0ea5e9',
        600: '#0284c7',
        700: '#0369a1',
        800: '#075985',
        900: '#0c4a6e'
      }
    }
  },
})
