import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [
    vue(),
    UnoCSS(),
    AutoImport({
      imports: ['vue', 'vue-router', 'pinia'],
      dts: resolve(__dirname, 'auto-imports.d.ts'),
      dirs: [
        resolve(__dirname, 'composables'),
        resolve(__dirname, 'stores'),
      ],
    }),
    Components({
      resolvers: [NaiveUiResolver()],
      dts: resolve(__dirname, 'components.d.ts'),
      dirs: [resolve(__dirname, 'components')],
    }),
  ],
  root: __dirname,
  base: '/admin/',
  resolve: {
    alias: {
      '@shared': resolve(__dirname, '../client'),
      '@': resolve(__dirname),
      '@takoio/common': resolve(__dirname, '../../src/shared/common')
    }
  },
  build: {
    outDir: '../../dist/admin',
    emptyOutDir: true,
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks (id: string) {
          if (id.includes('node_modules/naive-ui') || id.includes('node_modules/vdirs')) return 'naive-ui'
          if (id.includes('node_modules/vue') || id.includes('node_modules/vue-router') || id.includes('node_modules/pinia')) return 'vendor'
        }
      }
    }
  },
  server: {
    port: 9821,
    proxy: {
      '/api': 'http://localhost:8080',
    }
  }
})
