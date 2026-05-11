/**
 * suggestedPrompts tests — ADR-0011 Step 9.
 *
 * T-0011-204: shuffled per-session
 * T-0011-205: same session seed → same order
 * T-0011-206: two different seeds → at least one different chip order
 * T-0011-207: pool has exactly 10 entries
 */
import {SUGGESTED_PROMPT_POOL, pickSuggestedPrompts} from './suggestedPrompts'

describe('SUGGESTED_PROMPT_POOL', () => {
  it('T-0011-207: has exactly 10 entries', () => {
    expect(SUGGESTED_PROMPT_POOL).toHaveLength(10)
  })
})

describe('pickSuggestedPrompts', () => {
  it('T-0011-204: returns 6 prompts', () => {
    const result = pickSuggestedPrompts('test-seed-1234')
    expect(result).toHaveLength(6)
  })

  it('T-0011-205: same seed → same order', () => {
    const seed = 'aaaaaaaa-aaaa-4aaa-baaa-aaaaaaaaaaaa'
    const first = pickSuggestedPrompts(seed)
    const second = pickSuggestedPrompts(seed)
    expect(first.map(p => p.text)).toEqual(second.map(p => p.text))
  })

  it('T-0011-206: different seeds → different order (probabilistic)', () => {
    // Two distinct UUIDs that produce different LCG starting states.
    const seedA = '00000000-0000-0000-0000-000000000001'
    const seedB = 'ffffffff-ffff-4fff-bfff-ffffffffffff'
    const orderA = pickSuggestedPrompts(seedA).map(p => p.text)
    const orderB = pickSuggestedPrompts(seedB).map(p => p.text)
    // At least one position should differ.
    const hasDifference = orderA.some((text, idx) => orderB[idx] !== text)
    expect(hasDifference).toBe(true)
  })

  it('returns only prompts that exist in the pool', () => {
    const poolTexts = SUGGESTED_PROMPT_POOL.map(p => p.text)
    const result = pickSuggestedPrompts('test-seed')
    result.forEach(p => {
      expect(poolTexts).toContain(p.text)
    })
  })
})
