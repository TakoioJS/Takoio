/**
 * useDynamicList composable 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useDynamicList } from '../useDynamicList'

vi.mock('naive-ui', () => ({
  useDialog: () => ({
    warning: vi.fn((opts: any) => { opts.onPositiveClick?.() }),
  }),
}))

describe('useDynamicList', () => {
  beforeEach(() => { vi.clearAllMocks() })

  const all = ['a', 'b', 'c']
  const label = (k: string) => `Label-${k}`

  it('initializes with given active items', () => {
    const { active } = useDynamicList({ all, initial: ['a', 'b'] })
    expect(active.value).toEqual(['a', 'b'])
  })

  it('defaults to empty active list', () => {
    const { active } = useDynamicList({ all })
    expect(active.value).toEqual([])
  })

  it('computes available options excluding active', () => {
    const { available } = useDynamicList({ all, initial: ['a'] })
    const options = available.value
    expect(options).toHaveLength(2)
    expect(options.map(o => o.value)).not.toContain('a')
  })

  it('uses label function for display', () => {
    const { available } = useDynamicList({ all, label, initial: [] })
    expect(available.value[0]).toEqual({ label: 'Label-a', value: 'a' })
  })

  it('add adds an item to active', () => {
    const { active, add } = useDynamicList({ all, initial: ['a'] })
    add('b')
    expect(active.value).toContain('b')
  })

  it('add does not duplicate existing items', () => {
    const { active, add } = useDynamicList({ all, initial: ['a'] })
    add('a')
    expect(active.value.filter(x => x === 'a')).toHaveLength(1)
  })

  it('remove splices item from active (with confirmRemove=false)', () => {
    const { active, remove } = useDynamicList({ all, initial: ['a', 'b'], confirmRemove: false })
    remove('a')
    expect(active.value).toEqual(['b'])
  })

  it('setActive replaces entire active list', () => {
    const { active, setActive } = useDynamicList({ all, initial: ['a'] })
    setActive(['b', 'c'])
    expect(active.value).toEqual(['b', 'c'])
  })
})