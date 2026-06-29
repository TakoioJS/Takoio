import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  checkLoginRateLimit,
  recordLoginFailure,
  clearLoginFailures,
} from '../auth'

describe('Login brute-force protection', () => {
  afterEach(() => {
    // Clear all failures between tests
    clearLoginFailures('test-ip')
    clearLoginFailures('attacker-ip')
  })

  it('allows first login attempt', () => {
    const result = checkLoginRateLimit('test-ip')
    expect(result.allowed).toBe(true)
    expect(result.remainingAttempts).toBe(5)
  })

  it('decrements remaining attempts on failure', () => {
    recordLoginFailure('test-ip')
    const result = checkLoginRateLimit('test-ip')
    expect(result.allowed).toBe(true)
    expect(result.remainingAttempts).toBe(4)
  })

  it('locks out after 5 failures', () => {
    for (let i = 0; i < 5; i++) {
      recordLoginFailure('attacker-ip')
    }
    const result = checkLoginRateLimit('attacker-ip')
    expect(result.allowed).toBe(false)
    expect(result.remainingAttempts).toBe(0)
  })

  it('clears failures on successful login', () => {
    recordLoginFailure('test-ip')
    recordLoginFailure('test-ip')
    clearLoginFailures('test-ip')
    const result = checkLoginRateLimit('test-ip')
    expect(result.allowed).toBe(true)
    expect(result.remainingAttempts).toBe(5)
  })

  it('tracks IPs independently', () => {
    recordLoginFailure('test-ip')
    recordLoginFailure('test-ip')
    const r1 = checkLoginRateLimit('test-ip')
    const r2 = checkLoginRateLimit('attacker-ip')
    expect(r1.remainingAttempts).toBe(3)
    expect(r2.remainingAttempts).toBe(5)
  })
})
