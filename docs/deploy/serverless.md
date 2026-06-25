# 云函数部署

Takoio 服务端支持部署到 Vercel、Netlify、AWS Lambda、腾讯 SCF 等云函数平台。

## 准备工作

- 一个 [MongoDB 数据库](https://www.mongodb.com/)（推荐 MongoDB Atlas 免费版）
- 一个 GitHub 仓库包含完整项目代码

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `DB_TYPE` | 否 | 设为 `mongodb` 即可启用 MongoDB（云函数推荐） |
| `MONGODB_URI` | 是 | MongoDB 连接串，如 `mongodb+srv://user:pass@cluster.mongodb.net/takoio` |
| `TAKOIO_THROTTLE` | 否 | API 限流间隔（毫秒），默认 `250` |

## Vercel 部署

### 方式一：一键部署

[![Deploy to Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/takoio/takoio&env=DB_TYPE,MONGODB_URI&project-name=takoio&repository-name=takoio)

### 方式二：手动配置

1. Fork 本仓库
2. 在 Vercel 中导入项目
3. 构建设置：
   - **Framework Preset**: Other
   - **Root Directory**: `src/server/self-hosted`
   - **Build Command**: `npx tsc`
   - **Output Directory**: `.`
   - **Entry**: `cloud-entry.ts`

4. 在 Environment Variables 中设置：
   - `DB_TYPE = mongodb`
   - `MONGODB_URI = <你的 MongoDB 连接串>`

5. 部署后在项目 Settings → Functions 中将函数内存设为至少 **256 MB**（Hono 冷启动需要）

6. 客户端配置：
   ```js
   takoio.init({
     envId: 'https://your-project.vercel.app'
   })
   ```

## Netlify 部署

1. Fork 本仓库
2. 在 Netlify 中导入项目
3. 构建设置：
   - **Base directory**: `src/server/self-hosted`
   - **Build Command**: `npx tsc`
   - **Publish directory**: 留空
   - **Functions directory**: `netlify/functions`

4. 创建 `netlify/functions/takoio.ts`：

```ts
import { fetch } from '../../cloud-entry'

export const handler = async (event: any) => {
  const url = new URL(event.path, `https://${event.headers.host}`)
  const request = new Request(url, {
    method: event.httpMethod,
    headers: new Headers(event.headers as Record<string, string>),
    body: event.body ? Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8') : null,
  })
  return { statusCode: 200, headers: {}, body: '' }
}
```

> 以上为示意，实际 Netlify Functions v2 原生支持 `export default { fetch }`。

5. 设置环境变量 `DB_TYPE=mongodb` + `MONGODB_URI`

6. 客户端配置同上。

## 注意事项

### 数据库
- **不要用 SQLite**：云函数的文件系统是临时的，重启后数据会丢失。必须使用 `DB_TYPE=mongodb` + MongoDB Atlas。

### 冷启动
- 首次请求需要初始化数据库连接和加载依赖，大约 1-3 秒。后续请求为毫秒级。

### 图片上传
图片上传功能**无需额外配置**即可在云函数中使用。Takoio 不写本地磁盘，而是通过配置的图床提供商 API 做代理上传。当前支持：

| 提供商 | 配置项 | 适合场景 |
|--------|--------|---------|
| SEE / Lsky Pro / EasyImage / PicList / Chevereto | 管理面板 → 图床设置 | 自建图床 |
| 腾讯云 COS / DogeCloud / Cloudflare R2 | 管理面板 → S3 兼容设置 | 对象存储 |

用户上传图片后，服务端将 base64 转发给图床，返回可公开访问的 URL。不占用云函数磁盘空间。

### IP 地域查询
`ip2region-ts` 依赖的 `ip2region.db` 文件会随 `node_modules` 自动部署，云函数中可直接使用。若文件读取失败（如平台限制），自动降级返回空字符串，不影响评论功能。