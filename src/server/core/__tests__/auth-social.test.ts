import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  generateVerifyCode,
  signToken,
  verifyToken,
  getAuthUserFromRequest,
  createOAuthProviders,
} from '../auth-social'
import type { TakoioConfig } from '../config'

// Mock Redis to return null (no Redis available in tests)
vi.mock('../store/redis', () => ({
  withRedis: vi.fn().mockResolvedValue(null),
}))

// AUTH_JWT_SECRET is required by signToken/verifyToken
process.env.AUTH_JWT_SECRET = 'test-secret-for-vitest'

const baseUser = {
  provider: 'github' as const,
  id: '12345',
  name: 'Test User',
  email: 'test@example.com',
  avatar: 'https://example.com/a.png',
}

describe('generateVerifyCode', () => {
  it('returns a 6-digit numeric string', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateVerifyCode()
      expect(code).toMatch(/^\d{6}$/)
      const n = Number(code)
      expect(n).toBeGreaterThanOrEqual(100000)
      expect(n).toBeLessThan(1000000)
    }
  })

  it('distributes digits uniformly across 10_000 generations', () => {
    const counts = new Array(10).fill(0)
    const N = 10_000
    for (let i = 0; i < N; i++) {
      const code = generateVerifyCode()
      for (let pos = 0; pos < code.length; pos++) {
        counts[Number(code[pos])] += 1
      }
    }
    // 6 digits × N = 60_000 total samples. The first digit can't be 0 (range is 100_000-999_999),
    // so digit 0 only appears in 5 of 6 positions (~50_000 samples, ~5_000 ideal).
    // Digits 1-9 appear in all 6 positions (~60_000 samples each, ~6_000 ideal, minus a fraction).
    // Allow ±10% deviation: digit 0 → 4_500-5_500, others → 5_500-6_700.
    for (let d = 0; d < 10; d++) {
      const [lo, hi] = d === 0 ? [4_500, 5_500] : [5_500, 6_700]
      expect(counts[d]).toBeGreaterThanOrEqual(lo)
      expect(counts[d]).toBeLessThanOrEqual(hi)
    }
  })
})

describe('signToken / verifyToken round-trip', () => {
  it('round-trips a basic user', () => {
    const token = signToken(baseUser)
    const decoded = verifyToken(token)
    expect(decoded).not.toBeNull()
    expect(decoded).toEqual(baseUser)
  })

  it('produces a 3-part JWT', () => {
    const token = signToken(baseUser)
    expect(token.split('.')).toHaveLength(3)
  })

  it('embeds the user payload (provider, id, name, email, avatar)', () => {
    const token = signToken(baseUser)
    const [, payloadB64] = token.split('.')
    const payload = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString()
    )
    expect(payload.provider).toBe(baseUser.provider)
    expect(payload.id).toBe(baseUser.id)
    expect(payload.name).toBe(baseUser.name)
    expect(payload.email).toBe(baseUser.email)
    expect(payload.avatar).toBe(baseUser.avatar)
  })

  it('embeds iat and exp timestamps', () => {
    const before = Date.now()
    const token = signToken(baseUser)
    const after = Date.now()
    const [, payloadB64] = token.split('.')
    const payload = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString()
    )
    expect(typeof payload.iat).toBe('number')
    expect(typeof payload.exp).toBe('number')
    expect(payload.iat).toBeGreaterThanOrEqual(before)
    expect(payload.iat).toBeLessThanOrEqual(after)
    // 30-day expiry
    expect(payload.exp - payload.iat).toBe(30 * 24 * 3600 * 1000)
  })

  it('returns null for a tampered token', () => {
    const token = signToken(baseUser)
    const tampered = token.slice(0, -2) + (token.endsWith('A') ? 'BB' : 'AA')
    expect(verifyToken(tampered)).toBeNull()
  })

  it('returns null for a token signed with a different secret', () => {
    const token = signToken(baseUser)
    const oldSecret = process.env.AUTH_JWT_SECRET
    try {
      process.env.AUTH_JWT_SECRET = 'another-secret'
      expect(verifyToken(token)).toBeNull()
    } finally {
      process.env.AUTH_JWT_SECRET = oldSecret
    }
  })

  it('returns null for an expired token', () => {
    const token = signToken(baseUser)
    const [headerB64, , sigB64] = token.split('.')
    // Build an expired payload (exp in the past)
    const expiredPayload = {
      ...baseUser,
      iat: Date.now() - 10_000,
      exp: Date.now() - 1_000,
    }
    const expiredB64 = Buffer
      .from(JSON.stringify(expiredPayload))
      .toString('base64url')
    // Re-sign with the current secret so only the expiry changes
    // (verifyToken checks signature first, then exp)
    const crypto = require('node:crypto') as typeof import('node:crypto')
    const newSig = crypto
      .createHmac('sha256', process.env.AUTH_JWT_SECRET!)
      .update(`${headerB64}.${expiredB64}`)
      .digest()
      .toString('base64url')
    const expiredToken = `${headerB64}.${expiredB64}.${newSig}`
    expect(verifyToken(expiredToken)).toBeNull()
    // sanity: the original is still valid (sigB64 仅用于占位说明三部分结构)
    expect(verifyToken(token)).not.toBeNull()
    expect(sigB64).toBeDefined()
  })

  it('returns null for a malformed token (not 3 parts)', () => {
    expect(verifyToken('not.a.real.jwt.token')).toBeNull()
    expect(verifyToken('onepart')).toBeNull()
    expect(verifyToken('two.parts')).toBeNull()
    expect(verifyToken('')).toBeNull()
  })
})

describe('getAuthUserFromRequest', () => {
  it('extracts user from Authorization: Bearer <token>', () => {
    const token = signToken(baseUser)
    const event = {
      headers: { get: (name: string) => name.toLowerCase() === 'authorization' ? `Bearer ${token}` : null },
      node: { req: { url: '/' } },
    }
    expect(getAuthUserFromRequest(event)).toEqual(baseUser)
  })

  it('extracts user from ?token=<token> query', () => {
    const token = signToken(baseUser)
    const event = {
      headers: { get: () => null },
      node: { req: { url: `/api/auth/github/callback?token=${token}` } },
    }
    expect(getAuthUserFromRequest(event)).toEqual(baseUser)
  })

  it('prefers Authorization header over ?token= query', () => {
    const headerToken = signToken({ ...baseUser, id: 'header' })
    const queryToken = signToken({ ...baseUser, id: 'query' })
    const event = {
      headers: { get: (name: string) => name.toLowerCase() === 'authorization' ? `Bearer ${headerToken}` : null },
      node: { req: { url: `/?token=${queryToken}` } },
    }
    expect(getAuthUserFromRequest(event)?.id).toBe('header')
  })

  it('returns null when no token is present', () => {
    const event = {
      headers: { get: () => null },
      node: { req: { url: '/' } },
    }
    expect(getAuthUserFromRequest(event)).toBeNull()
  })

  it('returns null when token is invalid', () => {
    const event = {
      headers: { get: (name: string) => name.toLowerCase() === 'authorization' ? 'Bearer not.a.valid.jwt' : null },
      node: { req: { url: '/' } },
    }
    expect(getAuthUserFromRequest(event)).toBeNull()
  })

  it('resolves via header even when node.req.url is absent (no query fallback)', () => {
    const token = signToken(baseUser)
    const event = {
      headers: { get: (name: string) => name.toLowerCase() === 'authorization' ? `Bearer ${token}` : null },
      node: undefined,
    }
    // Header is present → should still resolve
    expect(getAuthUserFromRequest(event)).toEqual(baseUser)
  })
})

describe('createOAuthProviders', () => {
  // Save and clear relevant env vars for isolation
  const envSnapshot = {
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  }

  beforeEach(() => {
    delete process.env.GITHUB_CLIENT_ID
    delete process.env.GITHUB_CLIENT_SECRET
    delete process.env.GOOGLE_CLIENT_ID
    delete process.env.GOOGLE_CLIENT_SECRET
  })

  afterEach(() => {
    for (const [k, v] of Object.entries(envSnapshot)) {
      if (v === undefined) delete (process.env as any)[k]
      else (process.env as any)[k] = v
    }
  })

  it('returns a github provider when both client id and secret are configured', () => {
    const cfg: Partial<TakoioConfig> = {
      SOCIAL_AUTH_GITHUB_ENABLED: true,
      SOCIAL_AUTH_GITHUB_CLIENT_ID: 'gh-id',
      SOCIAL_AUTH_GITHUB_CLIENT_SECRET: 'gh-secret',
    }
    const providers = createOAuthProviders('https://site.example', cfg as TakoioConfig)
    expect(providers.github).toBeDefined()
    expect(providers.github.name).toBe('GitHub')
    expect(typeof providers.github.authUrl).toBe('function')
    expect(typeof providers.github.getToken).toBe('function')
    expect(typeof providers.github.getUser).toBe('function')
  })

  it('does not return a github provider when client id/secret are missing', () => {
    const cfg: Partial<TakoioConfig> = {
      SOCIAL_AUTH_GITHUB_ENABLED: false,
    }
    const providers = createOAuthProviders('https://site.example', cfg as TakoioConfig)
    expect(providers.github).toBeUndefined()
  })

  it('does not return a github provider when only one of id/secret is set', () => {
    const cfg1: Partial<TakoioConfig> = {
      SOCIAL_AUTH_GITHUB_CLIENT_ID: 'gh-id',
    }
    expect(createOAuthProviders('https://site.example', cfg1 as TakoioConfig).github).toBeUndefined()

    const cfg2: Partial<TakoioConfig> = {
      SOCIAL_AUTH_GITHUB_CLIENT_SECRET: 'gh-secret',
    }
    expect(createOAuthProviders('https://site.example', cfg2 as TakoioConfig).github).toBeUndefined()
  })

  it('builds the GitHub auth URL with the supplied state and site url', () => {
    const cfg: Partial<TakoioConfig> = {
      SOCIAL_AUTH_GITHUB_ENABLED: true,
      SOCIAL_AUTH_GITHUB_CLIENT_ID: 'gh-id',
      SOCIAL_AUTH_GITHUB_CLIENT_SECRET: 'gh-secret',
    }
    const providers = createOAuthProviders('https://site.example', cfg as TakoioConfig)
    const url = providers.github.authUrl('abc123')
    expect(url).toContain('https://github.com/login/oauth/authorize')
    expect(url).toContain('client_id=gh-id')
    expect(url).toContain('state=abc123')
    expect(url).toContain(encodeURIComponent('https://site.example/api/auth/github/callback'))
  })
})
