import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  checkLoginRateLimit,
  recordLoginFailure,
  clearLoginFailures,
} from '../auth'

// Mock Redis to return null (no Redis available in tests)
vi.mock('../store/redis', () => ({
  withRedis: vi.fn().mockResolvedValue(null),
}))

describe('Login brute-force protection', () => {
  afterEach(async () => {
    // Clear all failures between tests
    await clearLoginFailures('test-ip')
    await clearLoginFailures('attacker-ip')
  })

  it('allows first login attempt', async () => {
    const result = await checkLoginRateLimit('test-ip')
    expect(result.allowed).toBe(true)
    expect(result.remainingAttempts).toBe(5)
  })

  it('decrements remaining attempts on failure', async () => {
    await recordLoginFailure('test-ip')
    const result = await checkLoginRateLimit('test-ip')
    expect(result.allowed).toBe(true)
    expect(result.remainingAttempts).toBe(4)
  })

  it('locks out after 5 failures', async () => {
    for (let i = 0; i < 5; i++) {
      await recordLoginFailure('attacker-ip')
    }
    const result = await checkLoginRateLimit('attacker-ip')
    expect(result.allowed).toBe(false)
    expect(result.remainingAttempts).toBe(0)
  })

  it('clears failures on successful login', async () => {
    await recordLoginFailure('test-ip')
    await recordLoginFailure('test-ip')
    await clearLoginFailures('test-ip')
    const result = await checkLoginRateLimit('test-ip')
    expect(result.allowed).toBe(true)
    expect(result.remainingAttempts).toBe(5)
  })

  it('tracks IPs independently', async () => {
    await recordLoginFailure('test-ip')
    await recordLoginFailure('test-ip')
    const r1 = await checkLoginRateLimit('test-ip')
    const r2 = await checkLoginRateLimit('attacker-ip')
    expect(r1.remainingAttempts).toBe(3)
    expect(r2.remainingAttempts).toBe(5)
  })
})
