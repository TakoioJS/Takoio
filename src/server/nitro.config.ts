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
    { dir: '../../dist/admin', baseURL: '/admin' },
  ],

  // Dev server port — must match admin/client proxy config
  devServer: {
    port: 8080,
    host: '0.0.0.0',
  },

  // Global error handler
  errorHandler: './nitro/error',

  // Path alias: #core → src/server/core/
  alias: {
    '#core': resolve(rootDir, 'core'),
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
          'sendStream', 'getRequestIP', 'H3Error',
        ],
      },
    ],
  },

  // ESM target
  esbuild: {
    options: {
      target: 'es2022',
    },
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

  // All dependencies are bundled into the serverless function so it works
  // on platforms (Vercel/Netlify) where node_modules is not available at runtime.
  // jsdom and ioredis were previously externalized but this broke serverless deploys.
})
