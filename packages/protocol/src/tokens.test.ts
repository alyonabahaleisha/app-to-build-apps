/**
 * Step 1 token-name enum tests.
 * Tests: T-0005-001 through T-0005-012
 */
import {
  ColorTokenSchema,
  SpaceTokenSchema,
  RadiusTokenSchema,
  TypeRoleSchema,
  ElevationSchema,
  MotionCurveSchema,
} from './tokens.js'

// ---------------------------------------------------------------------------
// ColorTokenSchema
// ---------------------------------------------------------------------------

describe('ColorTokenSchema', () => {
  // T-0005-001
  it("parses 'accent' and returns 'accent'", () => {
    expect(ColorTokenSchema.parse('accent')).toBe('accent')
  })

  // T-0005-002
  it("parses 'bg-elevated'", () => {
    expect(ColorTokenSchema.parse('bg-elevated')).toBe('bg-elevated')
  })

  // T-0005-003
  it("rejects 'primary' (legacy M1 name)", () => {
    expect(() => ColorTokenSchema.parse('primary')).toThrow()
  })

  // T-0005-004
  it("rejects 'accent-bg' (typo of accent-fg)", () => {
    expect(() => ColorTokenSchema.parse('accent-bg')).toThrow()
  })

  // T-0005-005
  it('rejects empty string', () => {
    expect(() => ColorTokenSchema.parse('')).toThrow()
  })

  // T-0005-006
  it('rejects null', () => {
    expect(() => ColorTokenSchema.parse(null)).toThrow()
  })

  // T-0005-007: all 12 ColorToken values parse
  const ALL_COLOR_TOKENS = [
    'bg',
    'bg-elevated',
    'bg-overlay',
    'fg',
    'fg-muted',
    'fg-faint',
    'divider',
    'accent',
    'accent-fg',
    'success',
    'warning',
    'danger',
  ] as const

  it.each(ALL_COLOR_TOKENS)('parses color token %s', token => {
    expect(ColorTokenSchema.parse(token)).toBe(token)
  })

  it('has exactly 12 members', () => {
    expect(ColorTokenSchema.options).toHaveLength(12)
  })
})

// ---------------------------------------------------------------------------
// SpaceTokenSchema
// ---------------------------------------------------------------------------

describe('SpaceTokenSchema', () => {
  // T-0005-008: all 6 SpaceToken values parse
  const ALL_SPACE_TOKENS = [
    'space-none',
    'space-xs',
    'space-sm',
    'space-md',
    'space-lg',
    'space-xl',
  ] as const

  it.each(ALL_SPACE_TOKENS)('parses space token %s', token => {
    expect(SpaceTokenSchema.parse(token)).toBe(token)
  })

  it('has exactly 6 members', () => {
    expect(SpaceTokenSchema.options).toHaveLength(6)
  })
})

// ---------------------------------------------------------------------------
// RadiusTokenSchema
// ---------------------------------------------------------------------------

describe('RadiusTokenSchema', () => {
  // T-0005-009: all 5 RadiusToken values parse (Sponsor-locked at 5, incl. radius-none)
  const ALL_RADIUS_TOKENS = [
    'radius-none',
    'radius-sm',
    'radius-md',
    'radius-lg',
    'radius-full',
  ] as const

  it.each(ALL_RADIUS_TOKENS)('parses radius token %s', token => {
    expect(RadiusTokenSchema.parse(token)).toBe(token)
  })

  it('has exactly 5 members (Sponsor-locked, F-12 ruling)', () => {
    expect(RadiusTokenSchema.options).toHaveLength(5)
  })

  it("includes 'radius-none' as a named sentinel value", () => {
    expect(RadiusTokenSchema.options).toContain('radius-none')
  })
})

// ---------------------------------------------------------------------------
// TypeRoleSchema
// ---------------------------------------------------------------------------

describe('TypeRoleSchema', () => {
  // T-0005-010: all 6 TypeRole values parse
  const ALL_TYPE_ROLES = [
    'type-display',
    'type-h1',
    'type-h2',
    'type-body',
    'type-caption',
    'type-micro',
  ] as const

  it.each(ALL_TYPE_ROLES)('parses type role %s', token => {
    expect(TypeRoleSchema.parse(token)).toBe(token)
  })

  it('has exactly 6 members', () => {
    expect(TypeRoleSchema.options).toHaveLength(6)
  })
})

// ---------------------------------------------------------------------------
// ElevationSchema
// ---------------------------------------------------------------------------

describe('ElevationSchema', () => {
  // T-0005-011: all 3 Elevation values parse
  const ALL_ELEVATIONS = [
    'elevation-flat',
    'elevation-raised',
    'elevation-floating',
  ] as const

  it.each(ALL_ELEVATIONS)('parses elevation %s', token => {
    expect(ElevationSchema.parse(token)).toBe(token)
  })

  it('has exactly 3 members', () => {
    expect(ElevationSchema.options).toHaveLength(3)
  })
})

// ---------------------------------------------------------------------------
// MotionCurveSchema
// ---------------------------------------------------------------------------

describe('MotionCurveSchema', () => {
  // T-0005-012: all 4 MotionCurve values parse
  const ALL_MOTION_CURVES = [
    'motion-instant',
    'motion-snappy',
    'motion-smooth',
    'motion-springy',
  ] as const

  it.each(ALL_MOTION_CURVES)('parses motion curve %s', token => {
    expect(MotionCurveSchema.parse(token)).toBe(token)
  })

  it('has exactly 4 members', () => {
    expect(MotionCurveSchema.options).toHaveLength(4)
  })
})
