/**
 * Image handlers — upload via external image hosting.
 * In-memory image storage has been removed; uploads require an external provider.
 * Supports NSFW detection via self-hosted nsfwpy or ModelArk (ai.gitee.com) API.
 */

import { createHash, createHmac, randomUUID } from 'node:crypto'
import { safeValidate } from '../schemas'
import { UploadImageSchema } from '../schemas'
import { MAX_UPLOAD_SIZE, getConfig } from '../config'
import { AppError } from '../config'
import { logger } from '../utils/logger'

// ========== Detect Image Type (magic bytes) ==========

/** 检查 base64 解码后的 magic bytes，返回 MIME type 或 null */
export const detectImageType = (base64: string): string | null => {
  const raw = base64.includes(',') ? base64.split(',')[1] : base64
  // Decode enough bytes for all supported signatures (WebP needs 12 bytes)
  const buf = Buffer.from(raw.slice(0, 24), 'base64')
  if (buf.length < 12) return null

  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return 'image/png'
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'image/jpeg'
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'image/gif'
  // WebP: RIFF....WEBP
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return 'image/webp'

  return null
}

// ========== NSFW Detection Helpers ==========

interface NsfwResult {
  isNsfw: boolean
  score: number
}

/**
 * 调用自部署 nsfwpy API 检测图片
 * @see https://github.com/HG-ha/nsfwpy
 */
const detectNsfwSelfHosted = async (base64Data: string, endpoint: string, threshold: number): Promise<NsfwResult> => {
  const url = endpoint.replace(/\/+$/, '') + '/predict'
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64Data }),
  })

  if (!res.ok) {
    throw new AppError('NSFW_API_ERROR', `自部署 NSFW API 返回错误: ${res.status}`, 502)
  }

  const data = await res.json() as any

  // nsfwpy 返回格式: { predictions: [{ label: 'porn'|'hentai'|'sexy'|'neutral'|'drawing', score: number }] }
  const predictions = data.predictions || []
  const porn = predictions.find((p: any) => p.label === 'porn')
  const hentai = predictions.find((p: any) => p.label === 'hentai')
  const sexy = predictions.find((p: any) => p.label === 'sexy')

  // 取 porn/hentai/sexy 中最高的分数
  const maxScore = Math.max(
    porn?.score ?? 0,
    hentai?.score ?? 0,
    sexy?.score ?? 0
  )

  return { isNsfw: maxScore > threshold, score: maxScore }
}

/**
 * 调用模力方舟 (ai.gitee.com) NSFW 检测 API
 * @see https://ai.gitee.com
 */
const detectNsfwModelArk = async (base64Data: string, apiKey: string, threshold: number): Promise<NsfwResult> => {
  const endpoint = 'https://ai.gitee.com/v1/moderations'
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'nsfw-classifier',
      input: base64Data,
    }),
  })

  if (!res.ok) {
    throw new AppError('NSFW_API_ERROR', `模力方舟 API 返回错误: ${res.status}`, 502)
  }

  const data = await res.json() as any

  const results = data.results || []
  const maxScore = results.reduce((max: number, r: any) => {
    const scores = r.category_scores || {}
    return Object.values(scores).reduce((m: number, s: any) => Math.max(m, Number(s) || 0), max)
  }, 0)

  const flagged = results.some((r: any) => r.flagged === true)

  return { isNsfw: flagged || maxScore > threshold, score: maxScore }
}

/**
 * 根据配置执行 NSFW 检测
 * 返回 { isNsfw, score }，isNsfw=true 表示图片不合规
 */
export const checkImageNsfw = async (base64Data: string): Promise<NsfwResult | null> => {
  const cfg = await getConfig()
  if (!cfg.ENABLE_NSFW_DETECTION) return null

  const threshold = cfg.NSFW_THRESHOLD ?? 0.5
  const service = cfg.NSFW_SERVICE || 'self'

  if (service === 'self') {
    if (!cfg.NSFW_ENDPOINT) {
      throw new AppError('NSFW_NOT_CONFIGURED', '自部署 NSFW API 地址未配置，请在管理面板中设置 NSFW_ENDPOINT', 400)
    }
    return detectNsfwSelfHosted(base64Data, cfg.NSFW_ENDPOINT, threshold)
  }

  if (service === 'modelark') {
    if (!cfg.NSFW_API_KEY) {
      throw new AppError('NSFW_NOT_CONFIGURED', '模力方舟 API Key 未配置，请在管理面板中设置 NSFW_API_KEY', 400)
    }
    return detectNsfwModelArk(base64Data, cfg.NSFW_API_KEY, threshold)
  }

  logger.warn({ service }, '未知的 NSFW 检测服务')
  return null
}

// ========== Upload Helpers ==========

const base64ToBuffer = (base64: string): Buffer => {
  const raw = base64.includes(',') ? base64.split(',')[1] : base64
  return Buffer.from(raw, 'base64')
}

const ALLOWED_IMAGE_EXTS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

const generateFilename = (mimeType: string): string => {
  const ext = ALLOWED_IMAGE_EXTS[mimeType] || 'png'
  return `${Date.now().toString(36)}${randomUUID().slice(0, 8)}.${ext}`
}

const buildMultipart = (
  fields: Record<string, string>,
  fileField: string,
  filename: string,
  buffer: Buffer,
  mimeType: string
): { body: Blob; contentType: string } => {
  const boundary = `----Takoio${randomUUID().slice(0, 12)}`
  const parts: Buffer[] = []
  for (const [key, value] of Object.entries(fields)) {
    parts.push(Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}`))
  }
  parts.push(Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="${fileField}"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`))
  parts.push(buffer)
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`))
  return { body: new Blob([Buffer.concat(parts)]), contentType: `multipart/form-data; boundary=${boundary}` }
}

// ========== Provider Upload Implementations ==========

const uploadSEE = async (buffer: Buffer, filename: string, mimeType: string, cfg: any): Promise<string> => {
  const endpoint = cfg.IMAGE_HOSTING_ENDPOINT
  const token = cfg.IMAGE_HOSTING_TOKEN
  if (!endpoint) throw new AppError('CONFIG_MISSING', 'SEE endpoint 未配置', 400)
  if (!token) throw new AppError('CONFIG_MISSING', 'SEE token 未配置', 400)
  const { body, contentType } = buildMultipart({}, 'file', filename, buffer, mimeType)
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': contentType },
    body,
  })
  if (!res.ok) throw new AppError('UPLOAD_FAILED', `SEE 上传失败: ${res.status}`, 502)
  const data = await res.json() as any
  if (data.code !== 0) throw new AppError('UPLOAD_FAILED', `SEE 返回错误: ${data.message || 'unknown'}`, 502)
  return data.data.url
}

const uploadLskyPro = async (buffer: Buffer, filename: string, mimeType: string, cfg: any): Promise<string> => {
  const endpoint = cfg.IMAGE_HOSTING_ENDPOINT
  const token = cfg.IMAGE_HOSTING_TOKEN
  if (!endpoint) throw new AppError('CONFIG_MISSING', 'Lsky Pro endpoint 未配置', 400)
  if (!token) throw new AppError('CONFIG_MISSING', 'Lsky Pro token 未配置', 400)
  const { body, contentType } = buildMultipart({}, 'file', filename, buffer, mimeType)
  const url = `${endpoint.replace(/\/+$/, '')}/api/v1/upload`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': contentType, 'Accept': 'application/json' },
    body,
  })
  if (!res.ok) throw new AppError('UPLOAD_FAILED', `Lsky Pro 上传失败: ${res.status}`, 502)
  const data = await res.json() as any
  if (data.status !== true) throw new AppError('UPLOAD_FAILED', `Lsky Pro 返回错误: ${data.message || 'unknown'}`, 502)
  return data.data.links.url
}

const uploadEasyImage = async (buffer: Buffer, filename: string, mimeType: string, cfg: any): Promise<string> => {
  const endpoint = cfg.IMAGE_HOSTING_ENDPOINT
  const token = cfg.IMAGE_HOSTING_TOKEN
  if (!endpoint) throw new AppError('CONFIG_MISSING', 'EasyImage endpoint 未配置', 400)
  if (!token) throw new AppError('CONFIG_MISSING', 'EasyImage token 未配置', 400)
  const { body, contentType } = buildMultipart({ token }, 'image', filename, buffer, mimeType)
  const url = `${endpoint.replace(/\/+$/, '')}/api/index.php`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body,
  })
  if (!res.ok) throw new AppError('UPLOAD_FAILED', `EasyImage 上传失败: ${res.status}`, 502)
  const data = await res.json() as any
  if (data.result !== 'success') throw new AppError('UPLOAD_FAILED', `EasyImage 返回错误: ${data.result || 'unknown'}`, 502)
  return data.url
}

const uploadPicList = async (buffer: Buffer, filename: string, mimeType: string, cfg: any): Promise<string> => {
  const endpoint = cfg.IMAGE_HOSTING_ENDPOINT
  const token = cfg.IMAGE_HOSTING_TOKEN
  if (!endpoint) throw new AppError('CONFIG_MISSING', 'PicList endpoint 未配置', 400)
  const { body, contentType } = buildMultipart({}, 'image', filename, buffer, mimeType)
  const url = `${endpoint.replace(/\/+$/, '')}/upload${token ? `?key=${encodeURIComponent(token)}` : ''}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body,
  })
  if (!res.ok) throw new AppError('UPLOAD_FAILED', `PicList 上传失败: ${res.status}`, 502)
  const data = await res.json() as any
  if (data.success !== true) throw new AppError('UPLOAD_FAILED', 'PicList 返回错误', 502)
  return data.result[0]
}

const uploadChevereto = async (buffer: Buffer, filename: string, mimeType: string, cfg: any): Promise<string> => {
  const endpoint = cfg.IMAGE_HOSTING_ENDPOINT
  const token = cfg.IMAGE_HOSTING_TOKEN
  if (!endpoint) throw new AppError('CONFIG_MISSING', 'Chevereto endpoint 未配置', 400)
  if (!token) throw new AppError('CONFIG_MISSING', 'Chevereto API key 未配置', 400)
  const { body, contentType } = buildMultipart({}, 'source', filename, buffer, mimeType)
  const url = `${endpoint.replace(/\/+$/, '')}/api/1/upload`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'X-API-Key': token, 'Content-Type': contentType },
    body,
  })
  if (!res.ok) throw new AppError('UPLOAD_FAILED', `Chevereto 上传失败: ${res.status}`, 502)
  const data = await res.json() as any
  if (data.status_code !== 200) throw new AppError('UPLOAD_FAILED', `Chevereto 返回错误: ${data.status_txt || 'unknown'}`, 502)
  return data.image.url
}

// ========== AWS Signature V4 for S3-compatible uploads ==========

const sha256 = (data: string | Buffer): string =>
  createHash('sha256').update(data).digest('hex')

const hmacSha256 = (key: string | Buffer, data: string): Buffer =>
  createHmac('sha256', key).update(data).digest()

const getSignatureKey = (key: string, dateStamp: string, region: string, service: string): Buffer => {
  const kDate = hmacSha256(`AWS4${key}`, dateStamp)
  const kRegion = hmacSha256(kDate, region)
  const kService = hmacSha256(kRegion, service)
  return hmacSha256(kService, 'aws4_request')
}

const uploadS3Compatible = async (buffer: Buffer, filename: string, mimeType: string, cfg: any): Promise<string> => {
  const endpoint = cfg.IMAGE_HOSTING_ENDPOINT
  const bucket = cfg.IMAGE_HOSTING_BUCKET
  const region = cfg.IMAGE_HOSTING_REGION || 'us-east-1'
  const accessKey = cfg.IMAGE_HOSTING_ACCESS_KEY
  const secretKey = cfg.IMAGE_HOSTING_SECRET_KEY
  if (!endpoint) throw new AppError('CONFIG_MISSING', 'S3 endpoint 未配置', 400)
  if (!bucket) throw new AppError('CONFIG_MISSING', 'S3 bucket 未配置', 400)
  if (!accessKey || !secretKey) throw new AppError('CONFIG_MISSING', 'S3 AccessKey/SecretKey 未配置', 400)

  const host = endpoint.replace(/^https?:\/\//, '').replace(/\/+$/, '')
  const url = `https://${host}/${bucket}/${filename}`
  const now = new Date()
  const amzDate = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const dateStamp = amzDate.slice(0, 8)
  const payloadHash = sha256(buffer)
  const service = 's3'

  const canonicalUri = `/${bucket}/${filename}`
  const canonicalQueryString = ''
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date'
  const canonicalHeaders = `content-type:${mimeType}\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`
  const canonicalRequest = `PUT\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`

  const algorithm = 'AWS4-HMAC-SHA256'
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
  const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${sha256(canonicalRequest)}`

  const signingKey = getSignatureKey(secretKey, dateStamp, region, service)
  const signature = hmacSha256(signingKey, stringToSign).toString('hex')
  const authorization = `${algorithm} Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': mimeType,
      'Content-Length': String(buffer.length),
      'Host': host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      'Authorization': authorization,
    },
    body: new Blob([buffer as any]),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new AppError('UPLOAD_FAILED', `S3 上传失败: ${res.status} ${text.slice(0, 200)}`, 502)
  }

  const cdnDomain = cfg.IMAGE_HOSTING_CDN_DOMAIN
  if (cdnDomain) {
    return `https://${cdnDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '')}/${filename}`
  }
  return url
}

// ========== Provider Dispatch ==========

const PROVIDER_UPLOADERS: Record<string, (buffer: Buffer, filename: string, mimeType: string, cfg: any) => Promise<string>> = {
  see: uploadSEE,
  lskypro: uploadLskyPro,
  easyimage: uploadEasyImage,
  piclist: uploadPicList,
  chevereto: uploadChevereto,
  qcloud: uploadS3Compatible,
  dogecloud: uploadS3Compatible,
  r2: uploadS3Compatible,
  s3: uploadS3Compatible,
}

// ========== Upload Image ==========

export const handleUploadImage = async (data: any) => {
  const validation = safeValidate(UploadImageSchema, data)
  if (!validation.success) throw new AppError('INVALID_INPUT', '无图片数据', 400)
  // Decode base64 and check actual buffer size
  const buffer = base64ToBuffer(validation.data.image)
  if (buffer.length > MAX_UPLOAD_SIZE) { throw new AppError('INVALID_INPUT', '图片超过 5MB', 400) }

  const mimeType = detectImageType(validation.data.image)
  if (!mimeType) throw new AppError('INVALID_INPUT', '图片格式无效，仅支持 PNG/JPEG/GIF/WebP', 400)

  const nsfwResult = await checkImageNsfw(validation.data.image)
  if (nsfwResult?.isNsfw) {
    logger.warn({ score: nsfwResult.score }, '图片 NSFW 检测未通过')
    throw new AppError('NSFW_DETECTED', `图片包含不合规内容 (score: ${nsfwResult.score.toFixed(3)})`, 400)
  }

  const cfg = await getConfig()
  const provider = cfg.IMAGE_HOSTING_PROVIDER
  if (!provider) {
    throw new AppError('IMAGE_HOSTING_NOT_CONFIGURED', '图片上传未配置外部图床，请在管理面板中设置 IMAGE_HOSTING_PROVIDER', 400)
  }

  const uploader = PROVIDER_UPLOADERS[provider]
  if (!uploader) {
    throw new AppError('INVALID_PROVIDER', `不支持的图床: ${provider}`, 400)
  }

  const buffer = base64ToBuffer(validation.data.image)
  const filename = generateFilename(mimeType)
  const url = await uploader(buffer, filename, mimeType, cfg)
  logger.info({ provider, url }, '图片上传成功')
  return { url }
}
