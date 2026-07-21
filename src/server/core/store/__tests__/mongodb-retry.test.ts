/**
 * Regression test for the MongoDB getDb() permanent-outage bug.
 *
 * Background: getDb() caches the in-flight connect attempt in `_connectPromise`.
 * Previously, if `client.connect()` threw, the rejected promise was never cleared
 * and the `close` event listener (which resets state) was never registered —
 * because it is attached only AFTER a successful connect. As a result, every
 * subsequent `getDb()` call hit `if (_connectPromise) return _connectPromise`
 * and returned the same rejected promise forever. A single transient failure
 * (network blip, MongoDB restart, brief DNS issue) permanently bricked the DB
 * until process restart.
 *
 * This test mocks the `mongodb` module so the first `connect()` throws and the
 * second succeeds, then asserts that the second call actually retries instead
 * of returning the cached rejection.
 */
import { describe, it, expect, vi } from 'vitest'

describe('mongodb store: getDb retry after transient connect failure', () => {
  it('clears _connectPromise on failure so the next call retries (regression)', async () => {
    vi.resetModules()

    let call = 0
    const connectMock = vi.fn(async function () {
      call++
      if (call === 1) throw new Error('simulated transient connect failure')
    })
    const closeMock = vi.fn(async function () {})

    // vitest 4 requires constructor mocks to use `function`/`class` syntax,
    // otherwise `new MongoClient(...)` throws "... is not a constructor".
    vi.doMock('mongodb', () => {
      class MockMongoClient {
        connect = connectMock
        on = vi.fn()
        close = closeMock
        db () {
          return {
            collection () {
              return {
                createIndexes: async () => {},
                createIndex: async () => {},
              }
            },
          }
        }
      }
      return { MongoClient: MockMongoClient as any }
    })
    vi.doMock('../../env', () => ({
      MONGODB_URI: 'mongodb://localhost:27017',
      MONGODB_DB: 'takoio-test',
    }))

    const { ensureDb, closeMongoDb } = await import('../mongodb')

    // First call: connect() throws — error must propagate to caller.
    await expect(ensureDb()).rejects.toThrow('simulated transient connect failure')

    // The failed client must be closed to avoid leaking the connection pool.
    expect(closeMock).toHaveBeenCalledTimes(1)

    // Second call: must retry (not return the cached rejected promise).
    // _connectAttempts === 2 here, so getDb() sleeps ~1s backoff before retrying — accepted.
    await expect(ensureDb()).resolves.toBeUndefined()

    // Proof that a real retry happened: connect() was invoked twice, not once.
    expect(connectMock).toHaveBeenCalledTimes(2)

    await closeMongoDb()
  })
})
