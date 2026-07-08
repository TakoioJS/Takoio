import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto'

// OWASP 2023 推荐 scrypt N >= 2^17 (131072) 用于密码哈希。
// 旧版用 N=16384 (2^14) 偏低，现代 GPU 可每秒数万次尝试；升级到 2^17 约 100-200ms/次。
// 编码格式 $scrypt$<N>$<r>$<p>$<salt-b64url>$<key-b64url> 将参数写入哈希串，
// 支持"下次登录重哈希"：verifyPassword 成功后若 N < CURRENT_N 则用新参数重算。
const SCRYPT_N = 131072 // 2^17
const SCRYPT_R = 8
const SCRYPT_P = 1
const SCRYPT_KEYLEN = 64
// scryptSync 默认 maxmem=32MB，N=131072 r=8 需约 128MB，必须显式提升
const SCRYPT_MAXMEM = 256 * 1024 * 1024 // 256MB

// $scrypt$<N>$<r>$<p>$<salt-b64url>$<key-b64url>
function encodeScrypt (N: number, r: number, p: number, salt: Buffer, key: Buffer): string {
  return `$scrypt$${N}$${r}$${p}$${salt.toString('base64url')}$${key.toString('base64url')}`
}

function parseScrypt (hash: string): { N: number; r: number; p: number; salt: Buffer; key: Buffer } | null {
  const m = hash.match(/^\$scrypt\$(\d+)\$(\d+)\$(\d+)\$([A-Za-z0-9\-_]+)\$([A-Za-z0-9\-_]+)$/)
  if (!m) return null
  return { N: +m[1], r: +m[2], p: +m[3], salt: Buffer.from(m[4], 'base64url'), key: Buffer.from(m[5], 'base64url') }
}

/** Hash a password with scrypt. Returns $scrypt$<N>$<r>$<p>$<salt>$<key>. */
export const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(16)
  const key = scryptSync(Buffer.from(password), salt, SCRYPT_KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: SCRYPT_MAXMEM })
  return encodeScrypt(SCRYPT_N, SCRYPT_R, SCRYPT_P, salt, key)
}

/** Verify a password against a scrypt hash ($scrypt$...). */
export const verifyPassword = async (hash: string, password: string): Promise<boolean> => {
  const parts = parseScrypt(hash)
  if (!parts) return false
  try {
    const derived = scryptSync(Buffer.from(password), parts.salt, parts.key.length, { N: parts.N, r: parts.r, p: parts.p, maxmem: SCRYPT_MAXMEM })
    return timingSafeEqual(derived, parts.key)
  } catch {
    return false
  }
}

/**
 * 检查哈希是否需要升级（N 低于当前推荐值）。
 * 登录成功后调用，若返回 true 则用新参数重新哈希并写回 DB。
 */
export const needsRehash = (hash: string): boolean => {
  const parts = parseScrypt(hash)
  if (!parts) return false
  return parts.N < SCRYPT_N
}

// ========== Admin session token helpers ==========

/** Session token entropy: 32 random bytes = 256 bits. */
const SESSION_TOKEN_BYTES = 32

/**
 * Generate a high-entropy admin session token using a CSPRNG.
 * The token is a 64-character hex string; the caller is responsible
 * for returning it to the client exactly once.
 */
export const generateSessionToken = (): string => {
  return randomBytes(SESSION_TOKEN_BYTES).toString('hex')
}

/**
 * Hash a session token with SHA-256 for database storage.
 *
 * 高熵 CSPRNG token（256-bit）的熵空间为 2^256，离线暴力破解在物理上不可行，
 * 因此无需使用 scrypt 等慢哈希（慢哈希是为低熵人类密码设计的）。
 * 使用快速、确定性、单向的 SHA-256 即可：既能保证 DB 泄露后不暴露原始 token，
 * 又支持以哈希值为主键/索引做 O(1) 查询，避免全表扫描 + 同步慢哈希导致的 CPU 耗尽 DoS。
 */
export const hashSessionToken = (token: string): string => {
  return createHash('sha256').update(token).digest('hex')
}
