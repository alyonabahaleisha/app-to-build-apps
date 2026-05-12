/**
 * Eval prompts tests — ADR-0007 Step 7 + ADR-0009 Step 10.
 *
 * T-0007-152: ARCHETYPE_PROMPTS has exactly 100 entries.
 * T-0007-153: 25 entries per archetype (4 × 25 = 100).
 * T-0007-154: expected_archetype in closed set [ListCRUD, Tracker, Journal, Calculator].
 * T-0007-155: OUT_OF_SCOPE_DETECTION_PROMPTS has exactly 30 entries.
 * T-0007-156: 6 entries per capability (5 × 6 = 30).
 * T-0007-157: expected_capability in closed enum, no 'unknown'.
 * T-0007-158: OUT_OF_SCOPE_FALSE_POSITIVE_PROMPTS has exactly 30 entries.
 * T-0007-159: each false-positive entry has expected_archetype + brushes_against.
 * T-0009-221: total exported prompt count === 225 (100 + 30 + 30 + 60 + 5).
 * T-0009-222: V1_ARCHETYPE_PROMPTS has 60 entries, 15 per archetype.
 */

import {
  ARCHETYPE_PROMPTS,
  OUT_OF_SCOPE_DETECTION_PROMPTS,
  OUT_OF_SCOPE_FALSE_POSITIVE_PROMPTS,
  V1_ARCHETYPE_PROMPTS,
  RE_PROMPT_CONTINUITY_PROMPTS,
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

// =============================================================================
// ADR-0009 Step 10 — V1 prompt count tests (T-0009-221, T-0009-222)
// =============================================================================

describe('T-0009-221: total eval prompt count', () => {
  it('exports 225 prompts total (100 + 30 + 30 + 60 + 5)', () => {
    const total =
      ARCHETYPE_PROMPTS.length +
      OUT_OF_SCOPE_DETECTION_PROMPTS.length +
      OUT_OF_SCOPE_FALSE_POSITIVE_PROMPTS.length +
      V1_ARCHETYPE_PROMPTS.length +
      RE_PROMPT_CONTINUITY_PROMPTS.length
    expect(total).toBe(225)
  })
})

describe('V1_ARCHETYPE_PROMPTS', () => {
  it('T-0009-222: exports exactly 60 entries', () => {
    expect(V1_ARCHETYPE_PROMPTS).toHaveLength(60)
  })

  it.each(V0_ARCHETYPES)(
    'T-0009-222: has exactly 15 V1 entries for archetype %s',
    (archetype) => {
      const count = V1_ARCHETYPE_PROMPTS.filter(p => p.expected_archetype === archetype).length
      expect(count).toBe(15)
    },
  )

  it('every V1 entry has at least one target_v1_component', () => {
    for (const entry of V1_ARCHETYPE_PROMPTS) {
      expect(Array.isArray(entry.target_v1_components)).toBe(true)
      expect(entry.target_v1_components.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('every V1 entry has a non-empty id', () => {
    for (const entry of V1_ARCHETYPE_PROMPTS) {
      expect(typeof entry.id).toBe('string')
      expect(entry.id.length).toBeGreaterThan(0)
    }
  })

  it('every V1 entry has a non-empty prompt', () => {
    for (const entry of V1_ARCHETYPE_PROMPTS) {
      expect(typeof entry.prompt).toBe('string')
      expect(entry.prompt.length).toBeGreaterThan(0)
    }
  })

  it('all V1 ids are unique (no collision with V0 ids)', () => {
    const v1Ids = V1_ARCHETYPE_PROMPTS.map(p => p.id)
    const v0Ids = ARCHETYPE_PROMPTS.map(p => p.id)
    const allIds = [...v1Ids, ...v0Ids]
    const unique = new Set(allIds)
    expect(unique.size).toBe(allIds.length)
  })

  it('all V1 expected_archetype values are in the closed set', () => {
    for (const entry of V1_ARCHETYPE_PROMPTS) {
      expect(V0_ARCHETYPES).toContain(entry.expected_archetype)
    }
  })
})

describe('RE_PROMPT_CONTINUITY_PROMPTS', () => {
  it('exports exactly 5 continuity pairs', () => {
    expect(RE_PROMPT_CONTINUITY_PROMPTS).toHaveLength(5)
  })

  it('every continuity entry has initial + refinement prompts', () => {
    for (const entry of RE_PROMPT_CONTINUITY_PROMPTS) {
      expect(typeof entry.initial).toBe('string')
      expect(entry.initial.length).toBeGreaterThan(0)
      expect(typeof entry.refinement).toBe('string')
      expect(entry.refinement.length).toBeGreaterThan(0)
    }
  })

  it('every continuity entry has expected_archetype in the closed set', () => {
    for (const entry of RE_PROMPT_CONTINUITY_PROMPTS) {
      expect(V0_ARCHETYPES).toContain(entry.expected_archetype)
    }
  })

  it('every continuity entry has at least one preserved_component', () => {
    for (const entry of RE_PROMPT_CONTINUITY_PROMPTS) {
      expect(Array.isArray(entry.preserved_components)).toBe(true)
      expect(entry.preserved_components.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('all continuity ids are unique', () => {
    const ids = RE_PROMPT_CONTINUITY_PROMPTS.map(p => p.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })
})
