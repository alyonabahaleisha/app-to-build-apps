/**
 * Eval prompts tests — ADR-0007 Step 7.
 *
 * T-0007-152: ARCHETYPE_PROMPTS has exactly 100 entries.
 * T-0007-153: 25 entries per archetype (4 × 25 = 100).
 * T-0007-154: expected_archetype in closed set [ListCRUD, Tracker, Journal, Calculator].
 * T-0007-155: OUT_OF_SCOPE_DETECTION_PROMPTS has exactly 30 entries.
 * T-0007-156: 6 entries per capability (5 × 6 = 30).
 * T-0007-157: expected_capability in closed enum, no 'unknown'.
 * T-0007-158: OUT_OF_SCOPE_FALSE_POSITIVE_PROMPTS has exactly 30 entries.
 * T-0007-159: each false-positive entry has expected_archetype + brushes_against.
 */

import {
  ARCHETYPE_PROMPTS,
  OUT_OF_SCOPE_DETECTION_PROMPTS,
  OUT_OF_SCOPE_FALSE_POSITIVE_PROMPTS,
} from './prompts'
import type {V0Archetype, OutOfScopeCapability} from './prompts'

const V0_ARCHETYPES: V0Archetype[] = ['ListCRUD', 'Tracker', 'Journal', 'Calculator']

const OUT_OF_SCOPE_CAPABILITIES: OutOfScopeCapability[] = [
  'image_gen',
  'vision',
  'chat',
  'transcription',
  'classification',
]

describe('ARCHETYPE_PROMPTS', () => {
  it('T-0007-152: exports exactly 100 entries', () => {
    expect(ARCHETYPE_PROMPTS).toHaveLength(100)
  })

  it.each(V0_ARCHETYPES)(
    'T-0007-153: has exactly 25 entries for archetype %s',
    (archetype) => {
      const count = ARCHETYPE_PROMPTS.filter(p => p.expected_archetype === archetype).length
      expect(count).toBe(25)
    },
  )

  it('T-0007-154: every entry expected_archetype is in the closed set', () => {
    for (const entry of ARCHETYPE_PROMPTS) {
      expect(V0_ARCHETYPES).toContain(entry.expected_archetype)
    }
  })

  it('every entry has a non-empty id', () => {
    for (const entry of ARCHETYPE_PROMPTS) {
      expect(typeof entry.id).toBe('string')
      expect(entry.id.length).toBeGreaterThan(0)
    }
  })

  it('every entry has a non-empty prompt', () => {
    for (const entry of ARCHETYPE_PROMPTS) {
      expect(typeof entry.prompt).toBe('string')
      expect(entry.prompt.length).toBeGreaterThan(0)
    }
  })

  it('all ids are unique', () => {
    const ids = ARCHETYPE_PROMPTS.map(p => p.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })
})

describe('OUT_OF_SCOPE_DETECTION_PROMPTS', () => {
  it('T-0007-155: exports exactly 30 entries', () => {
    expect(OUT_OF_SCOPE_DETECTION_PROMPTS).toHaveLength(30)
  })

  it.each(OUT_OF_SCOPE_CAPABILITIES)(
    'T-0007-156: has exactly 6 entries for capability %s',
    (capability) => {
      const count = OUT_OF_SCOPE_DETECTION_PROMPTS.filter(
        p => p.expected_capability === capability,
      ).length
      expect(count).toBe(6)
    },
  )

  it('T-0007-157: every entry expected_capability is in the closed enum (no unknown)', () => {
    for (const entry of OUT_OF_SCOPE_DETECTION_PROMPTS) {
      expect(OUT_OF_SCOPE_CAPABILITIES).toContain(entry.expected_capability)
      // Explicitly assert 'unknown' is absent — T-0007-157
      expect(entry.expected_capability).not.toBe('unknown')
    }
  })

  it('all ids are unique', () => {
    const ids = OUT_OF_SCOPE_DETECTION_PROMPTS.map(p => p.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })
})

describe('OUT_OF_SCOPE_FALSE_POSITIVE_PROMPTS', () => {
  it('T-0007-158: exports exactly 30 entries', () => {
    expect(OUT_OF_SCOPE_FALSE_POSITIVE_PROMPTS).toHaveLength(30)
  })

  it('T-0007-159: every entry has expected_archetype in the V0 closed set', () => {
    for (const entry of OUT_OF_SCOPE_FALSE_POSITIVE_PROMPTS) {
      expect(V0_ARCHETYPES).toContain(entry.expected_archetype)
    }
  })

  it('T-0007-159: every entry has brushes_against in the capability closed set', () => {
    for (const entry of OUT_OF_SCOPE_FALSE_POSITIVE_PROMPTS) {
      expect(OUT_OF_SCOPE_CAPABILITIES).toContain(entry.brushes_against)
    }
  })

  it('T-0007-159: every entry has both expected_archetype and brushes_against fields defined', () => {
    for (const entry of OUT_OF_SCOPE_FALSE_POSITIVE_PROMPTS) {
      expect(entry).toHaveProperty('expected_archetype')
      expect(entry).toHaveProperty('brushes_against')
      expect(entry.expected_archetype).toBeDefined()
      expect(entry.brushes_against).toBeDefined()
    }
  })

  it('all ids are unique', () => {
    const ids = OUT_OF_SCOPE_FALSE_POSITIVE_PROMPTS.map(p => p.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })
})
