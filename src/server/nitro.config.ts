import { defineNitroConfig } from 'nitro/config'
import { resolve } from 'node:path'

// Root dir = src/server/ (where this config file lives)
const rootDir = import.meta.dirname || process.cwd()

export default defineNitroConfig({
  // Nitro server directory — contains routes/, middleware/, plugins/, utils/, error.ts
  serverDir: 'nitro',

  // Default preset: node-server (self-hosted)
  // Vercel: NITRO_PRESET=vercel
  // Netlify: NITRO_PRESET=netlify
  preset: 'node-server',

  // Only compresses publicAssets static files, NOT dynamic handler responses.
  compressPublicAssets: true,

  // Admin SPA built assets
  publicAssets: [
    { dir: '../../dist/admin', baseURL: '/admin', maxAge: 60 * 60 * 24 * 365 },
  ],

  // Dev server port — must match admin/client proxy config
  devServer: {
    port: 8080,
    hostname: '0.0.0.0',
  },

  // Global error handler
  errorHandler: './nitro/error',

  // Path alias: #core → src/server/core/
  // @takoio/common → src/shared/common/ (迁移后的路径)
  alias: {
    '#core': resolve(rootDir, 'core'),
    '@takoio/common': resolve(rootDir, '../../src/shared/common'),
  },

  // Explicit auto-imports — Nitro 3 beta's auto-import scanner
  // doesn't cover middleware/plugin/utils files, so we declare them here.
  imports: {
    presets: [
      {
        from: 'nitro',
        imports: [
          'defineHandler',
          'defineMiddleware',
          'definePlugin',
          'defineErrorHandler',
        ],
      },
      {
        from: 'h3',
        imports: [
          'getQuery', 'readBody', 'getRequestHeader', 'setResponseHeader',
          'setResponseStatus', 'getRequestURL', 'createError', 'sendNoContent',
          'sendStream', 'getRequestIP', 'H3Error', 'sendRedirect',
        ],
      },
    ],
  },

  // Inject __dirname polyfill for JSDOM compatibility in ESM bundled builds.
  // JSDOM uses __dirname at module-scope to resolve default-stylesheet.css,
  // which is undefined in pure ESM. This banner runs before any other module code.
  rollupConfig: {
    output: {
      banner: `// __dirname polyfill for ESM (required by jsdom)
if (typeof globalThis.__dirname === 'undefined') {
  try { globalThis.__dirname = new URL('.', import.meta.url).pathname.replace(/^\\/([A-Za-z]:)/, '$1'); } catch { globalThis.__dirname = process.cwd(); }
}`,
    },
  },

  // Externalize jsdom — it reads default-stylesheet.css via __dirname at module
  // load time (computed-style.js:17), which breaks when bundled into ESM.
  // render.ts uses dynamic import + try/catch so admin APIs don't load jsdom.
  // ioredis is bundled (not external) so Redis works on serverless platforms.
  rolldownConfig: {
    external: ['jsdom'],
  },
})
