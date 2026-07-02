/**
 * Social Auth — GitHub OAuth + Google OAuth + Email verification.
 *
 * JWT-based sessions (no DB storage). Token payload is self-contained
 * and verifiable without DB lookup. 30-day expiry.
 *
 * Config keys (set in admin panel):
 *   SOCIAL_AUTH_GITHUB_ENABLED / _CLIENT_ID / _CLIENT_SECRET
 *   SOCIAL_AUTH_GOOGLE_ENABLED / _CLIENT_ID / _CLIENT_SECRET
 *   SOCIAL_AUTH_EMAIL_ENABLED
 *
 * Falls back to env vars if config is not set (backward compat).
 */

import * as crypto from 'node:crypto'
import type { TakoioConfig } from './config'

// ========== JWT ==========

const JWT_ALG = 'HS256'
const JWT_EXPIRY = 30 * 24 * 3600 * 1000 // 30 days

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

function getSecret (): string {
  const secret = process.env.AUTH_JWT_SECRET
  if (!secret) {
    throw new Error('AUTH_JWT_SECRET environment variable is required for social auth. Please set it before starting the server.')
  }
  return secret
}

function base64UrlEncode (buf: Buffer): string {
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function base64UrlDecode (str: string): Buffer {
  str = str.replace(/-/g, '+').replace(/_/g, '/')
  while (str.length % 4) str += '='
  return Buffer.from(str, 'base64')
}

export function signToken (user: AuthUser): string {
  const header = { alg: JWT_ALG, typ: 'JWT' }
  const payload: JwtPayload = { ...user, iat: Date.now(), exp: Date.now() + JWT_EXPIRY }

  const headerB64 = base64UrlEncode(Buffer.from(JSON.stringify(header)))
  const payloadB64 = base64UrlEncode(Buffer.from(JSON.stringify(payload)))
  const signature = crypto.createHmac('sha256', getSecret())
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64')
  const sigB64 = base64UrlEncode(signature)

  return `${headerB64}.${payloadB64}.${sigB64}`
}

export function verifyToken (token: string): AuthUser | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const [headerB64, payloadB64, sigB64] = parts
    const expectedSig = base64UrlEncode(
      crypto.createHmac('sha256', getSecret()).update(`${headerB64}.${payloadB64}`).digest()
    )
    if (expectedSig !== sigB64) return null

    const payload: JwtPayload = JSON.parse(base64UrlDecode(payloadB64).toString())
    if (payload.exp < Date.now()) return null

    return {
      provider: payload.provider,
      id: payload.id,
      name: payload.name,
      email: payload.email,
      avatar: payload.avatar,
    }
  } catch {
    return null
  }
}

// ========== OAuth Providers ==========

export interface OAuthProvider {
  name: string
  authUrl: (state: string) => string
  getToken: (code: string) => Promise<string>
  getUser: (accessToken: string) => Promise<AuthUser>
}

function generateState (): string {
  return crypto.randomBytes(16).toString('hex')
}

function storeState (state: string): void {
  // Store in memory with 5min TTL
  stateCache.set(state, Date.now())
  // Cleanup old states
  for (const [s, t] of stateCache) {
    if (Date.now() - t > 300_000) stateCache.delete(s)
  }
}

function verifyState (state: string): boolean {
  return stateCache.has(state)
}

const stateCache = new Map<string, number>()

export function createOAuthProviders (siteUrl: string, cfg: Record<string, any>): Record<string, OAuthProvider> {
  const providers: Record<string, OAuthProvider> = {}

  let authConfig: Record<string, any> = {}
  try {
    authConfig = JSON.parse(cfg?.SOCIAL_AUTH_CONFIG || '{}')
  } catch { /* use defaults */ }

  // GitHub: config key or env var
  const githubId = cfg?.SOCIAL_AUTH_GITHUB_CLIENT_ID || process.env.GITHUB_CLIENT_ID
  const githubSecret = cfg?.SOCIAL_AUTH_GITHUB_CLIENT_SECRET || process.env.GITHUB_CLIENT_SECRET
  if (githubId && githubSecret) {
    providers.github = {
      name: 'GitHub',
      authUrl: (state) => {
        storeState(state)
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

  // Google: config key or env var
  const googleId = cfg?.SOCIAL_AUTH_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID
  const googleSecret = cfg?.SOCIAL_AUTH_GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET
  if (googleId && googleSecret) {
    providers.google = {
      name: 'Google',
      authUrl: (state) => {
        storeState(state)
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

const verifyCodes = new Map<string, { code: string; user: AuthUser; expires: number }>()

export function generateVerifyCode (): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export function storeVerifyCode (uuid: string, code: string, user: AuthUser): void {
  verifyCodes.set(uuid, { code, user, expires: Date.now() + 300_000 })
  // Cleanup expired
  for (const [k, v] of verifyCodes) {
    if (Date.now() > v.expires) verifyCodes.delete(k)
  }
}

export function verifyEmailCode (uuid: string, code: string): AuthUser | null {
  const entry = verifyCodes.get(uuid)
  if (!entry || entry.expires < Date.now() || entry.code !== code) return null
  verifyCodes.delete(uuid)
  return entry.user
}

// ========== Auth State Helper ==========

export { generateState, verifyState }
