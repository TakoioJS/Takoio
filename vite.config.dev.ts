/**
 * Vite config — Dev server (MPA: client + admin) & Admin production build
 *
 * Dev mode (root = project root):
 *   MPA with two entries — client playground (index.html) + admin SPA (src/admin/index.html).
 *   Served on a single Vite instance at port 9820.
 *   Admin is accessible at /admin/.
 *
 * Admin build (root = src/admin):
 *   `vite build --config vite.config.dev.ts`
 *   Outputs admin SPA to src/admin/dist/ (served by Hono at /admin/*).
 *   Root switches to src/admin so the HTML lands at dist/index.html (not dist/src/admin/).
 *
 * Library build (client widget) uses the default vite.config.ts — untouched.
 */
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import UnoCSS from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers'
import { resolve } from 'node:path'
import { readFile } from 'node:fs/promises'

const ADMIN_DIR = resolve(__dirname, 'src/admin')

export default defineConfig(({ mode }) => {
  const isBuild = mode !== 'development'

  return {
    // Build: root at admin dir → HTML outputs to dist/index.html correctly.
    // Dev:   root at project root → MPA serves both client and admin entries.
    root: isBuild ? ADMIN_DIR : __dirname,
    base: isBuild ? '/admin/' : '/',

    plugins: [
      vue(),
      vueJsx(),
      UnoCSS(),

      // Dev-only: serve admin SPA at /admin/ (MPA mode maps it to /src/admin/index.html)
      !isBuild && {
        name: 'admin-dev-routing',
        configureServer(server: any) {
          server.middlewares.use(async (req: any, res: any, next: any) => {
            const url = req.url || ''
            // Match /admin or /admin/ but NOT /admin-something or files with extensions
            if (url.startsWith('/admin') && !/\.\w+/.test(url.split('?')[0])) {
              try {
                const rawHtml = await readFile(resolve(ADMIN_DIR, 'index.html'), 'utf-8')
                // Rewrite relative paths: ./main.ts → /src/admin/main.ts
                const patched = rawHtml.replace(/(src|href)=["']\.\//g, '$1="/src/admin/')
                const html = await server.transformIndexHtml('/src/admin/index.html', patched, req.originalUrl)
                res.setHeader('Content-Type', 'text/html')
                res.end(html)
              } catch (e) {
                next(e)
              }
              return
            }
            next()
          })
        },
      },

      AutoImport({
        imports: ['vue', 'vue-router', 'pinia', '@vueuse/core'],
        dts: resolve(ADMIN_DIR, 'auto-imports.d.ts'),
        dirs: [
          resolve(ADMIN_DIR, 'composables'),
          resolve(ADMIN_DIR, 'stores'),
        ],
        include: [/\.[tj]sx?$/, /\.vue$/, /\.vue\?vue/],
      }),
      Components({
        resolvers: [NaiveUiResolver()],
        dts: resolve(ADMIN_DIR, 'components.d.ts'),
        dirs: [resolve(ADMIN_DIR, 'components')],
      }),
    ],

    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/client'),
        '@': ADMIN_DIR,
      },
    },

    build: {
      outDir: 'dist', // relative to root (ADMIN_DIR) → src/admin/dist/
      emptyOutDir: true,
      sourcemap: false,
      minify: 'esbuild',
      rollupOptions: {
        input: {
          admin: resolve(ADMIN_DIR, 'index.html'),
        },
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules/naive-ui') || id.includes('node_modules/vdirs')) return 'naive-ui'
            if (id.includes('node_modules/vue') || id.includes('node_modules/vue-router') || id.includes('node_modules/pinia')) return 'vendor'
          },
        },
      },
    },

    server: {
      port: 9820,
      host: '0.0.0.0',
      open: true,
      watch: {
        ignored: ['**/src/server/**'],
      },
      proxy: {
        '/api': 'http://localhost:8080',
      },
    },

    optimizeDeps: {
      include: ['vue', 'marked'],
    },
  }
})
