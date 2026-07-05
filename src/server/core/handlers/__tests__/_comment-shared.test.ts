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
    const md5 = crypto.createHash('sha256').update('admin@test.com').digest('hex')
    const comments: MarkableComment[] = [{
      nick: 'Someone',
      mailMd5: '',
      children: [{ nick: 'Admin', mailMd5: '' }],
    }]
    markMasterComments(comments, { MASTER: 'admin@test.com', MASTER_NAME: 'Admin' })
    expect(comments[0].children![0].isMaster).toBe(true)
  })
})