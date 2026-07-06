import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword, generateSessionToken, hashSessionToken, verifySessionToken } from '../utils/crypto'

describe('Password hashing (scrypt)', () => {
  it('hashes a password and returns an encoded string', async () => {
    const hash = await hashPassword('MyTestPass123')
    expect(hash).toContain('$scrypt$')
    expect(hash.length).toBeGreaterThan(20)
  })

  it('verifies correct password', async () => {
    const hash = await hashPassword('CorrectPassword1')
    const valid = await verifyPassword(hash, 'CorrectPassword1')
    expect(valid).toBe(true)
  })

  it('rejects incorrect password', async () => {
    const hash = await hashPassword('CorrectPassword1')
    const valid = await verifyPassword(hash, 'WrongPassword1')
    expect(valid).toBe(false)
  })

  it('produces different hashes for same password (random salt)', async () => {
    const hash1 = await hashPassword('SamePassword')
    const hash2 = await hashPassword('SamePassword')
    expect(hash1).not.toBe(hash2)
  })

  it('handles invalid hash gracefully', async () => {
    const valid = await verifyPassword('not-a-valid-hash', 'password')
    expect(valid).toBe(false)
  })
})

describe('Admin session token helpers', () => {
  it('generates a 64-character hex token', () => {
    const token = generateSessionToken()
    expect(token).toMatch(/^[a-f0-9]{64}$/)
  })

  it('produces different tokens on each call', () => {
    const t1 = generateSessionToken()
    const t2 = generateSessionToken()
    expect(t1).not.toBe(t2)
  })

  it('hashes a token with scrypt', async () => {
    const token = generateSessionToken()
    const hash = await hashSessionToken(token)
    expect(hash).toContain('$scrypt$')
  })

  it('verifies a token against its hash', async () => {
    const token = generateSessionToken()
    const hash = await hashSessionToken(token)
    expect(await verifySessionToken(token, hash)).toBe(true)
    expect(await verifySessionToken(generateSessionToken(), hash)).toBe(false)
  })

  it('rejects invalid hash format without throwing', async () => {
    const token = generateSessionToken()
    expect(await verifySessionToken(token, 'not-a-scrypt-hash')).toBe(false)
  })
})
