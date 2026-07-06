import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  generateVerifyCode,
  signToken,
  verifyToken,
  getAuthUserFromRequest,
  createOAuthProviders,
} from '../auth-social'
import { validateAuthJwtSecret, AUTH_JWT_SECRET_MIN_LEN } from '../env'
import type { TakoioConfig } from '../config'

// Mock Redis to return null (no Redis available in tests)
vi.mock('../store/redis', () => ({
  withRedis: vi.fn().mockResolvedValue(null),
}))

// AUTH_JWT_SECRET is required by signToken/verifyToken — must be >= 32 bytes
const TEST_SECRET = 'test-secret-for-vitest-must-be-at-least-32-bytes-long'
process.env.AUTH_JWT_SECRET = TEST_SECRET

const baseUser = {
  provider: 'github' as const,
  id: '12345',
  name: 'Test User',
  email: 'test@example.com',
  avatar: 'https://example.com/a.png',
}

describe('validateAuthJwtSecret', () => {
  it('accepts a secret with at least 32 bytes', () => {
    expect(() => validateAuthJwtSecret()).not.toThrow()
  })

  it('rejects a missing secret', () => {
    const old = process.env.AUTH_JWT_SECRET
    delete process.env.AUTH_JWT_SECRET
    expect(() => validateAuthJwtSecret()).toThrow('AUTH_JWT_SECRET environment variable is required')
    process.env.AUTH_JWT_SECRET = old
  })

  it('rejects a secret shorter than 32 bytes', () => {
    const old = process.env.AUTH_JWT_SECRET
    process.env.AUTH_JWT_SECRET = 'too-short'
    expect(() => validateAuthJwtSecret()).toThrow(`minimum required is ${AUTH_JWT_SECRET_MIN_LEN} bytes`)
    process.env.AUTH_JWT_SECRET = old
  })
})

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
  it('round-trips a basic user', async () => {
    const token = await signToken(baseUser)
    const decoded = await verifyToken(token)
    expect(decoded).not.toBeNull()
    expect(decoded).toEqual(baseUser)
  })

  it('produces a 3-part JWT', async () => {
    const token = await signToken(baseUser)
    expect(token.split('.')).toHaveLength(3)
  })

  it('embeds the user payload (provider, id, name, email, avatar)', async () => {
    const token = await signToken(baseUser)
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

  it('embeds iat and exp timestamps', async () => {
    const beforeSec = Math.floor(Date.now() / 1000)
    const token = await signToken(baseUser)
    const afterSec = Math.floor(Date.now() / 1000)
    const [, payloadB64] = token.split('.')
    const payload = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString()
    )
    expect(typeof payload.iat).toBe('number')
    expect(typeof payload.exp).toBe('number')
    expect(payload.iat).toBeGreaterThanOrEqual(beforeSec)
    expect(payload.iat).toBeLessThanOrEqual(afterSec)
    // 30-day expiry (in seconds)
    expect(payload.exp - payload.iat).toBe(30 * 24 * 3600)
  })

  it('returns null for a tampered token', async () => {
    const token = await signToken(baseUser)
    const tampered = token.slice(0, -2) + (token.endsWith('A') ? 'BB' : 'AA')
    expect(await verifyToken(tampered)).toBeNull()
  })

  it('returns null for a token signed with a different secret', async () => {
    const token = await signToken(baseUser)
    const oldSecret = process.env.AUTH_JWT_SECRET
    try {
      process.env.AUTH_JWT_SECRET = 'another-secret-must-be-at-least-32-bytes'
      expect(await verifyToken(token)).toBeNull()
    } finally {
      process.env.AUTH_JWT_SECRET = oldSecret
    }
  })

  it('returns null for an expired token', async () => {
    const token = await signToken(baseUser)
    // Build an expired token (exp in the past)
    const expiredToken = await signJWTForTest(baseUser, Date.now() - 1000)
    expect(await verifyToken(expiredToken)).toBeNull()
    // sanity: the original is still valid
    expect(await verifyToken(token)).not.toBeNull()
  })

  it('returns null for a malformed token (not 3 parts)', async () => {
    expect(await verifyToken('not.a.real.jwt.token')).toBeNull()
    expect(await verifyToken('onepart')).toBeNull()
    expect(await verifyToken('two.parts')).toBeNull()
    expect(await verifyToken('')).toBeNull()
  })
})

// Helper: sign a test payload directly with jose using the current secret
async function signJWTForTest (payload: any, expMs?: number): Promise<string> {
  const { SignJWT } = await import('jose')
  const secret = new TextEncoder().encode(process.env.AUTH_JWT_SECRET!)
  const jwt = new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
  if (expMs !== undefined) {
    jwt.setExpirationTime(Math.floor(expMs / 1000))
  }
  return jwt.sign(secret)
}

describe('getAuthUserFromRequest', () => {
  it('extracts user from Authorization: Bearer <token>', async () => {
    const token = await signToken(baseUser)
    const event = {
      headers: { get: (name: string) => name.toLowerCase() === 'authorization' ? `Bearer ${token}` : null },
      node: { req: { url: '/' } },
    }
    expect(await getAuthUserFromRequest(event)).toEqual(baseUser)
  })

  it('extracts user from ?token=<token> query', async () => {
    const token = await signToken(baseUser)
    const event = {
      headers: { get: () => null },
      node: { req: { url: `/api/auth/github/callback?token=${token}` } },
    }
    expect(await getAuthUserFromRequest(event)).toEqual(baseUser)
  })

  it('prefers Authorization header over ?token= query', async () => {
    const headerToken = await signToken({ ...baseUser, id: 'header' })
    const queryToken = await signToken({ ...baseUser, id: 'query' })
    const event = {
      headers: { get: (name: string) => name.toLowerCase() === 'authorization' ? `Bearer ${headerToken}` : null },
      node: { req: { url: `/?token=${queryToken}` } },
    }
    expect((await getAuthUserFromRequest(event))?.id).toBe('header')
  })

  it('returns null when no token is present', async () => {
    const event = {
      headers: { get: () => null },
      node: { req: { url: '/' } },
    }
    expect(await getAuthUserFromRequest(event)).toBeNull()
  })

  it('returns null when token is invalid', async () => {
    const event = {
      headers: { get: (name: string) => name.toLowerCase() === 'authorization' ? 'Bearer not.a.valid.jwt' : null },
      node: { req: { url: '/' } },
    }
    expect(await getAuthUserFromRequest(event)).toBeNull()
  })

  it('resolves via header even when node.req.url is absent (no query fallback)', async () => {
    const token = await signToken(baseUser)
    const event = {
      headers: { get: (name: string) => name.toLowerCase() === 'authorization' ? `Bearer ${token}` : null },
      node: undefined,
    }
    // Header is present → should still resolve
    expect(await getAuthUserFromRequest(event)).toEqual(baseUser)
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
