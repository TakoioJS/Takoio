/**
 * _comment-shared tests — including exploit verification for isMaster marking
 */
import { describe, it, expect } from 'vitest'
import * as crypto from 'node:crypto'
import { markMasterComments, type MarkableComment } from '../_comment-shared'

describe('markMasterComments', () => {
  it('marks comment whose nick matches MASTER_NAME exactly', () => {
    const comments: MarkableComment[] = [{ nick: 'Admin', mailMd5: '' }]
    markMasterComments(comments, { MASTER_NAME: 'Admin', MASTER: 'admin@test.com' })
    expect(comments[0].isMaster).toBe(true)
  })

  it('does NOT mark when only MASTER set but nick mismatched and mailMd5 absent', () => {
    const comments: MarkableComment[] = [{ nick: 'Someone', mailMd5: '' }]
    markMasterComments(comments, { MASTER: 'admin@test.com', MASTER_NAME: 'Admin' })
    expect(comments[0].isMaster).toBeUndefined()
  })

  // Regress: matching mailMd5 still marked as master (defense-in-depth for SEC-001)
  it('marks matching mailMd5 as isMaster', () => {
    const mailMd5 = crypto.createHash('sha256').update('admin@test.com').digest('hex')
    const comments: MarkableComment[] = [{ nick: 'Someone', mailMd5 }]
    markMasterComments(comments, { MASTER: 'admin@test.com', MASTER_NAME: 'Admin' })
    expect(comments[0].isMaster).toBe(true)
  })

  // Regress: non-matching mailMd5 must not be marked as master
  it('does not mark non-matching mailMd5 as isMaster', () => {
    const mailMd5 = crypto.createHash('sha256').update('other@example.com').digest('hex')
    const comments: MarkableComment[] = [{ nick: 'Someone', mailMd5 }]
    markMasterComments(comments, { MASTER: 'admin@test.com', MASTER_NAME: 'Admin' })
    expect(comments[0].isMaster).toBeUndefined()
  })

  it('marks comment whose mailMd5 matches MASTER', () => {
    const md5 = crypto.createHash('sha256').update('admin@test.com').digest('hex')
    const comments: MarkableComment[] = [{ nick: 'Someone', mailMd5: md5 }]
    markMasterComments(comments, { MASTER: 'admin@test.com', MASTER_NAME: 'Admin' })
    expect(comments[0].isMaster).toBe(true)
  })

  it('marks children recursively', () => {
    const comments: MarkableComment[] = [{
      nick: 'Someone',
      mailMd5: '',
      children: [{ nick: 'Admin', mailMd5: '' }],
    }]
    markMasterComments(comments, { MASTER: 'admin@test.com', MASTER_NAME: 'Admin' })
    expect(comments[0].children![0].isMaster).toBe(true)
  })

  it('does not crash when MASTER / MASTER_NAME are numeric (regression: config type-coercion TypeError)', () => {
    // config 存储层把字符串原样写入、读取时统一 JSON.parse：当 MASTER 是全数字
    // 字符串 "12345" 时读回的是 number 12345。旧实现直接调用 (12345).trim()
    // 会抛 TypeError，导致所有评论列表加载失败。
    const comments: MarkableComment[] = [{ nick: 'Someone', mailMd5: '' }]
    expect(() => markMasterComments(comments, {
      MASTER: 12345 as unknown as string,
      MASTER_NAME: 67890 as unknown as string,
    })).not.toThrow()
    // 数字 MASTER_NAME 不应等于任何字符串 nick，所以不会被标记为 master
    expect(comments[0].isMaster).toBeUndefined()
  })
})
