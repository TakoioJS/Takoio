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

  it('rejects unsupported image format', async () => {
    // SVG is not in the allowed MIME types (png/jpeg/jpg/gif/webp)
    const invalidImage = 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='

    await expect(handleUploadImage({ image: invalidImage })).rejects.toThrow()
  })
})
