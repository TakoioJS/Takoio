import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

// $scrypt$<N>$<r>$<p>$<salt-b64url>$<key-b64url>
function encodeScrypt (salt: Buffer, key: Buffer): string {
  return `$scrypt$16384$8$1$${salt.toString('base64url')}$${key.toString('base64url')}`
}

function parseScrypt (hash: string): { N: number; r: number; p: number; salt: Buffer; key: Buffer } | null {
  const m = hash.match(/^\$scrypt\$(\d+)\$(\d+)\$(\d+)\$([A-Za-z0-9\-_]+)\$([A-Za-z0-9\-_]+)$/)
  if (!m) return null
  return { N: +m[1], r: +m[2], p: +m[3], salt: Buffer.from(m[4], 'base64url'), key: Buffer.from(m[5], 'base64url') }
}

/** Hash a password with scrypt. Returns $scrypt$<N>$<r>$<p>$<salt>$<key>. */
export const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(16)
  const key = scryptSync(Buffer.from(password), salt, 64, { N: 16384, r: 8, p: 1 })
  return encodeScrypt(salt, key)
}

/** Verify a password against a scrypt hash ($scrypt$...). */
export const verifyPassword = async (hash: string, password: string): Promise<boolean> => {
  const parts = parseScrypt(hash)
  if (!parts) return false
  try {
    const derived = scryptSync(Buffer.from(password), parts.salt, parts.key.length, { N: parts.N, r: parts.r, p: parts.p })
    return timingSafeEqual(derived, parts.key)
  } catch {
    return false
  }
}
