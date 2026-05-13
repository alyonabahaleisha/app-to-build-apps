/**
 * Package index smoke tests.
 * Verifies that all Step 1 + 2 + 3 + 4 exports are reachable from the
 * package root and that the closed-enum cardinalities match the ADR spec.
 * Tripwire for accidental re-export drops (NOTE-4 from Roz Step 2/3 QA).
 */
import {
  // Step 6: Cross-reference validator
  validateCrossRefs,
  // Step 5: Spec + SpecScreen + recursive Node
  SpecSchema,
  SpecScreenSchema,
  NodeSchema,
  // Tokens
  ColorTokenSchema,
  SpaceTokenSchema,
  RadiusTokenSchema,
  TypeRoleSchema,
  ElevationSchema,
  MotionCurveSchema,
  // Core enums
  StanceSchema,
  PaletteSchema,
  ArchetypeSchema,
  ToneSchema,
  SyncModeSchema,
  BindingKindSchema,
  SlotKindSchema,
  NavPatternSchema,
  // Canonicalization
  canonicalize,
  renderHash,
  // Step 2: Binding + Actions
  SlotNameSchema,
  ActionSchema,
  ACTION_VERB_COUNT,
  StringBindingSchema,
  // Step 3: Collection
  CollectionSchema,
  FieldTypeSchema,
  // Step 4: Component schemas + constants (added after Step 4 lands)
  ScreenSchema,
  ButtonSchema,
  FabSchema,
  ListItemSchema,
  SlotSchema,
  MAX_NESTING_DEPTH,
} from './index.js'

describe('@app-creator/protocol index smoke', () => {
  it('exports all token-name schemas', () => {
    expect(ColorTokenSchema).toBeDefined()
    expect(SpaceTokenSchema).toBeDefined()
    expect(RadiusTokenSchema).toBeDefined()
    expect(TypeRoleSchema).toBeDefined()
    expect(ElevationSchema).toBeDefined()
    expect(MotionCurveSchema).toBeDefined()
  })

  it('exports all core enum schemas', () => {
    expect(StanceSchema).toBeDefined()
    expect(PaletteSchema).toBeDefined()
    expect(ArchetypeSchema).toBeDefined()
    expect(ToneSchema).toBeDefined()
    expect(SyncModeSchema).toBeDefined()
    expect(BindingKindSchema).toBeDefined()
    expect(SlotKindSchema).toBeDefined()
    expect(NavPatternSchema).toBeDefined()
  })

  it('exports canonicalize and renderHash', () => {
    expect(typeof canonicalize).toBe('function')
    expect(typeof renderHash).toBe('function')
  })

  // NOTE-4 (Roz Step 2/3 QA): tripwire for accidental re-export drops.
  // If a future refactor silently removes a re-export from index.ts, this test
  // catches it — per-module tests import from sibling files directly, so an
  // index.ts drop would otherwise be silent at the test layer.
  it('re-exports Step 2 + Step 3 schemas from package root', () => {
    expect(SlotNameSchema).toBeDefined()
    expect(ActionSchema).toBeDefined()
    expect(ACTION_VERB_COUNT).toBe(13)
    expect(StringBindingSchema).toBeDefined() // sample one binding
    expect(CollectionSchema).toBeDefined()
    expect(FieldTypeSchema).toBeDefined()
  })

  // Step 4 re-export tripwire — extended after Step 4 lands.
  it('re-exports Step 4 component schemas from package root', () => {
    expect(ScreenSchema).toBeDefined()
    expect(ButtonSchema).toBeDefined()
    expect(FabSchema).toBeDefined()
    expect(ListItemSchema).toBeDefined()
    expect(SlotSchema).toBeDefined()
    expect(MAX_NESTING_DEPTH).toBe(8)
  })

  // Step 5 re-export tripwire — added after Step 5 lands.
  it('re-exports Step 5 Spec + SpecScreen + Node from package root', () => {
    expect(SpecSchema).toBeDefined()
    expect(SpecScreenSchema).toBeDefined()
    expect(NodeSchema).toBeDefined()
  })

  // Step 6 re-export tripwire — added after Step 6 lands.
  it('re-exports Step 6 validateCrossRefs from package root', () => {
    expect(typeof validateCrossRefs).toBe('function')
  })
})

describe('closed-enum cardinality contract', () => {
  it('ColorTokenSchema has 12 members (canvas-v0-ux.md §Token Surface)', () => {
    expect(ColorTokenSchema.options).toHaveLength(12)
  })

  it('SpaceTokenSchema has 6 members', () => {
    expect(SpaceTokenSchema.options).toHaveLength(6)
  })

  it('RadiusTokenSchema has 5 members (Sponsor-locked, F-12 ruling — brief typo was 4)', () => {
    expect(RadiusTokenSchema.options).toHaveLength(5)
  })

  it('TypeRoleSchema has 6 members', () => {
    expect(TypeRoleSchema.options).toHaveLength(6)
  })

  it('ElevationSchema has 3 members', () => {
    expect(ElevationSchema.options).toHaveLength(3)
  })

  it('MotionCurveSchema has 4 members', () => {
    expect(MotionCurveSchema.options).toHaveLength(4)
  })

  it('StanceSchema has 2 members', () => {
    expect(StanceSchema.options).toHaveLength(2)
  })

  it('PaletteSchema has 6 members', () => {
    expect(PaletteSchema.options).toHaveLength(6)
  })

  it('ArchetypeSchema has 5 members (4 V0 archetypes + unknown)', () => {
    expect(ArchetypeSchema.options).toHaveLength(5)
  })

  it("ArchetypeSchema includes 'unknown' as a reserved value (concern E from prop-review)", () => {
    expect(ArchetypeSchema.options).toContain('unknown')
  })

  it('NavPatternSchema has 4 members', () => {
    expect(NavPatternSchema.options).toHaveLength(4)
  })

  it('SyncModeSchema has 2 members and excludes cloud-shared', () => {
    expect(SyncModeSchema.options).toHaveLength(2)
    expect(SyncModeSchema.options).not.toContain('cloud-shared')
  })

  it('BindingKindSchema has 3 members', () => {
    expect(BindingKindSchema.options).toHaveLength(3)
  })

  it('SlotKindSchema has 4 members', () => {
    expect(SlotKindSchema.options).toHaveLength(4)
  })
})

describe('Stance and Palette exact values', () => {
  it("Stance is 'productive' | 'expressive'", () => {
    expect(StanceSchema.parse('productive')).toBe('productive')
    expect(StanceSchema.parse('expressive')).toBe('expressive')
    expect(() => StanceSchema.parse('neutral')).toThrow()
  })

  it("Palette is 'focus' | 'health' | 'money' | 'social' | 'learn' | 'play'", () => {
    for (const p of ['focus', 'health', 'money', 'social', 'learn', 'play']) {
      expect(PaletteSchema.parse(p)).toBe(p)
    }
    expect(() => PaletteSchema.parse('indigo')).toThrow()
  })

  it("Archetype is 'ListCRUD' | 'Tracker' | 'Journal' | 'Calculator' | 'unknown'", () => {
    for (const a of ['ListCRUD', 'Tracker', 'Journal', 'Calculator', 'unknown']) {
      expect(ArchetypeSchema.parse(a)).toBe(a)
    }
    expect(() => ArchetypeSchema.parse('Dashboard')).toThrow()
  })
})
