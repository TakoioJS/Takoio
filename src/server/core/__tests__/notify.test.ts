import { describe, it, vi } from 'vitest'
import { sendNotification } from '../notify'

vi.mock('../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

describe('sendNotification', () => {
  it('does nothing when config is null/undefined', async () => {
    await sendNotification(null as any, { title: 'Test', content: 'Test' })
    await sendNotification(undefined as any, { title: 'Test', content: 'Test' })
  })

  it('does nothing when no tokens are configured', async () => {
    const config = {}
    await sendNotification(config, { title: 'Test', content: 'Test' })
  })

  it('skips channels without tokens', async () => {
    const config = { PUSHOO_CHANNELS: '' }
    await sendNotification(config, { title: 'Test', content: 'Test' })
  })

  it('skips invalid PUSHOO_CHANNELS JSON', async () => {
    const config = { PUSHOO_CHANNELS: 'not-json' }
    await sendNotification(config, { title: 'Test', content: 'Test' })
  })
})
