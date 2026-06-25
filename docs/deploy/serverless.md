# 云函数部署

Takoio 服务端支持部署到 Vercel、Netlify、AWS Lambda、腾讯 SCF 等云函数平台。

## 准备工作

- 一个 [MongoDB 数据库](https://www.mongodb.com/)（推荐 MongoDB Atlas 免费版）
- 一个 GitHub 仓库包含完整项目代码

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `DB_TYPE` | 是 | 必须设为 `mongodb`（云函数环境不能用 SQLite） |
| `MONGODB_URI` | 是 | MongoDB 连接串，如 `mongodb+srv://user:pass@cluster.mongodb.net/takoio` |
| `MONGODB_DB` | 否 | 数据库名，默认 `takoio` |
| `TAKOIO_THROTTLE` | 否 | API 限流间隔（毫秒），默认 `250` |

## Vercel 部署

项目根目录已包含 `vercel.json` 和 `api/takoio.ts`，Vercel 会自动识别。无需手动设置 Root Directory 或 Build Command。

### 方式一：一键部署

[![Deploy to Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/TakoioJS/Takoio&env=DB_TYPE,MONGODB_URI&project-name=takoio&repository-name=takoio)

### 方式二：手动导入

1. Fork 本仓库
2. 在 Vercel 中导入项目（**不要**修改 Root Directory，保持项目根目录）
3. Vercel 会自动读取 `vercel.json`，确认以下设置：
   - **Framework Preset**: Other
   - **Install Command**: `pnpm install`（自动读取）
   - **Build Command**: 自动读取（安装 server workspace 依赖）

4. 在 Environment Variables 中设置：
   - `DB_TYPE = mongodb`
   - `MONGODB_URI = <你的 MongoDB 连接串>`

5. 部署后在项目 Settings → Functions 中确认函数配置：
   - **Memory**: 256 MB
   - **Max Duration**: 30 s

6. 客户端配置：
   ```js
   takoio.init({
     envId: 'https://your-project.vercel.app'
   })
   ```

### vercel.json 说明

```jsonc
{
  "installCommand": "pnpm install",
  "buildCommand": "cd src/server/self-hosted && pnpm install",
  "framework": null,
  "outputDirectory": "public",
  "rewrites": [{ "source": "/(.*)", "destination": "/api/takoio" }],
  "functions": {
    "api/takoio.ts": {
      "memory": 256,
      "maxDuration": 30,
      "includeFiles": "src/server/self-hosted/**/*.ts"
    }
  }
}
```

- `rewrites` 将所有请求路由到 `api/takoio.ts` 云函数
- `includeFiles` 确保服务端源码被包含在函数部署包中
- `buildCommand` 安装 server workspace 的独立依赖（MongoDB driver、Hono 等）

## Netlify 部署

项目根目录已包含 `netlify.toml` 和 `netlify/functions/takoio.ts`，Netlify 会自动识别。

1. Fork 本仓库
2. 在 Netlify 中导入项目
3. Netlify 自动读取 `netlify.toml`，确认：
   - **Build Command**: `npm install -g pnpm@9 && pnpm install && cd src/server/self-hosted && npx tsc`
   - **Functions directory**: `netlify/functions`
   - **Node bundler**: esbuild

4. 设置环境变量：
   - `DB_TYPE = mongodb`
   - `MONGODB_URI = <你的 MongoDB 连接串>`

5. 客户端配置同上。

## 注意事项

### 数据库
**不要用 SQLite**：云函数的文件系统是临时的，重启后数据会丢失。必须使用 `DB_TYPE=mongodb`。

### 冷启动
首次请求需要初始化 MongoDB 连接和加载依赖，大约 1-3 秒。后续请求为毫秒级。

### Serverless 架构限制

云函数的每个实例拥有独立的内存空间，以下状态**不跨实例共享**：

| 状态 | 影响 | 缓解措施 |
|------|------|---------|
| API 限流计数 | 每个实例独立计数，冷启动后归零 | 对大多数博客场景影响不大 |
| 登录暴力破解防护 | 每个实例独立追踪，冷启动后归零 | MongoDB session 有 24h TTL 自动过期 |
| 密码哈希缓存 | 冷启动后重新从数据库加载 | 已做 60s TTL 缓存，影响极小 |

如需严格的跨实例限流，建议通过 MongoDB 实现集中式计数（配合 TTL index 自动过期）。

### 图片上传
图片上传功能**无需额外配置**即可在云函数中使用。Takoio 不写本地磁盘，而是通过配置的图床提供商 API 做代理上传。当前支持：

| 提供商 | 配置项 | 适合场景 |
|--------|--------|---------|
| SEE / Lsky Pro / EasyImage / PicList / Chevereto | 管理面板 → 图床设置 | 自建图床 |
| 腾讯云 COS / DogeCloud / Cloudflare R2 | 管理面板 → S3 兼容设置 | 对象存储 |

用户上传图片后，服务端将 base64 转发给图床，返回可公开访问的 URL。不占用云函数磁盘空间。

### IP 地域查询
`ip2region-ts` 依赖的 `ip2region.db` 文件会随 `node_modules` 自动部署，云函数中可直接使用。若文件读取失败（如平台限制），自动降级返回空字符串，不影响评论功能。

### Session 管理
MongoDB 的 sessions 集合使用 TTL index 自动清理过期文档（24 小时），无需应用层定时器。