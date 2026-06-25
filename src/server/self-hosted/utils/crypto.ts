/**
 * Password hashing via hash-wasm (pure WASM Argon2id).
 * Drop-in replacement for the native argon2 package.
 */

import { randomBytes } from 'node:crypto'
import { argon2id, argon2Verify } from 'hash-wasm'

const ARGON2_PARAMS = {
  memorySize: 65536,   // 64 MB
  iterations: 3,       // timeCost
  parallelism: 4,
  hashLength: 32,
  outputType: 'encoded' as const,
}

/** Hash a password with Argon2id. Returns the standard encoded string ($argon2id$...). */
export const hashPassword = async (password: string): Promise<string> => {
  const salt = new Uint8Array(randomBytes(16))
  return argon2id({ password, salt, ...ARGON2_PARAMS })
}

/** Verify a password against an existing Argon2id encoded hash. */
export const verifyPassword = async (hash: string, password: string): Promise<boolean> => {
  try {
    return await argon2Verify({ hash, password })
  } catch {
    return false
  }
}
