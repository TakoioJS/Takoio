/**
 * Image Handler Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../config', async () => {
  const actual = await vi.importActual('../../config')
  return {
    ...actual,
    getConfig: vi.fn().mockResolvedValue({
      IMAGE_HOSTING_PROVIDER: 'test',
      IMAGE_HOSTING_ENDPOINT: 'https://test.com',
      IMAGE_HOSTING_TOKEN: 'test-token',
    }),
    AppError: class AppError extends Error {
      constructor (public code: string, message: string, public statusCode = 400) {
        super(message)
        this.name = 'AppError'
      }
    },
  }
})

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

import { handleUploadImage } from '../image'

describe('handleUploadImage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects empty image data', async () => {
    await expect(handleUploadImage({ image: '' })).rejects.toThrow('无图片数据')
  })

  it('rejects invalid base64 image', async () => {
    await expect(handleUploadImage({ image: 'not-valid-base64' })).rejects.toThrow('无图片数据')
  })

  it('rejects oversized image', async () => {
    // Create a base64 string that represents > 5MB
    const largeImage = 'data:image/png;base64,' + 'A'.repeat(6 * 1024 * 1024 / 3 * 4)

    await expect(handleUploadImage({ image: largeImage })).rejects.toThrow('图片超过 5MB')
  })

  it('rejects oversized image via pre-decode length check (regression: OOM DoS)', async () => {
    // 构造一个远超 MAX_UPLOAD_SIZE 的 base64 payload：旧实现会先调用
    // Buffer.from(raw, 'base64') 一次性分配完整缓冲区再校验长度，
    // 攻击者可发送超大 payload 触发 OOM。新实现在解码前基于字符串长度
    // 直接拒绝。这里用 ~50MB base64（解码后约 37MB）来模拟 DoS payload，
    // 由于不会真正解码，测试本身不会消耗大量内存。
    const hugeBase64 = 'data:image/png;base64,' + 'A'.repeat(50 * 1024 * 1024)
    await expect(handleUploadImage({ image: hugeBase64 })).rejects.toThrow('图片超过 5MB')
  })

  it('rejects unsupported image format', async () => {
    // SVG is not in the allowed MIME types (png/jpeg/jpg/gif/webp)
    const invalidImage = 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='

    await expect(handleUploadImage({ image: invalidImage })).rejects.toThrow()
  })
})
