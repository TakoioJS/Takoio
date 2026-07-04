# Takoio

[![npm version](https://img.shields.io/npm/v/takoio)](https://www.npmjs.com/package/takoio)
[![GitHub Release](https://img.shields.io/github/v/release/TakoioJS/Takoio)](https://github.com/TakoioJS/Takoio/releases)
[![Zread](https://img.shields.io/badge/Ask_Zread-_.svg?style=flat&color=00b0aa&labelColor=000000&logo=data%3Aimage%2Fsvg%2Bxml%3Bbase64%2CPHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTQuOTYxNTYgMS42MDAxSDIuMjQxNTZDMS44ODgxIDEuNjAwMSAxLjYwMTU2IDEuODg2NjQgMS42MDE1NiAyLjI0MDFWNC45NjAxQzEuNjAxNTYgNS4zMTM1NiAxLjg4ODEgNS42MDAxIDIuMjQxNTYgNS42MDAxSDQuOTYxNTZDNS4zMTUwMiA1LjYwMDEgNS42MDE1NiA1LjMxMzU2IDUuNjAxNTYgNC45NjAxVjIuMjQwMUM1LjYwMTU2IDEuODg2NjQgNS4zMTUwMiAxLjYwMDEgNC45NjE1NiAxLjYwMDFaIiBmaWxsPSIjZmZmIi8%2BCjxwYXRoIGQ9Ik00Ljk2MTU2IDEwLjM5OTlIMi4yNDE1NkMxLjg4ODEgMTAuMzk5OSAxLjYwMTU2IDEwLjY4NjQgMS42MDE1NiAxMS4wMzk5VjEzLjc1OTlDMS42MDE1NiAxNC4xMTM0IDEuODg4MSAxNC4zOTk5IDIuMjQxNTYgMTQuMzk5OUg0Ljk2MTU2QzUuMzE1MDIgMTQuMzk5OSA1LjYwMTU2IDE0LjExMzQgNS42MDE1NiAxMy43NTk5VjExLjAzOTlDNS42MDE1NiAxMC42ODY0IDUuMzE1MDIgMTAuMzk5OSA0Ljk2MTU2IDEwLjM5OTlaIiBmaWxsPSIjZmZmIi8%2BCjxwYXRoIGQ9Ik0xMy43NTg0IDEuNjAwMUgxMS4wMzg0QzEwLjY4NSAxLjYwMDEgMTAuMzk4NCAxLjg4NjY0IDEwLjM5ODQgMi4yNDAxVjQuOTYwMUMxMC4zOTg0IDUuMzEzNTYgMTAuNjg1IDUuNjAwMSAxMS4wMzg0IDUuNjAwMUgxMy43NTg0QzE0LjExMTkgNS42MDAxIDE0LjM5ODQgNS4zMTM1NiAxNC4zOTg0IDQuOTYwMVYyLjI0MDFDMTQuMzk4NCAxLjg4NjY0IDE0LjExMTkgMS42MDAxIDEzLjc1ODQgMS42MDAxWiIgZmlsbD0iI2ZmZiIvPgo8cGF0aCBkPSJNNCAxMkwxMiA0TDQgMTJaIiBmaWxsPSIjZmZmIi8%2BCjxwYXRoIGQ9Ik00IDEyTDEyIDQiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4K&logoColor=ffffff)](https://zread.ai/TakoioJS/Takoio)

[English](./README.en.md) | **中文**

> [!WARNING]
> 本项目目前不推荐生产部署使用，Main 仍处于迭代和问题修复阶段。

简洁、免费的评论系统。Vue 3 + Nitro 3 构建，支持自托管与 Serverless 部署。

基于 [Twikoo](https://github.com/twikoojs/twikoo) 重写。

## 特性

- **轻量嵌入** — 客户端 UMD 包约 83 kB (gzip)，Vue 外部化，CDN 两行引入
- **多数据库** — SQLite（自托管）/ MongoDB / PostgreSQL（Serverless），Store 注册模式按需加载
- **社交登录** — 支持 GitHub、Google OAuth 及邮箱验证码登录，JWT 会话管理
- **AI 集成** — 文章摘要生成、AI 评论审核，支持 OpenAI / Anthropic / Gemini
- **推送通知** — 基于 Pushoo，支持 Server酱、Telegram、Bark 等 20+ 推送渠道
- **安全加固** — 安全响应头（CSP / HSTS / X-Frame-Options）、暴力破解防护、SameSite Cookie
- **管理面板** — 独立 Vue 3 SPA（Naive UI），评论管理、配置、数据导入导出
- **丰富功能** — Markdown、代码高亮 (highlight.js)、服务端渲染 (Shiki)、外部 TeX 渲染器、表情反应、图片上传、验证码、IP 归属地、邮件通知
- **多平台部署** — Node.js 自托管、Vercel、Netlify，Nitro preset 一行切换

## 快速开始

### CDN 引入（静态站点）

```html
<!-- 先加载 Vue 3 -->
<script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>
<!-- 再加载 Takoio -->
<script src="https://unpkg.com/takoio/dist/takoio.min.js"></script>
<link rel="stylesheet" href="https://unpkg.com/takoio/dist/takoio.min.css">

<div id="takoio"></div>

<script>
  takoio.init({
    envId: 'https://your-server.com',  // 你的 Takoio 服务端地址
    el: '#takoio',
  })
</script>
```

### npm 安装（Vite / Nuxt 等项目）

```bash
pnpm add takoio
```

```js
import { init } from 'takoio'
import 'takoio/dist/takoio.min.css'

// Nuxt 中需在 onMounted + nextTick 确保 DOM 就绪
init({
  envId: 'https://your-server.com',
  el: '#takoio',
  path: window.location.pathname,
})
```

### API 方法

除 `init()` 外，客户端还导出以下方法供自定义组件调用：

```js
import { getCommentsCount, getRecentComments, getVisitorsCount, getArticleSummary } from 'takoio'

// 获取评论数
const counts = await getCommentsCount({ envId: 'https://your-server.com', urls: ['/post/1'] })

// 获取最近评论
const recent = await getRecentComments({ envId: 'https://your-server.com', count: 5 })

// 获取访客计数
const visitors = await getVisitorsCount({ envId: 'https://your-server.com', url: '/' })

// 获取 AI 文章摘要
const summary = await getArticleSummary({
  envId: 'https://your-server.com',
  content: '文章正文',
  url: '/post/1',
})
```

## 服务端部署

### 自托管（Node.js + SQLite）

最简单的部署方式，适合个人博客。

```bash
git clone https://github.com/TakoioJS/Takoio.git
cd Takoio
pnpm install
pnpm build:admin
pnpm --filter takoio-server build
pnpm --filter takoio-server start   # 默认 :8080
```

数据存储在 `data/takoio.db`（SQLite），零配置开箱即用。

反向代理示例（Nginx）：

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

### Vercel（Serverless + MongoDB）

1. Fork 本仓库，在 Vercel 导入
2. 设置环境变量 `DB_TYPE=mongodb` 和 `MONGODB_URI`（推荐 [MongoDB Atlas](https://www.mongodb.com/atlas) 免费版）
3. 部署即可，`vercel.json` 已配置构建命令

### Netlify（Serverless + MongoDB）

1. Fork 本仓库，在 Netlify 导入
2. 设置环境变量 `DB_TYPE=mongodb` 和 `MONGODB_URI`
3. `netlify.toml` 已配置构建命令和重定向规则

> **注意：** Serverless 环境不要使用 SQLite — 文件系统是临时的，函数重启后数据丢失。请使用 MongoDB Atlas。

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DB_TYPE` | 数据库类型：`sqlite` / `mongodb` / `postgres` | `sqlite` |
| `MONGODB_URI` | MongoDB 连接串（`DB_TYPE=mongodb` 时必填） | — |
| `POSTGRES_URL` | PostgreSQL 连接串（`DB_TYPE=postgres` 时必填） | — |
| `TAKOIO_THROTTLE` | 同一 IP 请求间隔（ms） | `0` |
| `SETUP_TOKEN` | 首次设置令牌，防止未授权抢占管理员密码 | — |
| `REDIS_URL` | Redis 连接（限流、缓存） | — |
| `AUTH_JWT_SECRET` | JWT 签名密钥（社交登录必配） | — |
| `GITHUB_CLIENT_ID` | GitHub OAuth Client ID | — |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth Client Secret | — |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | — |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | — |
| `LOG_LEVEL` | 日志级别：`debug` / `info` / `warn` / `error` | 开发 `debug`，生产 `info` |
| `TZ` | 时区 | `Asia/Shanghai` |

## 客户端配置

`init()` 的常用配置项，完整类型见 [types.ts](./src/client/types.ts)。

| 选项 | 类型 | 说明 |
|------|------|------|
| `envId` | `string` | **必填**，服务端 URL |
| `el` | `string \| HTMLElement` | 挂载元素选择器 |
| `path` | `string` | 当前页面路径（评论关联 key） |
| `pathNormalize` | `string` | 路径规范化：`exact` / `remove-trailing-slash` / `add-trailing-slash` / `auto` |
| `lang` | `string` | 语言：`zh-CN` / `zh-TW` / `en` |
| `pageSize` | `number` | 每页评论数，默认 `10` |
| `sort` | `string` | 排序：`newest` / `oldest` / `hottest` |
| `brandColor` | `string` | 品牌色，如 `'#10b981'` |
| `enableCodeHighlight` | `boolean` | 代码高亮，默认 `true` |
| `enableCaptcha` | `boolean` | 人机验证 |
| `enableArticleReaction` | `boolean` | 文章表情反应 |
| `enableCommentReaction` | `boolean` | 评论表情反应 |
| `visitorCounter` | `boolean` | 显示浏览量 |
| `enableSummary` | `boolean` | AI 文章摘要 |
| `articleContent` | `string` | 文章正文（启用摘要时必传） |
| `paginationMode` | `string` | `pagination`（分页）/ `readmore`（加载更多） |
| `customCSS` | `string` | 自定义 CSS |
| `placeholder` | `string` | 评论框占位符 |
| `texRenderer` | `(blockMode, tex) => string \| Promise<string>` | 外部数学公式渲染器 |
| `onCommentPosted` | `(comment) => void` | 评论发布回调 |
| `onCommentsLoaded` | `(comments) => void` | 评论加载回调 |
| `onLoginSuccess` | `() => void` | 登录成功回调（含社交登录） |
| `onLogoutSuccess` | `() => void` | 登出成功回调 |

### 数学公式

Takoio 默认不内置 KaTeX。需要公式渲染时，由宿主页面引入 renderer：

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

## 开发

```bash
git clone https://github.com/TakoioJS/Takoio.git
cd Takoio
pnpm install
pnpm dev
```

启动后：

- Server → `http://localhost:8080`（Nitro dev server）
- Client → `http://127.0.0.1:9820`（Vite dev server）
- Admin → `http://127.0.0.1:9820/admin/`

### 项目结构

```
Takoio/
├── packages/
│   ├── common/          # @takoio/common — 共享 i18n、类型、工具
│   └── core/            # @takoio/core — 核心 API、timeago
├── src/
│   ├── client/          # 客户端组件（Vue 3）— npm 包
│   ├── server/          # 服务端（Nitro 3）— workspace 包
│   │   ├── core/        #   业务逻辑（DB、认证、审核、通知等）
│   │   └── nitro/       #   路由、中间件、插件
│   └── admin/           # 管理面板（Vue 3 + Naive UI）— workspace 包
├── e2e/                 # Playwright 端到端测试
├── dist/                # 客户端构建产物（ESM / CJS / UMD）
├── docs/                # 设计文档
├── dev.mjs              # 一键启动开发环境
└── vite.config.ts       # 客户端库构建配置
```

### 技术栈

客户端：Vue 3.5、Vite 8、UnoCSS、Pinia、Marked、highlight.js、DOMPurify

服务端：Nitro 3、h3、Drizzle ORM、LibSQL/MongoDB/PostgreSQL、Shiki、Vercel AI SDK、Zod、Nodemailer、Pushoo

管理面板：Vue 3、Vue Router 5、Pinia 3、Naive UI

### 测试

```bash
pnpm test          # 单元测试（Vitest）
pnpm test:e2e      # 端到端测试（Playwright）
pnpm type-check    # 类型检查（vue-tsc）
pnpm lint          # 代码检查（ESLint）
```

## 架构

```
┌─────────────────────────────────────┐
│  Client Widget (npm / CDN)          │  ← 嵌入式评论组件
│  Vue 3 · UMD ~83 kB gzip           │
└──────────────┬──────────────────────┘
               │ HTTP / REST
┌──────────────▼──────────────────────┐
│  Server API (Nitro 3)               │  ← 统一 API 层
│  路由 · 中间件 · 插件               │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  Store (SQLite / MongoDB)           │  ← 数据持久化
│  + Redis (可选, AI 缓存)            │
└─────────────────────────────────────┘
```

服务端采用 4 层架构：路由层（Nitro file-based routes）→ 中间件层（CORS / 限流 / 日志）→ Handler 层（业务分发）→ Core 层（DB / 认证 / 审核 / 通知）。Store 通过 `registerStoreBackend` 注册模式解耦，Core 不硬编码特定数据库 import。

## 许可证

[MIT](./LICENSE) — Copyright 2024-present PaloMiku and Takoio Contributors

Derived from [Twikoo](https://github.com/twikoojs/twikoo) (MIT License).
