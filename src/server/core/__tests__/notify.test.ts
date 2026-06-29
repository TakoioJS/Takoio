import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sendNotification } from '../notify'

vi.mock('../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

describe('sendNotification', () => {
  it('does nothing when config is null/undefined', async () => {
    // Should not throw
    await sendNotification(null as any, { title: 'Test', content: 'Test' })
    await sendNotification(undefined as any, { title: 'Test', content: 'Test' })
  })

  it('does nothing when no tokens are configured', async () => {
    const config = {}
    await sendNotification(config, { title: 'Test', content: 'Test' })
    // No error should be thrown
  })

  it('skips channels without tokens', async () => {
    const config = { PUSHOO_SC_KEY: '', PUSHOO_TELEGRAM_TOKEN: '' }
    await sendNotification(config, { title: 'Test', content: 'Test' })
    // No error should be thrown
  })
})
