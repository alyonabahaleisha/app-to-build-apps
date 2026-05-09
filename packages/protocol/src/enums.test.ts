/**
 * Step 1 core enum tests.
 * Tests: T-0005-013 through T-0005-024
 */
import {
  StanceSchema,
  PaletteSchema,
  ArchetypeSchema,
  NavPatternSchema,
  FieldTypeDiscriminantSchema,
  SyncModeSchema,
} from './enums.js'

// ---------------------------------------------------------------------------
// StanceSchema
// ---------------------------------------------------------------------------

describe('StanceSchema', () => {
  // T-0005-013
  it("parses 'productive'", () => {
    expect(StanceSchema.parse('productive')).toBe('productive')
  })

  // T-0005-014
  it("parses 'expressive'", () => {
    expect(StanceSchema.parse('expressive')).toBe('expressive')
  })

  // T-0005-015
  it("rejects 'neutral' (not a V0 stance)", () => {
    expect(() => StanceSchema.parse('neutral')).toThrow()
  })

  it('has exactly 2 members', () => {
    expect(StanceSchema.options).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// PaletteSchema
// ---------------------------------------------------------------------------

describe('PaletteSchema', () => {
  // T-0005-016: all 6 Palette values parse
  const ALL_PALETTES = ['focus', 'health', 'money', 'social', 'learn', 'play'] as const

  it.each(ALL_PALETTES)('parses palette %s', palette => {
    expect(PaletteSchema.parse(palette)).toBe(palette)
  })

  it('has exactly 6 members', () => {
    expect(PaletteSchema.options).toHaveLength(6)
  })
})

// ---------------------------------------------------------------------------
// ArchetypeSchema
// ---------------------------------------------------------------------------

describe('ArchetypeSchema', () => {
  // T-0005-017
  it("parses 'Calculator'", () => {
    expect(ArchetypeSchema.parse('Calculator')).toBe('Calculator')
  })

  // T-0005-018
  it("parses 'unknown' (reserved for V0.5 forward compatibility)", () => {
    expect(ArchetypeSchema.parse('unknown')).toBe('unknown')
  })

  // T-0005-019
  it("rejects 'Dashboard' (M2 archetype, not in V0)", () => {
    expect(() => ArchetypeSchema.parse('Dashboard')).toThrow()
  })

  it('has exactly 5 members (4 V0 archetypes + unknown)', () => {
    expect(ArchetypeSchema.options).toHaveLength(5)
  })

  it('includes all 4 V0 archetypes', () => {
    expect(ArchetypeSchema.options).toContain('ListCRUD')
    expect(ArchetypeSchema.options).toContain('Tracker')
    expect(ArchetypeSchema.options).toContain('Journal')
    expect(ArchetypeSchema.options).toContain('Calculator')
  })
})

// ---------------------------------------------------------------------------
// NavPatternSchema
// ---------------------------------------------------------------------------

describe('NavPatternSchema', () => {
  // T-0005-020
  it("parses 'none'", () => {
    expect(NavPatternSchema.parse('none')).toBe('none')
  })

  // T-0005-021: all 4 NavPattern values parse
  const ALL_NAV_PATTERNS = ['none', 'stack', 'tabs', 'modal-overlay'] as const

  it.each(ALL_NAV_PATTERNS)('parses nav pattern %s', pattern => {
    expect(NavPatternSchema.parse(pattern)).toBe(pattern)
  })

  it('has exactly 4 members', () => {
    expect(NavPatternSchema.options).toHaveLength(4)
  })
})

// ---------------------------------------------------------------------------
// FieldType discriminated union — via FieldTypeDiscriminantSchema
// Note: the full FieldTypeSchema discriminated union lives in Step 3 (collection.ts).
// T-0005-022 and T-0005-023 test the enum-level behavior here.
// ---------------------------------------------------------------------------

describe('FieldTypeDiscriminantSchema', () => {
  // T-0005-022: each variant string
  const ALL_FIELD_TYPES = ['string', 'number', 'boolean', 'date', 'image', 'reference'] as const

  it.each(ALL_FIELD_TYPES)('parses field type discriminant %s', type => {
    expect(FieldTypeDiscriminantSchema.parse(type)).toBe(type)
  })

  // T-0005-023
  it("rejects 'array' (not a V0 field type)", () => {
    expect(() => FieldTypeDiscriminantSchema.parse('array')).toThrow()
  })

  it('has exactly 6 members', () => {
    expect(FieldTypeDiscriminantSchema.options).toHaveLength(6)
  })
})

// ---------------------------------------------------------------------------
// SyncModeSchema
// ---------------------------------------------------------------------------

describe('SyncModeSchema', () => {
  // T-0005-024
  it("parses 'local'", () => {
    expect(SyncModeSchema.parse('local')).toBe('local')
  })

  it("parses 'cloud-private'", () => {
    expect(SyncModeSchema.parse('cloud-private')).toBe('cloud-private')
  })

  it("rejects 'cloud-shared' (V0.5+)", () => {
    expect(() => SyncModeSchema.parse('cloud-shared')).toThrow()
  })

  it('has exactly 2 members', () => {
    expect(SyncModeSchema.options).toHaveLength(2)
  })
})
