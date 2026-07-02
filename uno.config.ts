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
      /* 松绿系（与 --accent: #5E8C6A 一致）*/
      brand: {
        50: '#f0f7f2',
        100: '#dcebe0',
        200: '#b5d7bc',
        300: '#82bd8c',
        400: '#61a36d',
        500: '#5E8C6A',
        600: '#4a7055',
        700: '#385440',
        800: '#26382c',
        900: '#172218'
      }
    }
  },
})
