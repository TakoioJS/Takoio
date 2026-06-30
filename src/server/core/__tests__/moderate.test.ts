import { describe, it, expect, vi } from 'vitest'
import { moderateComment, getAuditAction } from '../moderate'

// Mock logger to avoid noise
vi.mock('../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

// Mock AI SDK — default: not spam
vi.mock('ai', () => ({
  generateObject: vi.fn().mockResolvedValue({
    object: { spam: false, confidence: 5, reason: '正常评论' },
  }),
}))

// Mock @ai-sdk/openai — v4 provider 默认走 Responses API，业务代码用 .chat(model) 走 Chat Completions
vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn().mockReturnValue({ chat: () => ({ provider: 'openai' }) }),
}))

// Mock @ai-sdk/anthropic
vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn().mockReturnValue(() => ({ provider: 'anthropic' })),
}))

// Mock @ai-sdk/google
vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: vi.fn().mockReturnValue(() => ({ provider: 'google' })),
}))

describe('moderateComment', () => {
  it('rejects empty content', async () => {
    const result = await moderateComment('')
    expect(result.passed).toBe(false)
    expect(result.score).toBe(100)
    expect(result.reasons).toContain('内容过短')
  })

  it('rejects single-char content', async () => {
    const result = await moderateComment('a')
    expect(result.passed).toBe(false)
    expect(result.reasons).toContain('内容过短')
  })

  it('rejects overly long content', async () => {
    const result = await moderateComment('x'.repeat(5001))
    expect(result.passed).toBe(false)
    expect(result.reasons).toContain('内容过长')
  })

  it('passes normal content without keywords', async () => {
    const result = await moderateComment('这是一条正常的评论，内容很有意义。')
    expect(result.passed).toBe(true)
    expect(result.spam).toBe(false)
    expect(result.score).toBe(0)
    expect(result.source).toBe('none')
  })

  it('detects blocked keywords in content', async () => {
    const result = await moderateComment('这个赌博网站不错，还有博彩推荐', undefined, undefined, {
      blockedKeywords: '赌博,博彩',
    })
    expect(result.passed).toBe(false)
    expect(result.spam).toBe(true)
    expect(result.source).toBe('keyword')
    expect(result.score).toBeGreaterThanOrEqual(60)
  })

  it('detects blocked keywords in nickname', async () => {
    const result = await moderateComment('正常评论内容', '博彩推广', undefined, {
      blockedKeywords: '博彩',
    })
    expect(result.passed).toBe(false)
    expect(result.spam).toBe(true)
    expect(result.reasons).toContain('昵称包含敏感词')
    expect(result.score).toBe(90)
  })

  it('passes content to AI SDK with openai format (default)', async () => {
    const result = await moderateComment('正常评论内容', undefined, undefined, {
      enabled: true,
      endpoint: 'https://api.openai.com/v1',
      key: 'sk-test',
      model: 'gpt-4o-mini',
    })
    expect(result.source).toBe('llm')
    expect(result.passed).toBe(true)
    expect(result.spam).toBe(false)
  })

  it('passes content to AI SDK with anthropic format', async () => {
    const result = await moderateComment('正常评论内容', undefined, undefined, {
      enabled: true,
      format: 'anthropic',
      endpoint: 'https://api.anthropic.com',
      key: 'sk-ant-test',
      model: 'claude-3-5-sonnet-20241022',
    })
    expect(result.source).toBe('llm')
    expect(result.passed).toBe(true)
    expect(result.spam).toBe(false)
  })

  it('passes content to AI SDK with google format', async () => {
    const result = await moderateComment('正常评论内容', undefined, undefined, {
      enabled: true,
      format: 'google',
      endpoint: 'https://generativelanguage.googleapis.com/v1beta',
      key: 'AIzaTest',
      model: 'gemini-2.0-flash',
    })
    expect(result.source).toBe('llm')
    expect(result.passed).toBe(true)
    expect(result.spam).toBe(false)
  })

  it('passes content without keywords when keyword list is empty', async () => {
    const result = await moderateComment('正常评论', undefined, undefined, {
      blockedKeywords: '',
    })
    expect(result.passed).toBe(true)
  })
})

describe('getAuditAction', () => {
  it('returns approved when mode is pass and content passes', () => {
    const result = { passed: true, spam: false, score: 0, reasons: [], source: 'none' as const }
    expect(getAuditAction(result, 'pass')).toBe('approved')
  })

  it('returns rejected when content is spam', () => {
    const result = { passed: false, spam: true, score: 90, reasons: ['spam'], source: 'keyword' as const }
    expect(getAuditAction(result, 'pass')).toBe('rejected')
    expect(getAuditAction(result, 'audit')).toBe('rejected')
  })

  it('returns pending in audit mode when content fails but is not spam', () => {
    const result = { passed: false, spam: false, score: 50, reasons: ['suspicious'], source: 'keyword' as const }
    expect(getAuditAction(result, 'audit')).toBe('pending')
  })

  it('returns approved in audit mode when content passes', () => {
    const result = { passed: true, spam: false, score: 0, reasons: [], source: 'none' as const }
    expect(getAuditAction(result, 'audit')).toBe('approved')
  })
})
