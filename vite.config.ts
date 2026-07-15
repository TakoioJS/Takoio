import { defineConfig, type LibraryFormats } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import UnoCSS from 'unocss/vite'
import dts from 'vite-plugin-dts'
import { visualizer } from 'rollup-plugin-visualizer'

const packageJson = JSON.parse(
  readFileSync(resolve(__dirname, 'package.json'), 'utf-8')
) as { version: string }

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'umd' || mode === 'esm'

  const plugins = [
    vue(),
    vueJsx(),
    UnoCSS()
  ]

  // dts 插件只在生产构建且不是 UMD 模式时使用（避免重复生成）
  if (isProduction && mode !== 'umd') {
    plugins.push(dts({
      include: ['shims.d.ts', 'src/client/**/*.ts', 'src/client/**/*.vue'],
      exclude: ['src/client/**/*.test.ts'],
      rollupTypes: false,
      insertTypesEntry: true
    }))
  }
  if (process.env.ANALYZE === 'true') {
    plugins.push(visualizer({
      filename: 'dist/stats.html',
      open: true,
      gzipSize: true,
      brotliSize: true,
    }) as any)
  }

  const entryFile = process.env.ENTRY_FILE
  const entry = mode === 'umd'
    ? resolve(__dirname, 'src/client/main.ts')
    : {
        takoio: resolve(__dirname, 'src/client/main.ts')
      }

  const formats = mode === 'umd' ? ['umd' as LibraryFormats] : (['es' as LibraryFormats, 'cjs' as LibraryFormats])

  return {
    plugins,
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/client'),
        '@shared': resolve(__dirname, 'src/client'),
        '@takoio/common': resolve(__dirname, 'src/shared/common'),
        '@takoio/core': resolve(__dirname, 'src/shared/core')
      }
    },
    define: {
      __TAKOIO_VERSION__: JSON.stringify(packageJson.version),
      __VUE_OPTIONS_API__: 'true',
      __VUE_PROD_DEVTOOLS__: 'false',
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false'
    },
    build: {
      outDir: 'dist',
      emptyOutDir: mode !== 'umd',
      sourcemap: mode !== 'umd',
      minify: 'esbuild',
      target: 'es2018',
      cssCodeSplit: false,
      lib: {
        entry,
        name: 'takoio',
        fileName: (format, currentEntryName) => {
          if (format === 'umd') {
            return 'takoio.min.js'
          }
          const name = entryFile || 'takoio'
          const ext = format === 'es' ? 'esm.js' : 'cjs'
          return `${name}.${ext}`
        },
        formats
      },
      rollupOptions: {
        external: ['vue'],
        output: {
          assetFileNames: (assetInfo) => {
            if (assetInfo.name?.endsWith('.css')) return 'takoio.min.css'
            return '[name][extname]'
          },
          globals: {
            vue: 'Vue'
          },
          // ESM 模式：合并 highlight.js 语言模块为单个 chunk，减少首屏并行请求数
          // UMD 模式为单文件输出，manualChunks 不生效（全部 inline）
          manualChunks: mode === 'umd' ? undefined : (id) => {
            // 路径分隔符跨平台兼容（Windows 用 \，POSIX 用 /）
            const normId = id.replace(/\\/g, '/')
            if (normId.includes('highlight.js/lib/')) return 'hljs-langs'
            if (normId.includes('katex')) return 'katex'
          }
        }
      }
    },
    server: {
      port: 9820,
      host: '0.0.0.0',
      open: true,
      watch: {
        ignored: ['**/src/admin/**']
      }
    },
    optimizeDeps: {
      include: ['vue', 'marked']
    }
  }
})
