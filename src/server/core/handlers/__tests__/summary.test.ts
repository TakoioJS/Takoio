/**
 * Summary Handler Tests (Task 8.3.6)
 *
 * 覆盖 summary.ts 的 handleArticleSummary：
 *   - 生成摘要成功（JSON 响应解析、markdown 去除、文本兜底）
 *   - AI 提供商返回错误（异常被捕获）
 *   - Redis 不可用短路
 *   - 内容过短短路
 *   - 未配置 provider 短路
 *   - 指定 provider/model 覆盖
 *   - 缓存依赖路径（dev 模式跳过 Redis 检查）
 *
 * 注：handler 内部不直接管理缓存（缓存逻辑在 nitro 路由层），
 * 此处覆盖 Redis 可用性检查路径作为缓存依赖的等价测试。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ========== Mocks ==========

vi.mock('ai', () => ({
  generateText: vi.fn(),
}))

vi.mock('../../config', async () => {
  const actual = await vi.importActual('../../config')
  return {
    ...actual,
    getConfig: vi.fn().mockResolvedValue({
      AI_PROVIDERS: '[]',
      AI_SUMMARY_PROVIDER: '',
      AI_SUMMARY_MODEL: '',
    }),
  }
})

vi.mock('../../store/redis', () => ({
  isRedisAvailable: vi.fn().mockResolvedValue(true),
}))

vi.mock('../../env', () => ({
  isDev: vi.fn().mockReturnValue(true),
}))

vi.mock('../../ai-model', () => ({
  createModelInstance: vi.fn().mockReturnValue({ model: 'mock-model' }),
}))

vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

// ========== Imports ==========

import { handleArticleSummary } from '../summary'
import { generateText } from 'ai'
import { getConfig } from '../../config'
import { isRedisAvailable } from '../../store/redis'
import { isDev } from '../../env'
import { createModelInstance } from '../../ai-model'

const PROVIDER_OK = {
  name: 'openai-main',
  key: 'sk-test',
  endpoint: 'https://api.openai.com/v1',
  format: 'openai',
  models: ['gpt-4o-mini', 'gpt-4o'],
}

// ========== Tests ==========

describe('handleArticleSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset default — dev mode bypasses Redis, no providers configured
    vi.mocked(getConfig).mockResolvedValue({
      AI_PROVIDERS: '[]',
      AI_SUMMARY_PROVIDER: '',
      AI_SUMMARY_MODEL: '',
    } as any)
    vi.mocked(isDev).mockReturnValue(true)
    vi.mocked(isRedisAvailable).mockResolvedValue(true)
  })

  it('returns failure when content too short', async () => {
    const result = await handleArticleSummary({ content: 'short' })
    expect(result.success).toBe(false)
    expect(result.message).toContain('过短')
    expect(generateText).not.toHaveBeenCalled()
  })

  it('returns failure when content is whitespace', async () => {
    const result = await handleArticleSummary({ content: '   \n\t  ' })
    expect(result.success).toBe(false)
    expect(result.message).toContain('过短')
  })

  it('returns failure when no provider configured', async () => {
    const result = await handleArticleSummary({
      content: 'x'.repeat(20),
    })
    expect(result.success).toBe(false)
    expect(result.message).toContain('未找到可用的 AI 提供商')
    expect(generateText).not.toHaveBeenCalled()
  })

  it('returns failure when provider missing key or endpoint', async () => {
    vi.mocked(getConfig).mockResolvedValueOnce({
      AI_PROVIDERS: JSON.stringify([{ name: 'broken', key: '', endpoint: '' }]),
    } as any)

    const result = await handleArticleSummary({ content: 'x'.repeat(20) })
    expect(result.success).toBe(false)
    expect(result.message).toContain('未找到可用的 AI 提供商')
  })

  it('returns failure when Redis unavailable (production mode)', async () => {
    vi.mocked(isDev).mockReturnValue(false)
    vi.mocked(isRedisAvailable).mockResolvedValue(false)

    const result = await handleArticleSummary({ content: 'x'.repeat(20) })
    expect(result.success).toBe(false)
    expect(result.message).toContain('Redis 不可用')
    expect(isRedisAvailable).toHaveBeenCalled()
  })

  it('bypasses Redis check in dev mode', async () => {
    vi.mocked(isDev).mockReturnValue(true)
    vi.mocked(isRedisAvailable).mockResolvedValue(false)
    vi.mocked(getConfig).mockResolvedValueOnce({
      AI_PROVIDERS: JSON.stringify([PROVIDER_OK]),
    } as any)
    vi.mocked(generateText).mockResolvedValueOnce({
      text: '{"summary":"hello","keywords":["k1","k2"]}',
    } as any)

    const result = await handleArticleSummary({ content: 'x'.repeat(20) })
    // Redis check is skipped, AI should run
    expect(isRedisAvailable).not.toHaveBeenCalled()
    expect(result.success).toBe(true)
  })

  it('generates summary successfully from JSON response', async () => {
    vi.mocked(getConfig).mockResolvedValueOnce({
      AI_PROVIDERS: JSON.stringify([PROVIDER_OK]),
    } as any)
    vi.mocked(generateText).mockResolvedValueOnce({
      text: '{"summary":"这是一篇关于测试的文章","keywords":["测试","单元测试","vitest"]}',
    } as any)

    const result = await handleArticleSummary({
      content: '本文详细介绍如何使用 vitest 编写单元测试...',
      title: 'Vitest 入门',
    })

    expect(result.success).toBe(true)
    expect(result.message).toBe('摘要生成成功')
    expect(result.summary).toBe('这是一篇关于测试的文章')
    expect(result.keywords).toEqual(['测试', '单元测试', 'vitest'])
    expect(createModelInstance).toHaveBeenCalledWith(
      'openai',
      'https://api.openai.com/v1',
      'sk-test',
      'gpt-4o-mini' // first model from provider.models array
    )
  })

  it('strips markdown code block markers from response', async () => {
    vi.mocked(getConfig).mockResolvedValueOnce({
      AI_PROVIDERS: JSON.stringify([PROVIDER_OK]),
    } as any)
    vi.mocked(generateText).mockResolvedValueOnce({
      text: '```json\n{"summary":"raw","keywords":["k"]}\n```',
    } as any)

    const result = await handleArticleSummary({ content: 'x'.repeat(20) })
    expect(result.success).toBe(true)
    expect(result.summary).toBe('raw')
    expect(result.keywords).toEqual(['k'])
  })

  it('falls back to raw text when JSON parse fails', async () => {
    vi.mocked(getConfig).mockResolvedValueOnce({
      AI_PROVIDERS: JSON.stringify([PROVIDER_OK]),
    } as any)
    vi.mocked(generateText).mockResolvedValueOnce({
      text: 'This is just plain text without JSON structure.',
    } as any)

    const result = await handleArticleSummary({ content: 'x'.repeat(20) })
    expect(result.success).toBe(true)
    expect(result.summary).toBe('This is just plain text without JSON structure.')
    expect(result.keywords).toEqual([])
  })

  it('uses AI provider error message when generateText throws', async () => {
    vi.mocked(getConfig).mockResolvedValueOnce({
      AI_PROVIDERS: JSON.stringify([PROVIDER_OK]),
    } as any)
    vi.mocked(generateText).mockRejectedValueOnce(new Error('API rate limit exceeded'))

    const result = await handleArticleSummary({ content: 'x'.repeat(20) })
    expect(result.success).toBe(false)
    expect(result.message).toContain('摘要生成失败')
    expect(result.message).toContain('API rate limit exceeded')
    expect(result.summary).toBe('')
  })

  it('honors provider override in request', async () => {
    vi.mocked(getConfig).mockResolvedValueOnce({
      AI_PROVIDERS: JSON.stringify([
        PROVIDER_OK,
        { name: 'anthropic-main', key: 'sk-ant', endpoint: 'https://api.anthropic.com', format: 'anthropic', models: ['claude-3'] },
      ]),
    } as any)
    vi.mocked(generateText).mockResolvedValueOnce({
      text: '{"summary":"ok","keywords":[]}',
    } as any)

    await handleArticleSummary({
      content: 'x'.repeat(20),
      provider: 'anthropic-main',
    })
    expect(createModelInstance).toHaveBeenCalledWith(
      'anthropic',
      'https://api.anthropic.com',
      'sk-ant',
      'claude-3'
    )
  })

  it('honors model override in request', async () => {
    vi.mocked(getConfig).mockResolvedValueOnce({
      AI_PROVIDERS: JSON.stringify([PROVIDER_OK]),
    } as any)
    vi.mocked(generateText).mockResolvedValueOnce({
      text: '{"summary":"ok","keywords":[]}',
    } as any)

    await handleArticleSummary({
      content: 'x'.repeat(20),
      model: 'gpt-4o',
    })
    expect(createModelInstance).toHaveBeenCalledWith(
      'openai',
      'https://api.openai.com/v1',
      'sk-test',
      'gpt-4o'
    )
  })

  it('honors AI_SUMMARY_MODEL config when no request override', async () => {
    vi.mocked(getConfig).mockResolvedValueOnce({
      AI_PROVIDERS: JSON.stringify([PROVIDER_OK]),
      AI_SUMMARY_MODEL: 'gpt-4o',
    } as any)
    vi.mocked(generateText).mockResolvedValueOnce({
      text: '{"summary":"ok","keywords":[]}',
    } as any)

    await handleArticleSummary({ content: 'x'.repeat(20) })
    expect(createModelInstance).toHaveBeenCalledWith(
      'openai',
      'https://api.openai.com/v1',
      'sk-test',
      'gpt-4o'
    )
  })

  it('falls back to first provider when no provider specified', async () => {
    vi.mocked(getConfig).mockResolvedValueOnce({
      AI_PROVIDERS: JSON.stringify([PROVIDER_OK]),
    } as any)
    vi.mocked(generateText).mockResolvedValueOnce({
      text: '{"summary":"ok","keywords":[]}',
    } as any)

    await handleArticleSummary({ content: 'x'.repeat(20) })
    // provider name resolved from providers[0].name
    expect(generateText).toHaveBeenCalled()
  })

  it('passes prompt with title when title provided', async () => {
    vi.mocked(getConfig).mockResolvedValueOnce({
      AI_PROVIDERS: JSON.stringify([PROVIDER_OK]),
    } as any)
    vi.mocked(generateText).mockResolvedValueOnce({
      text: '{"summary":"ok","keywords":[]}',
    } as any)

    await handleArticleSummary({
      content: 'x'.repeat(20),
      title: 'My Article',
    })
    const call = vi.mocked(generateText).mock.calls[0][0] as any
    expect(call.prompt).toContain('文章标题：My Article')
    expect(call.prompt).toContain('文章内容：')
    expect(call.system).toBeDefined()
    expect(call.temperature).toBe(0.3)
  })

  it('passes plain content as prompt when no title', async () => {
    vi.mocked(getConfig).mockResolvedValueOnce({
      AI_PROVIDERS: JSON.stringify([PROVIDER_OK]),
    } as any)
    vi.mocked(generateText).mockResolvedValueOnce({
      text: '{"summary":"ok","keywords":[]}',
    } as any)

    await handleArticleSummary({ content: 'just content' })
    const call = vi.mocked(generateText).mock.calls[0][0] as any
    expect(call.prompt).toBe('just content')
  })

  it('parses AI_PROVIDERS as object array (not JSON string)', async () => {
    vi.mocked(getConfig).mockResolvedValueOnce({
      AI_PROVIDERS: [PROVIDER_OK], // already-parsed array
    } as any)
    vi.mocked(generateText).mockResolvedValueOnce({
      text: '{"summary":"ok","keywords":[]}',
    } as any)

    const result = await handleArticleSummary({ content: 'x'.repeat(20) })
    expect(result.success).toBe(true)
  })

  it('handles malformed AI_PROVIDERS JSON gracefully', async () => {
    vi.mocked(getConfig).mockResolvedValueOnce({
      AI_PROVIDERS: 'not json{',
    } as any)

    const result = await handleArticleSummary({ content: 'x'.repeat(20) })
    expect(result.success).toBe(false)
    expect(result.message).toContain('未找到可用的 AI 提供商')
  })

  it('defaults model to gpt-4o-mini when nothing configured', async () => {
    vi.mocked(getConfig).mockResolvedValueOnce({
      AI_PROVIDERS: JSON.stringify([{
        name: 'p', key: 'k', endpoint: 'https://x', format: 'openai',
        // no models field
      }]),
    } as any)
    vi.mocked(generateText).mockResolvedValueOnce({
      text: '{"summary":"ok","keywords":[]}',
    } as any)

    await handleArticleSummary({ content: 'x'.repeat(20) })
    expect(createModelInstance).toHaveBeenCalledWith(
      'openai', 'https://x', 'k', 'gpt-4o-mini'
    )
  })
})
