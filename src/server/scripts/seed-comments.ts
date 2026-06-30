/**
 * Seed 50 条虚拟评论（含嵌套回复）到 SQLite，用于评论区展示与性能测试。
 *
 * 用法（在 src/server/ 下）：
 *   pnpm tsx scripts/seed-comments.ts                # 默认 url=/test-article
 *   SEED_URL=/some/path pnpm tsx scripts/seed-comments.ts
 *   SEED_URL=/test-article SEED_WIPE=1 pnpm tsx scripts/seed-comments.ts   # 先清空该 url 下的旧评论
 *
 * 不会启动开发服务器，只直接写库。
 */

import { randomUUID, createHash } from 'node:crypto'
import { commentStore, ensureDb, initStore } from '../core/store/index'
import { getDb } from '../core/db/client'
import { comments } from '../core/db/schema'
import { eq, sql } from 'drizzle-orm'

const SEED_URL = process.env.SEED_URL || '/test-article'
const SEED_WIPE = process.env.SEED_WIPE === '1' || process.env.SEED_WIPE === 'true'

// ─── 模拟数据池 ─────────────────────────────────────────────────────────────
const AUTHORS = [
  { nick: '前端小明', mail: 'xiaoming@example.com', link: 'https://xiaoming.dev' },
  { nick: '后端老王', mail: 'laowang@example.com', link: '' },
  { nick: '全栈阿强', mail: 'aqiang@example.com', link: 'https://aqiang.me' },
  { nick: '设计师小美', mail: 'xiaomei@example.com', link: '' },
  { nick: '运维大刘', mail: 'daliu@example.com', link: 'https://daliu.ops' },
  { nick: '产品经理Lily', mail: 'lily@example.com', link: '' },
  { nick: '实习生小赵', mail: 'xiaozhao@example.com', link: '' },
  { nick: 'Architect周', mail: 'zhou@example.com', link: 'https://zhou.blog' },
  { nick: 'Tester甜甜', mail: 'tiantian@example.com', link: '' },
  { nick: 'DevOps老李', mail: 'laoli@example.com', link: '' },
  { nick: '匿名访客', mail: '', link: '' },
  { nick: 'Vue爱好者', mail: 'vuefan@example.com', link: 'https://vuefan.org' },
  { nick: 'Rust吹', mail: 'rustacean@example.com', link: '' },
  { nick: '摸鱼达人', mail: 'moyu@example.com', link: '' },
]

const UAS = [
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', region: '中国·上海' },
  { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15', region: '中国·北京' },
  { ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36', region: '中国·深圳' },
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0', region: '中国·广州' },
  { ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1', region: '中国·杭州' },
  { ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36', region: '中国·成都' },
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0', region: '中国·武汉' },
  { ua: 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1', region: '中国·南京' },
]

// 顶级评论语料 — 模拟真实博客讨论
const TOPIC_TEXTS = [
  '这篇文章写得很清晰，Vue 3 的组合式 API 确实比 Options API 灵活很多，尤其是逻辑复用的场景。',
  '请问作者，嵌入式评论系统的鉴权是怎么做的？如果有人伪造请求直接调 API 提交垃圾评论怎么办？',
  '作为一个用了 Waline 很久的人，看到这个项目很兴奋。请问和 Waline 相比主要的差异点在哪里？',
  '代码高亮用的是 highlight.js 还是 shiki？看截图好像支持很多语言，打包体积会不会很大？',
  'AI 摘要功能很赞！不过我担心每次访问文章都会调用 LLM，成本会不会失控？有没有缓存策略？',
  '数据库选型上 SQLite 和 MongoDB 如何取舍？个人博客用 SQLite 够了吗？并发写入会不会有问题？',
  '前端组件的样式是怎么做主题适配的？看到有 CSS 变量，能不能完全自定义配色？',
  '表情包功能被移除了是为什么？我觉得这个功能对博客评论挺有用的呀 😅',
  '部署到 Vercel 的话，SQLite 还能用吗？还是必须切到 MongoDB/Turso？',
  '建议加一个邮件通知的功能，有人回复我的时候能收到邮件会很方便。看到代码里好像有 nodemailer？',
  '性能测试：这楼用来压测渲染性能。' + '这是很长的一段评论，用来测试长文本在评论列表中的渲染表现，包括换行、段落和行内代码 `const x = 1` 的展示。\n\n第二段：测试 markdown 段落分隔。\n\n第三段：列表测试\n- 项目一\n- 项目二\n- 项目三',
  '刚试了一下，发现回复嵌套好像最多只展示一层？深层的回复需要点击加载，是有意这样设计的吗？',
  '点赞和表情反应（Reaction）有什么区别？看起来是两套不同的系统？',
  'Akismet 审核和 AI 审核可以同时开启吗？还是只能二选一？',
  '这个项目支持暗黑模式吗？看 admin 后台有切换按钮，前端评论组件呢？',
  'redis 不可用的时候会降级到内存缓存，那重启服务器缓存不就全丢了？生产环境怎么处理？',
  '图片上传是存本地还是对象存储？有没有接 S3/OSS 的计划？',
  '评论的 markdown 渲染是在服务端还是客户端？如果服务端渲染会不会增加延迟？',
  '文章摘要生成的 system prompt 是写死的，能不能做成可配置的？不同站点可能想要不同风格的摘要。',
  'id 用的是 UUID，在 URL 里暴露会不会有安全风险？有没有考虑用 nanoid 或者哈希短 id？',
]

const REPLY_TEXTS = [
  '同感，组合式 API 解耦逻辑之后，可测试性强了很多。',
  '关于鉴权，可以看看 `src/server/core/auth.ts`，有 IP 限流 + 验证码 + token 三重防护。',
  '我也有同样的疑问，坐等作者回复。',
  ' Waline 偏重，这个项目主打轻量嵌入，SDK 打包后才 ~160KB gzip。',
  'highlight.js 按需注册语言，core 才 21KB，不会全量打包的。',
  '缓存 key 绑定了 content hash，同一篇文章内容不变的话 30 天内只调一次 LLM。',
  'SQLite 单机博客完全够用，QPS 不高的话并发写入不是问题。',
  '主题确实用 CSS 变量，覆盖 `--tk-brand` 等变量就能改配色。',
  '+1，邮件通知是刚需，希望尽快完善。',
  'Vercel 上 SQLite 不行，得用 Turso（libsql 兼容）或者切 MongoDB。',
  '感谢解答，明白了！',
  '我也踩过这个坑，深嵌套渲染性能很差，扁平化一层是合理的取舍。',
  'Reaction 是评论级的 emoji 表态，点赞是 like/dislike 二元计数，两套独立。',
  'Akismet 和 AI 审核是串行的：本地关键词 → Akismet → AI，不是二选一。',
  '暗黑模式前端也支持，跟随系统 `prefers-color-scheme`。',
  '内存缓存只是 dev 兜底，生产环境必须配 `REDIS_URL`。',
  '建议接个对象存储适配层，本地/ S3 / OSS 通过环境变量切换。',
  'markdown 在客户端渲染，服务端只存原文，避免延迟。',
  'system prompt 硬编码确实是个限制，可以提个 issue 建议配置化。',
  'UUID v4 是随机的，不可枚举，暴露在 URL 里风险可控。',
  '哈哈，摸鱼的时候看技术博客是常态。',
  '这个观点很有启发，谢谢分享！',
  '反对，我觉得表情包功能还是有必要的。',
  '请问有 demo 站点可以体验吗？',
  '已 star，持续关注这个项目。',
]

// ─── 工具 ────────────────────────────────────────────────────────────────────
const now = Date.now()
const HOUR = 3_600_000
const DAY = 86_400_000
let _seq = 0
/** 单调递增的创建时间：从 60 天前到现在，按插入顺序递增 */
const nextCreated = () => now - 60 * DAY + Math.floor((_seq++ / 50) * 60 * DAY) + Math.floor(Math.random() * HOUR)
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]
const randInt = (max: number) => Math.floor(Math.random() * max)

/** md5 — 与 handler 保持一致（用于 mailMd5） */
const md5 = (s: string) => createHash('md5').update(s.trim().toLowerCase()).digest('hex')

interface SeedRow {
  id: string
  url: string
  href: string | null
  nick: string
  mail: string
  mailMd5: string
  link: string
  comment: string
  ua: string
  ip: string
  state: string
  created: number
  updated: number | null
  pid: string | null
  rid: string | null
  like: number
  dislike: number
  isSpam: number
  isTop: number
  isPinned: number
  image: string | null
  sticker: string | null
  ipRegion: string | null
  tags: string | null
  renderedComment: string | null
}

function buildAuthor () {
  const a = pick(AUTHORS)
  return {
    nick: a.nick,
    mail: a.mail,
    mailMd5: a.mail ? md5(a.mail) : '',
    link: a.link,
  }
}

function buildRow (opts: {
  comment: string
  pid: string | null
  rid: string | null
  created: number
  isTop?: boolean
  like?: number
  dislike?: number
}): SeedRow {
  const au = buildAuthor()
  const u = pick(UAS)
  // 伪造一个看起来合理的 IPv4
  const ip = `${randInt(223) + 1}.${randInt(255)}.${randInt(255)}.${randInt(254) + 1}`
  return {
    id: randomUUID(),
    url: SEED_URL,
    href: null,
    nick: au.nick,
    mail: au.mail,
    mailMd5: au.mailMd5,
    link: au.link,
    comment: opts.comment,
    ua: u.ua,
    ip,
    state: 'visible',
    created: opts.created,
    updated: null,
    pid: opts.pid,
    rid: opts.rid,
    like: opts.like ?? randInt(40),
    dislike: opts.dislike ?? randInt(5),
    isSpam: 0,
    isTop: opts.isTop ? 1 : 0,
    isPinned: 0,
    image: null,
    sticker: null,
    ipRegion: u.region,
    tags: null,
    renderedComment: null,
  }
}

// ─── 构造 50 条嵌套评论 ──────────────────────────────────────────────────────
function buildComments (): SeedRow[] {
  const rows: SeedRow[] = []
  // 20 条顶级评论
  const tops: SeedRow[] = []
  for (let i = 0; i < 20; i++) {
    const created = nextCreated()
    const top = buildRow({
      comment: TOPIC_TEXTS[i % TOPIC_TEXTS.length],
      pid: null,
      rid: null,
      created,
      isTop: i === 0, // 第 1 条置顶
      like: i === 0 ? 128 : randInt(60),
    })
    tops.push(top)
    rows.push(top)
  }

  // 给前 12 条顶级评论各加 1~3 条回复（共约 24 条），部分回复再嵌套子回复
  for (let i = 0; i < 12 && rows.length < 50; i++) {
    const parent = tops[i]
    const n = 1 + randInt(3) // 1~3 条直接回复
    for (let j = 0; j < n && rows.length < 50; j++) {
      const created = parent.created + (j + 1) * (randInt(6) + 1) * HOUR
      const reply = buildRow({
        comment: pick(REPLY_TEXTS),
        pid: parent.id,
        rid: parent.id, // rid 指向根评论
        created,
        like: randInt(25),
      })
      rows.push(reply)

      // 30% 概率给回复再加一条子回复（三层嵌套）
      if (Math.random() < 0.3 && rows.length < 50) {
        const subCreated = created + (randInt(3) + 1) * HOUR
        const sub = buildRow({
          comment: pick(REPLY_TEXTS),
          pid: reply.id,
          rid: parent.id, // rid 仍指向根
          created: subCreated,
          like: randInt(10),
        })
        rows.push(sub)
      }
    }
  }

  // 若仍不足 50，用顶级评论补齐
  while (rows.length < 50) {
    const created = nextCreated()
    rows.push(buildRow({
      comment: pick(TOPIC_TEXTS),
      pid: null,
      rid: null,
      created,
      like: randInt(30),
    }))
  }

  return rows.slice(0, 50)
}

// ─── 主流程 ──────────────────────────────────────────────────────────────────
async function main () {
  await ensureDb()
  await initStore()

  if (SEED_WIPE) {
    const db = getDb()
    const deleted = await db.delete(comments).where(eq(comments.url, SEED_URL)).run()
    console.info(`[seed] 已清空 url=${SEED_URL} 下的 ${deleted.rowsAffected} 条旧评论`)
  }

  const rows = buildComments()
  const topLevel = rows.filter(r => !r.pid).length
  const replies = rows.length - topLevel

  // 批量插入
  for (const r of rows) {
    await commentStore.addComment({
      id: r.id,
      url: r.url,
      href: r.href,
      nick: r.nick,
      mail: r.mail,
      mailMd5: r.mailMd5,
      link: r.link,
      comment: r.comment,
      ua: r.ua,
      ip: r.ip,
      state: r.state,
      created: r.created,
      updated: r.updated,
      pid: r.pid,
      rid: r.rid,
      like: r.like,
      dislike: r.dislike,
      isSpam: !!r.isSpam,
      isTop: !!r.isTop,
      isPinned: !!r.isPinned,
      image: r.image,
      ipRegion: r.ipRegion,
      tags: r.tags,
      renderedComment: r.renderedComment,
    })
  }

  // 校验
  const db = getDb()
  const total = await db.select({ count: sql<number>`count(*)` }).from(comments).where(eq(comments.url, SEED_URL)).get()
  const withPid = await db.select({ count: sql<number>`count(*)` }).from(comments)
    .where(sql`${comments.url} = ${SEED_URL} AND ${comments.pid} IS NOT NULL`).get()

  console.info(`[seed] 写入完成 url=${SEED_URL}`)
  console.info(`[seed]   插入 ${rows.length} 条（顶级 ${topLevel}，回复 ${replies}，其中含三层嵌套）`)
  console.info(`[seed]   DB 校验：总数 ${total?.count}，有 pid 的 ${withPid?.count}`)
  console.info(`[seed]   时间跨度：${new Date(Math.min(...rows.map(r => r.created))).toISOString().slice(0, 10)} ~ ${new Date(Math.max(...rows.map(r => r.created))).toISOString().slice(0, 10)}`)
  console.info(`[seed]   置顶评论：${rows.filter(r => r.isTop).length} 条`)
}

main().catch(err => {
  console.error('[seed] 失败:', err)
  process.exit(1)
})
