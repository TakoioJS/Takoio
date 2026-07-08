/**
 * Social Auth — GitHub OAuth + Google OAuth + Email verification.
 *
 * JWT-based sessions (no DB storage). Token payload is self-contained
 * and verifiable without DB lookup. 30-day expiry.
 *
 * Uses `./store/oauth-cache` (Redis + in-memory LRU) for state and
 * verify-code storage, so callbacks work across serverless instances
 * or when Redis is down.
 *
 * Config keys (set in admin panel):
 *   SOCIAL_AUTH_GITHUB_ENABLED / _CLIENT_ID / _CLIENT_SECRET
 *   SOCIAL_AUTH_GOOGLE_ENABLED / _CLIENT_ID / _CLIENT_SECRET
 *   SOCIAL_AUTH_EMAIL_ENABLED
 *
 * Falls back to env vars if config is not set (backward compat).
 *
 * Fire-and-forget pattern for `authUrl`:
 *   `authUrl` is synchronous (called from renderers / redirect
 *   responses) so it cannot `await` the async `setState`. It
 *   schedules `setState` in a detached promise and returns the
 *   URL immediately. The state cache has a 5-minute TTL which is
 *   far longer than the typical OAuth roundtrip (<30s), so the
 *   write always lands before the callback arrives. The callback
 *   handler awaits `consumeState` to defeat replays.
 */

import * as crypto from 'node:crypto'
import { SignJWT, jwtVerify } from 'jose'
import type { TakoioConfig } from './config'
import {
  getAuthJwtSecret,
  validateAuthJwtSecret,
  getGithubClientId,
  getGithubClientSecret,
  getGoogleClientId,
  getGoogleClientSecret,
} from './env'
import { setState, getState, consumeState, setVerifyCode, consumeVerifyCode } from './store/oauth-cache'

// Re-export cache primitives so route handlers can call them directly
// (replaces the old in-Map `verifyState` / `storeVerifyCode` / `verifyEmailCode`).
export { setState, getState, consumeState, setVerifyCode, consumeVerifyCode }

// ========== JWT ==========

const JWT_ALG = 'HS256'
const JWT_EXPIRY = '30d'

export interface AuthUser {
  provider: 'github' | 'google' | 'email'
  id: string
  name: string
  email?: string
  avatar?: string
}

interface JwtPayload extends AuthUser {
  iat: number
  exp: number
}

/** 将密钥字符串转为 Uint8Array（jose 要求） */
function secretBuffer (): Uint8Array {
  const secret = getAuthJwtSecret()
  if (!secret) {
    throw new Error('AUTH_JWT_SECRET environment variable is required for social auth. Please set it before starting the server.')
  }
  return new TextEncoder().encode(secret)
}

export async function signToken (user: AuthUser): Promise<string> {
  // 启动时校验一次；运行时若未校验则兜底校验
  validateAuthJwtSecret()
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: JWT_ALG, typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(secretBuffer())
}

export async function verifyToken (token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(token, secretBuffer(), {
      algorithms: [JWT_ALG],
    })
    const p = payload as unknown as JwtPayload
    return {
      provider: p.provider,
      id: p.id,
      name: p.name,
      email: p.email,
      avatar: p.avatar,
    }
  } catch {
    return null
  }
}

export interface OAuthProvider {
  name: string
  authUrl: (state: string) => string
  getToken: (code: string) => Promise<string>
  getUser: (accessToken: string) => Promise<AuthUser>
}

// ========== OAuth Providers ==========

function generateState (): string {
  return crypto.randomBytes(16).toString('hex')
}

export function createOAuthProviders (siteUrl: string, cfg: TakoioConfig): Record<string, OAuthProvider> {
  const providers: Record<string, OAuthProvider> = {}

  // GitHub: config key or env var（env 统一从 env.ts 读取）
  const githubId = cfg?.SOCIAL_AUTH_GITHUB_CLIENT_ID || getGithubClientId()
  const githubSecret = cfg?.SOCIAL_AUTH_GITHUB_CLIENT_SECRET || getGithubClientSecret()
  if (githubId && githubSecret) {
    providers.github = {
      name: 'GitHub',
      authUrl: (state) => {
        setState(state).catch(() => {})
        return `https://github.com/login/oauth/authorize?client_id=${githubId}&redirect_uri=${encodeURIComponent(siteUrl + '/api/auth/github/callback')}&scope=user:email&state=${state}`
      },
      getToken: async (code) => {
        const res = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_id: githubId, client_secret: githubSecret, code }),
        })
        const data = await res.json() as { access_token?: string }
        if (!data.access_token) throw new Error('GitHub OAuth failed')
        return data.access_token
      },
      getUser: async (accessToken) => {
        const [userRes, emailsRes] = await Promise.all([
          fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${accessToken}` } }),
          fetch('https://api.github.com/user/emails', { headers: { Authorization: `Bearer ${accessToken}` } }),
        ])
        const user = await userRes.json() as { id: number; login: string; name?: string; avatar_url?: string }
        const emails = await emailsRes.json() as Array<{ email: string; primary: boolean }>
        const primaryEmail = emails.find(e => e.primary)?.email || emails[0]?.email
        return {
          provider: 'github',
          id: String(user.id),
          name: user.name || user.login,
          email: primaryEmail,
          avatar: user.avatar_url,
        }
      },
    }
  }

  // Google: config key or env var（env 统一从 env.ts 读取）
  const googleId = cfg?.SOCIAL_AUTH_GOOGLE_CLIENT_ID || getGoogleClientId()
  const googleSecret = cfg?.SOCIAL_AUTH_GOOGLE_CLIENT_SECRET || getGoogleClientSecret()
  if (googleId && googleSecret) {
    providers.google = {
      name: 'Google',
      authUrl: (state) => {
        setState(state).catch(() => {})
        return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleId}&redirect_uri=${encodeURIComponent(siteUrl + '/api/auth/google/callback')}&response_type=code&scope=openid+profile+email&state=${state}`
      },
      getToken: async (code) => {
        const res = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: googleId,
            client_secret: googleSecret,
            code,
            redirect_uri: siteUrl + '/api/auth/google/callback',
            grant_type: 'authorization_code',
          }),
        })
        const data = await res.json() as { access_token?: string }
        if (!data.access_token) throw new Error('Google OAuth failed')
        return data.access_token
      },
      getUser: async (accessToken) => {
        const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const user = await res.json() as { id: string; name: string; email?: string; picture?: string }
        return {
          provider: 'google',
          id: user.id,
          name: user.name,
          email: user.email,
          avatar: user.picture,
        }
      },
    }
  }

  return providers
}

// ========== Email Verification ==========

export function generateVerifyCode (): string {
  return String(crypto.randomInt(100000, 1000000))
}

// ========== Request Helper ==========

/**
 * 从 H3Event 提取 token（Authorization 头 或 ?token= query）并 verifyToken。
 * @returns AuthUser or null
 */
export async function getAuthUserFromRequest (event: any): Promise<AuthUser | null> {
  // 1. Authorization: Bearer <token>
  const authHeader = event.headers?.get?.('authorization') || ''
  let token = ''
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7)
  }
  // 2. ?token=xxx query (for OAuth callback page)
  if (!token) {
    const url = event.node?.req?.url || ''
    try {
      const u = new URL(url, 'http://localhost')
      token = u.searchParams.get('token') || ''
    } catch { /* ignore */ }
  }
  if (!token) return null
  return verifyToken(token)
}

// ========== generateState export (per spec) ==========

export { generateState }
