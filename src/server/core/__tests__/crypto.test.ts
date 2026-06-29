import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from '../utils/crypto'

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
