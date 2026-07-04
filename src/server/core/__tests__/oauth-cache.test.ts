import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  setState,
  getState,
  consumeState,
  setVerifyCode,
  consumeVerifyCode,
} from '../store/oauth-cache'
import type { AuthUser } from '../auth-social'

// Mock Redis to simulate "Redis unavailable" so the module falls through
// to its in-memory LRU fallback. This is the canonical way to test the
// fallback path and the only one that doesn't require a live Redis.
vi.mock('../store/redis', () => ({
  withRedis: vi.fn().mockResolvedValue(null),
}))

const sampleUser: AuthUser = {
  provider: 'email',
  id: 'user-1',
  name: 'Alice',
  email: 'alice@example.com',
  avatar: 'https://example.com/a.png',
}

describe('setState / getState / consumeState', () => {
  it('round-trips a state token', async () => {
    await setState('state-1')
    await expect(getState('state-1')).resolves.toBe(true)
  })

  it('returns false for an unknown state token', async () => {
    await expect(getState('does-not-exist')).resolves.toBe(false)
  })

  it('consumes a state token once (subsequent consumeState returns false)', async () => {
    await setState('state-2')
    await expect(consumeState('state-2')).resolves.toBe(true)
    await expect(consumeState('state-2')).resolves.toBe(false)
  })

  it('consumeState on an unknown token returns false', async () => {
    await expect(consumeState('never-set')).resolves.toBe(false)
  })

  it('keeps state entries isolated by key', async () => {
    await setState('a')
    await setState('b')
    expect(await getState('a')).toBe(true)
    expect(await getState('b')).toBe(true)
    await consumeState('a')
    expect(await getState('a')).toBe(false)
    expect(await getState('b')).toBe(true)
  })
})

describe('state TTL — 5 minute expiry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('expireState after 5 minutes (300_000ms)', async () => {
    const t0 = new Date('2026-01-01T00:00:00Z').getTime()
    vi.setSystemTime(t0)

    await setState('ttl-1')
    expect(await getState('ttl-1')).toBe(true)

    // 4m59s — still alive
    vi.setSystemTime(t0 + 4 * 60_000 + 59_000)
    expect(await getState('ttl-1')).toBe(true)

    // 5m01s — expired
    vi.setSystemTime(t0 + 5 * 60_000 + 1_000)
    expect(await getState('ttl-1')).toBe(false)
  })

  it('consumeState after expiry returns false', async () => {
    const t0 = new Date('2026-01-01T00:00:00Z').getTime()
    vi.setSystemTime(t0)

    await setState('ttl-2')
    vi.setSystemTime(t0 + 6 * 60_000)
    await expect(consumeState('ttl-2')).resolves.toBe(false)
  })
})

describe('setVerifyCode / consumeVerifyCode', () => {
  it('round-trips a verify code', async () => {
    await setVerifyCode('uuid-1', '123456', sampleUser)
    const got = await consumeVerifyCode('uuid-1', '123456')
    expect(got).toEqual(sampleUser)
  })

  it('returns null when the code does not match', async () => {
    await setVerifyCode('uuid-2', '123456', sampleUser)
    const got = await consumeVerifyCode('uuid-2', '000000')
    expect(got).toBeNull()
  })

  it('returns null for an unknown uuid', async () => {
    const got = await consumeVerifyCode('not-set', '123456')
    expect(got).toBeNull()
  })

  it('deletes the code after a successful consume', async () => {
    await setVerifyCode('uuid-3', '654321', sampleUser)
    expect(await consumeVerifyCode('uuid-3', '654321')).toEqual(sampleUser)
    // Second consume — entry has been deleted
    expect(await consumeVerifyCode('uuid-3', '654321')).toBeNull()
  })

  it('keeps verify codes for different uuids isolated', async () => {
    await setVerifyCode('uuid-a', '111111', sampleUser)
    await setVerifyCode('uuid-b', '222222', { ...sampleUser, id: 'user-2' })

    expect(await consumeVerifyCode('uuid-a', '111111')).toEqual(sampleUser)
    expect(await consumeVerifyCode('uuid-b', '222222')).toEqual({ ...sampleUser, id: 'user-2' })
  })
})

describe('verify code TTL', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('expireVerifyCode after 5 minutes', async () => {
    const t0 = new Date('2026-01-01T00:00:00Z').getTime()
    vi.setSystemTime(t0)

    await setVerifyCode('uuid-ttl', '999999', sampleUser)
    expect(await consumeVerifyCode('uuid-ttl', '999999')).toEqual(sampleUser)

    // Re-set so the entry exists again
    await setVerifyCode('uuid-ttl', '999999', sampleUser)
    vi.setSystemTime(t0 + 5 * 60_000 + 1_000)
    expect(await consumeVerifyCode('uuid-ttl', '999999')).toBeNull()
  })
})

describe('memory LRU fallback (Redis mocked as unavailable)', () => {
  it('uses the in-memory LRU when withRedis returns null', async () => {
    // The top-level mock returns null for withRedis — i.e. Redis is
    // unavailable. The cache must still function via the memory LRU.
    const { withRedis } = await import('../store/redis')
    expect(await withRedis(async () => true)).toBeNull()

    await setState('mem-1')
    expect(await getState('mem-1')).toBe(true)
    expect(await consumeState('mem-1')).toBe(true)
    expect(await getState('mem-1')).toBe(false)

    await setVerifyCode('mem-uuid', '000111', sampleUser)
    expect(await consumeVerifyCode('mem-uuid', '000111')).toEqual(sampleUser)
    expect(await consumeVerifyCode('mem-uuid', '000111')).toBeNull()
  })
})
