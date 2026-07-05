/**
 * useApi composable 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useApi } from '../useApi'

vi.mock('naive-ui', () => ({
  useMessage: () => ({
    success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn(),
  }),
}))

describe('useApi', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('calls the function and returns data on success', async () => {
    const { call, loading } = useApi()
    const fn = vi.fn().mockResolvedValue('result')
    const result = await call(() => fn())
    expect(result).toBe('result')
    expect(loading.value).toBe(false)
  })

  it('sets loading to true during execution', async () => {
    const { call, loading } = useApi()
    let resolve: (v: any) => void
    const promise = new Promise(r => { resolve = r })
    const callPromise = call(() => promise)
    expect(loading.value).toBe(true)
    resolve!('done')
    await callPromise
    expect(loading.value).toBe(false)
  })

  it('calls onSuccess callback with data', async () => {
    const { call } = useApi()
    const onSuccess = vi.fn()
    await call(() => Promise.resolve('data'), { onSuccess })
    expect(onSuccess).toHaveBeenCalledWith('data')
  })

  it('calls onError callback on failure', async () => {
    const { call } = useApi()
    const onError = vi.fn()
    await call(() => Promise.reject(new Error('fail')), { onError })
    expect(onError).toHaveBeenCalledWith(expect.any(Error))
  })

  it('returns undefined on error', async () => {
    const { call } = useApi()
    const result = await call(() => Promise.reject(new Error('fail')))
    expect(result).toBeUndefined()
  })

  it('shows success toast when successMsg is provided', async () => {
    const { call } = useApi()
    const result = await call(() => Promise.resolve('ok'), { successMsg: 'done!' })
    expect(result).toBe('ok')
  })
})