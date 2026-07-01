# Takoio

[![npm version](https://img.shields.io/npm/v/takoio)](https://www.npmjs.com/package/takoio)
[![GitHub Release](https://img.shields.io/github/v/release/TakoioJS/Takoio)](https://github.com/TakoioJS/Takoio/releases)
[![Zread](https://img.shields.io/badge/Ask_Zread-_.svg?style=flat&color=00b0aa&labelColor=000000&logo=data%3Aimage%2Fsvg%2Bxml%3Bbase64%2CPHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTQuOTYxNTYgMS42MDAxSDIuMjQxNTZDMS44ODgxIDEuNjAwMSAxLjYwMTU2IDEuODg2NjQgMS42MDE1NiAyLjI0MDFWNC45NjAxQzEuNjAxNTYgNS4zMTM1NiAxLjg4ODEgNS42MDAxIDIuMjQxNTYgNS42MDAxSDQuOTYxNTZDNS4zMTUwMiA1LjYwMDEgNS42MDE1NiA1LjMxMzU2IDUuNjAxNTYgNC45NjAxVjIuMjQwMUM1LjYwMTU2IDEuODg2NjQgNS4zMTUwMiAxLjYwMDEgNC45NjE1NiAxLjYwMDFaIiBmaWxsPSIjZmZmIi8%2BCjxwYXRoIGQ9Ik00Ljk2MTU2IDEwLjM5OTlIMi4yNDE1NkMxLjg4ODEgMTAuMzk5OSAxLjYwMTU2IDEwLjY4NjQgMS42MDE1NiAxMS4wMzk5VjEzLjc1OTlDMS42MDE1NiAxNC4xMTM0IDEuODg4MSAxNC4zOTk5IDIuMjQxNTYgMTQuMzk5OUg0Ljk2MTU2QzUuMzE1MDIgMTQuMzk5OSA1LjYwMTU2IDE0LjExMzQgNS42MDE1NiAxMy43NTk5VjExLjAzOTlDNS42MDE1NiAxMC42ODY0IDUuMzE1MDIgMTAuMzk5OSA0Ljk2MTU2IDEwLjM5OTlaIiBmaWxsPSIjZmZmIi8%2BCjxwYXRoIGQ9Ik0xMy43NTg0IDEuNjAwMUgxMS4wMzg0QzEwLjY4NSAxLjYwMDEgMTAuMzk4NCAxLjg4NjY0IDEwLjM5ODQgMi4yNDAxVjQuOTYwMUMxMC4zOTg0IDUuMzEzNTYgMTAuNjg1IDUuNjAwMSAxMS4wMzg0IDUuNjAwMUgxMy43NTg0QzE0LjExMTkgNS42MDAxIDE0LjM5ODQgNS4zMTM1NiAxNC4zOTg0IDQuOTYwMVYyLjI0MDFDMTQuMzk4NCAxLjg4NjY0IDE0LjExMTkgMS42MDAxIDEzLjc1ODQgMS42MDAxWiIgZmlsbD0iI2ZmZiIvPgo8cGF0aCBkPSJNNCAxMkwxMiA0TDQgMTJaIiBmaWxsPSIjZmZmIi8%2BCjxwYXRoIGQ9Ik00IDEyTDEyIDQiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4K&logoColor=ffffff)](https://zread.ai/TakoioJS/Takoio)

**English** | [中文](./README.md)

A simple, free comment system. Built with Vue 3 + Nitro 3. Self-hosted or Serverless.

Rewritten from [Twikoo](https://github.com/twikoojs/twikoo).

## Features

- **Lightweight** — Client UMD bundle ~84 kB (gzip), Vue externalized, two-line CDN setup
- **Multi-database** — SQLite (self-hosted) / MongoDB (serverless), lazy-loaded via store registry
- **AI-powered** — Article summarization and AI comment moderation (OpenAI / Anthropic / Gemini)
- **Admin Panel** — Standalone Vue 3 SPA (Naive UI) for comment management, configuration, and data import/export
- **Rich features** — Markdown, code highlighting (Shiki), external TeX renderer, emoji reactions, image upload, captcha, IP geolocation, email notifications
- **Flexible deployment** — Node.js self-hosted, Vercel, Netlify — one-line Nitro preset switch

## Quick Start

### CDN (Static Sites)

```html
<!-- Load Vue 3 first -->
<script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>
<!-- Then Takoio -->
<script src="https://unpkg.com/takoio/dist/takoio.min.js"></script>
<link rel="stylesheet" href="https://unpkg.com/takoio/dist/takoio.min.css">

<div id="takoio"></div>

<script>
  takoio.init({
    envId: 'https://your-server.com',  // Your Takoio server URL
    el: '#takoio',
  })
</script>
```

### npm (Vite / Nuxt / etc.)

```bash
pnpm add takoio
```

```js
import { init } from 'takoio'
import 'takoio/dist/takoio.min.css'

// In Nuxt, use onMounted + nextTick to ensure DOM is ready
init({
  envId: 'https://your-server.com',
  el: '#takoio',
  path: window.location.pathname,
})
```

### API Methods

Beyond `init()`, the client exports additional methods for custom integrations:

```js
import { getCommentsCount, getRecentComments, getVisitorsCount, getArticleSummary } from 'takoio'

// Get comment counts per URL
const counts = await getCommentsCount({ envId: 'https://your-server.com', urls: ['/post/1'] })

// Get recent comments
const recent = await getRecentComments({ envId: 'https://your-server.com', count: 5 })

// Get visitor count
const visitors = await getVisitorsCount({ envId: 'https://your-server.com', url: '/' })

// Get AI article summary
const summary = await getArticleSummary({
  envId: 'https://your-server.com',
  content: 'Article body text',
  url: '/post/1',
})
```

## Server Deployment

### Self-hosted (Node.js + SQLite)

The simplest option — ideal for personal blogs.

```bash
git clone https://github.com/TakoioJS/Takoio.git
cd Takoio
pnpm install
pnpm build:admin
pnpm --filter takoio-server build
pnpm --filter takoio-server start   # Defaults to :8080
```

Data is stored in `data/takoio.db` (SQLite) — zero config, works out of the box.

Reverse proxy example (Nginx):

```nginx
server {
    listen 443 ssl;
    server_name comment.example.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Vercel (Serverless + MongoDB)

1. Fork this repo and import it in Vercel
2. Set environment variables: `DB_TYPE=mongodb` and `MONGODB_URI` (recommended: [MongoDB Atlas](https://www.mongodb.com/atlas) free tier)
3. Deploy — `vercel.json` has build commands pre-configured

### Netlify (Serverless + MongoDB)

1. Fork this repo and import it in Netlify
2. Set environment variables: `DB_TYPE=mongodb` and `MONGODB_URI`
3. `netlify.toml` has build commands and redirect rules pre-configured

> **Note:** Do not use SQLite in serverless environments — the filesystem is ephemeral and data is lost on cold starts. Use MongoDB Atlas instead.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_TYPE` | Database type: `sqlite` or `mongodb` | `sqlite` |
| `MONGODB_URI` | MongoDB connection string (required when `DB_TYPE=mongodb`) | — |
| `TAKOIO_THROTTLE` | Min interval between requests from same IP (ms) | `250` |
| `SETUP_TOKEN` | Token for initial admin password setup (prevents unauthorized takeover) | — |
| `REDIS_URL` | Redis connection (required for AI summary caching) | — |
| `LOG_LEVEL` | Log level: `debug` / `info` / `warn` / `error` | `debug` (dev) / `info` (prod) |
| `TZ` | Timezone | `Asia/Shanghai` |

## Client Configuration

Common options for `init()`. Full type definitions in [types.ts](./src/client/types.ts).

| Option | Type | Description |
|--------|------|-------------|
| `envId` | `string` | **Required.** Server URL |
| `el` | `string \| HTMLElement` | Mount target selector |
| `path` | `string` | Page path (comment association key) |
| `lang` | `string` | Language: `zh-CN` / `zh-TW` / `en` |
| `pageSize` | `number` | Comments per page, default `10` |
| `sort` | `string` | Sort order: `newest` / `oldest` / `hottest` |
| `brandColor` | `string` | Brand color, e.g. `'#10b981'` |
| `enableCodeHighlight` | `boolean` | Code highlighting, default `true` |
| `enableCaptcha` | `boolean` | Captcha verification |
| `enableArticleReaction` | `boolean` | Article-level emoji reactions |
| `enableCommentReaction` | `boolean` | Comment-level emoji reactions |
| `visitorCounter` | `boolean` | Show page view counter |
| `enableSummary` | `boolean` | AI article summary |
| `articleContent` | `string` | Article body text (required for AI summary) |
| `paginationMode` | `string` | `pagination` / `infinite` (infinite scroll) |
| `customCSS` | `string` | Custom CSS injection |
| `placeholder` | `string` | Comment box placeholder text |
| `texRenderer` | `(blockMode, tex) => string \| Promise<string>` | External math renderer |

### Math Rendering

Takoio does not bundle KaTeX by default. Load a renderer on the host page when math support is needed:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.17.0/dist/katex.min.css">
<script type="module">
  import katex from 'https://cdn.jsdelivr.net/npm/katex@0.17.0/dist/katex.mjs'

  takoio.init({
    envId: 'https://your-server.com',
    texRenderer: (blockMode, tex) => katex.renderToString(tex, {
      displayMode: blockMode,
      throwOnError: false,
    }),
  })
</script>
```

## Development

```bash
git clone https://github.com/TakoioJS/Takoio.git
cd Takoio
pnpm install
pnpm dev
```

After startup:

- Server → `http://localhost:8080` (Nitro dev server)
- Client → `http://127.0.0.1:9820` (Vite dev server)
- Admin → `http://127.0.0.1:9820/admin/`

### Project Structure

```
Takoio/
├── src/
│   ├── client/          # Client widget (Vue 3) — npm package
│   ├── server/          # Server (Nitro 3) — workspace package
│   │   ├── core/        #   Business logic (DB, auth, moderation, notifications)
│   │   └── nitro/       #   Routes, middleware, plugins
│   └── admin/           # Admin panel (Vue 3 + Naive UI) — workspace package
├── e2e/                 # Playwright end-to-end tests
├── dist/                # Client build output (ESM / CJS / UMD)
├── docs/                # Design documents
├── dev.mjs              # One-command dev startup
└── vite.config.ts       # Client library build config
```

### Tech Stack

Client: Vue 3.5, Vite 8, UnoCSS, Pinia, Marked, Shiki, DOMPurify

Server: Nitro 3, h3, Drizzle ORM, LibSQL/MongoDB, Vercel AI SDK, Zod, Nodemailer

Admin: Vue 3, Vue Router 5, Pinia 3, Naive UI

### Testing

```bash
pnpm test          # Unit tests (Vitest)
pnpm test:e2e      # End-to-end tests (Playwright)
pnpm type-check    # Type checking (vue-tsc)
pnpm lint          # Linting (ESLint)
```

## Architecture

```
┌─────────────────────────────────────┐
│  Client Widget (npm / CDN)          │  ← Embeddable comment component
│  Vue 3 · UMD 167kB gzip            │
└──────────────┬──────────────────────┘
               │ HTTP / REST
┌──────────────▼──────────────────────┐
│  Server API (Nitro 3)               │  ← Unified API layer
│  Routes · Middleware · Plugins      │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  Store (SQLite / MongoDB)           │  ← Data persistence
│  + Redis (optional, AI cache)       │
└─────────────────────────────────────┘
```

The server follows a 4-layer architecture: Routes (Nitro file-based) → Middleware (CORS / rate-limit / logging) → Handlers (request dispatch) → Core (DB / auth / moderation / notifications). The Store layer uses a `registerStoreBackend` registry pattern — Core never hardcodes a specific database import.

## License

[MIT](./LICENSE) — Copyright 2024-present PaloMiku and Takoio Contributors

Derived from [Twikoo](https://github.com/twikoojs/twikoo) (MIT License).
