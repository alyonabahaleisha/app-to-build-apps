// ADR-0005 Step 8 token tests: T-0005-213..218
// V1 Phase 1 Step 3: T-0009-068..073, T-0009-240 (tintColor)
// Tests for concrete token values in tokens.ts.

import {SPACING, RADII, TYPE_BY_STANCE, ELEVATION, MOTION, tintColor} from './tokens.js'

// ---------------------------------------------------------------------------
// Cardinality tripwires — catch accidental addition/removal of token entries.
// ---------------------------------------------------------------------------
describe('token cardinality', () => {
  it('SPACING has exactly 6 entries', () => {
    expect(Object.keys(SPACING)).toHaveLength(6)
  })

  it('RADII has exactly 5 entries (F-12 Sponsor ruling)', () => {
    // T-0005-214: exactly 5 entries — radius-none, radius-sm, radius-md, radius-lg, radius-full
    expect(Object.keys(RADII)).toHaveLength(5)
  })

  it('TYPE_BY_STANCE.productive has exactly 6 roles', () => {
    expect(Object.keys(TYPE_BY_STANCE.productive)).toHaveLength(6)
  })

  it('TYPE_BY_STANCE.expressive has exactly 6 roles', () => {
    expect(Object.keys(TYPE_BY_STANCE.expressive)).toHaveLength(6)
  })

  it('ELEVATION has exactly 3 entries', () => {
    expect(Object.keys(ELEVATION)).toHaveLength(3)
  })

  it('MOTION has exactly 4 entries', () => {
    expect(Object.keys(MOTION)).toHaveLength(4)
  })
})

// ---------------------------------------------------------------------------
// Spacing token values (canvas-v0-ux.md §Token Surface)
// ---------------------------------------------------------------------------
describe('SPACING', () => {
  it('space-none is 0', () => {
    expect(SPACING['space-none']).toBe(0)
  })

  it('space-xs is 4', () => {
    expect(SPACING['space-xs']).toBe(4)
  })

  it('space-sm is 8', () => {
    expect(SPACING['space-sm']).toBe(8)
  })

  // T-0005-213
  it('space-md is 12', () => {
    expect(SPACING['space-md']).toBe(12)
  })

  it('space-lg is 20', () => {
    expect(SPACING['space-lg']).toBe(20)
  })

  it('space-xl is 32', () => {
    expect(SPACING['space-xl']).toBe(32)
  })
})

// ---------------------------------------------------------------------------
// Radii token values
// ---------------------------------------------------------------------------
describe('RADII', () => {
  it('radius-none is 0', () => {
    expect(RADII['radius-none']).toBe(0)
  })

  it('radius-sm is 6', () => {
    expect(RADII['radius-sm']).toBe(6)
  })

  it('radius-md is 12', () => {
    expect(RADII['radius-md']).toBe(12)
  })

  it('radius-lg is 20', () => {
    expect(RADII['radius-lg']).toBe(20)
  })

  // T-0005-214: radius-full and exact count of 5
  it('radius-full is 9999', () => {
    expect(RADII['radius-full']).toBe(9999)
  })

  it('RADII has exactly the 5 expected key names', () => {
    expect(Object.keys(RADII).sort()).toEqual(
      ['radius-full', 'radius-lg', 'radius-md', 'radius-none', 'radius-sm'].sort(),
    )
  })
})

// ---------------------------------------------------------------------------
// Type roles — productive stance (T-0005-216)
// ---------------------------------------------------------------------------
describe('TYPE_BY_STANCE.productive', () => {
  // T-0005-216: body matches canvas-v0-ux.md (16/24/400/0)
  it('body matches canvas-v0-ux.md: size=16, lineHeight=24, weight=400, letterSpacing=0', () => {
    const {body} = TYPE_BY_STANCE.productive
    expect(body.size).toBe(16)
    expect(body.lineHeight).toBe(24)
    expect(body.weight).toBe(400)
    expect(body.letterSpacing).toBe(0)
  })

  it('display matches canvas-v0-ux.md: size=32, lineHeight=40, weight=600, letterSpacing=-0.4', () => {
    const {display} = TYPE_BY_STANCE.productive
    expect(display.size).toBe(32)
    expect(display.lineHeight).toBe(40)
    expect(display.weight).toBe(600)
    expect(display.letterSpacing).toBe(-0.4)
  })

  it('h1 matches canvas-v0-ux.md: size=24, lineHeight=30, weight=600, letterSpacing=-0.2', () => {
    const {h1} = TYPE_BY_STANCE.productive
    expect(h1.size).toBe(24)
    expect(h1.lineHeight).toBe(30)
    expect(h1.weight).toBe(600)
    expect(h1.letterSpacing).toBe(-0.2)
  })

  it('h2 matches canvas-v0-ux.md: size=18, lineHeight=24, weight=600, letterSpacing=0', () => {
    const {h2} = TYPE_BY_STANCE.productive
    expect(h2.size).toBe(18)
    expect(h2.lineHeight).toBe(24)
    expect(h2.weight).toBe(600)
    expect(h2.letterSpacing).toBe(0)
  })

  it('caption matches canvas-v0-ux.md: size=13, lineHeight=18, weight=400, letterSpacing=0.1', () => {
    const {caption} = TYPE_BY_STANCE.productive
    expect(caption.size).toBe(13)
    expect(caption.lineHeight).toBe(18)
    expect(caption.weight).toBe(400)
    expect(caption.letterSpacing).toBe(0.1)
  })

  it('micro matches canvas-v0-ux.md: size=11, lineHeight=14, weight=500, letterSpacing=0.4', () => {
    const {micro} = TYPE_BY_STANCE.productive
    expect(micro.size).toBe(11)
    expect(micro.lineHeight).toBe(14)
    expect(micro.weight).toBe(500)
    expect(micro.letterSpacing).toBe(0.4)
  })
})

// ---------------------------------------------------------------------------
// Type roles — expressive stance (T-0005-217)
// ---------------------------------------------------------------------------
describe('TYPE_BY_STANCE.expressive', () => {
  // T-0005-217: display matches canvas-v0-ux.md (36/44/500/-0.6)
  it('display matches canvas-v0-ux.md: size=36, lineHeight=44, weight=500, letterSpacing=-0.6', () => {
    const {display} = TYPE_BY_STANCE.expressive
    expect(display.size).toBe(36)
    expect(display.lineHeight).toBe(44)
    expect(display.weight).toBe(500)
    expect(display.letterSpacing).toBe(-0.6)
  })

  it('h1 matches canvas-v0-ux.md: size=28, lineHeight=36, weight=500, letterSpacing=-0.3', () => {
    const {h1} = TYPE_BY_STANCE.expressive
    expect(h1.size).toBe(28)
    expect(h1.lineHeight).toBe(36)
    expect(h1.weight).toBe(500)
    expect(h1.letterSpacing).toBe(-0.3)
  })

  it('h2 matches canvas-v0-ux.md: size=22, lineHeight=30, weight=500, letterSpacing=-0.1', () => {
    const {h2} = TYPE_BY_STANCE.expressive
    expect(h2.size).toBe(22)
    expect(h2.lineHeight).toBe(30)
    expect(h2.weight).toBe(500)
    expect(h2.letterSpacing).toBe(-0.1)
  })

  it('body matches canvas-v0-ux.md: size=16, lineHeight=26, weight=400, letterSpacing=0', () => {
    const {body} = TYPE_BY_STANCE.expressive
    expect(body.size).toBe(16)
    expect(body.lineHeight).toBe(26)
    expect(body.weight).toBe(400)
    expect(body.letterSpacing).toBe(0)
  })

  it('caption matches canvas-v0-ux.md: size=14, lineHeight=20, weight=400, letterSpacing=0', () => {
    const {caption} = TYPE_BY_STANCE.expressive
    expect(caption.size).toBe(14)
    expect(caption.lineHeight).toBe(20)
    expect(caption.weight).toBe(400)
    expect(caption.letterSpacing).toBe(0)
  })

  it('micro matches canvas-v0-ux.md: size=11, lineHeight=14, weight=500, letterSpacing=0.4', () => {
    const {micro} = TYPE_BY_STANCE.expressive
    expect(micro.size).toBe(11)
    expect(micro.lineHeight).toBe(14)
    expect(micro.weight).toBe(500)
    expect(micro.letterSpacing).toBe(0.4)
  })
})

// ---------------------------------------------------------------------------
// Motion curves (T-0005-215)
// ---------------------------------------------------------------------------
describe('MOTION', () => {
  it('motion-instant has duration 0', () => {
    expect(MOTION['motion-instant'].duration).toBe(0)
  })

  // T-0005-215: motion-snappy has duration: 150
  it('motion-snappy has duration 150', () => {
    expect(MOTION['motion-snappy'].duration).toBe(150)
  })

  it('motion-snappy has the correct easing curve', () => {
    expect(MOTION['motion-snappy'].easing).toBe('cubic-bezier(0.2, 0.8, 0.2, 1)')
  })

  it('motion-smooth has duration 280', () => {
    expect(MOTION['motion-smooth'].duration).toBe(280)
  })

  it('motion-smooth has the correct easing curve', () => {
    expect(MOTION['motion-smooth'].easing).toBe('cubic-bezier(0.4, 0.0, 0.2, 1)')
  })

  it('motion-springy has stiffness 180 and damping 18', () => {
    const springy = MOTION['motion-springy']
    expect(springy.stiffness).toBe(180)
    expect(springy.damping).toBe(18)
  })

  it('motion-springy has type "spring" (discriminant)', () => {
    expect(MOTION['motion-springy'].type).toBe('spring')
  })

  it('motion-snappy has type "timing" (discriminant)', () => {
    expect(MOTION['motion-snappy'].type).toBe('timing')
  })
})

// ---------------------------------------------------------------------------
// Elevation recipes
// ---------------------------------------------------------------------------
describe('ELEVATION', () => {
  it('elevation-flat has no shadows', () => {
    expect(ELEVATION['elevation-flat'].shadows).toHaveLength(0)
  })

  it('elevation-raised has exactly 2 shadow strings', () => {
    expect(ELEVATION['elevation-raised'].shadows).toHaveLength(2)
  })

  it('elevation-raised first shadow matches spec', () => {
    expect(ELEVATION['elevation-raised'].shadows[0]).toBe('0 1px 2px rgba(15, 18, 22, 0.06)')
  })

  it('elevation-raised second shadow matches spec', () => {
    expect(ELEVATION['elevation-raised'].shadows[1]).toBe('0 1px 1px rgba(15, 18, 22, 0.04)')
  })

  it('elevation-floating has exactly 2 shadow strings', () => {
    expect(ELEVATION['elevation-floating'].shadows).toHaveLength(2)
  })

  it('elevation-floating first shadow matches spec', () => {
    expect(ELEVATION['elevation-floating'].shadows[0]).toBe('0 8px 24px rgba(15, 18, 22, 0.10)')
  })

  it('elevation-floating second shadow matches spec', () => {
    expect(ELEVATION['elevation-floating'].shadows[1]).toBe('0 2px 6px rgba(15, 18, 22, 0.06)')
  })
})

// ---------------------------------------------------------------------------
// T-0005-218 (typecheck-only): tokens.ts does NOT export Stance or Palette.
// Verified at source level — the imports of this test file do not pull
// Stance/Palette from tokens.ts. The assertion here documents the intent
// and provides a runtime guard against accidental re-export.
// ---------------------------------------------------------------------------
describe('T-0005-218 — tokens.ts export surface', () => {
  it('tokens.ts module does not export Stance or Palette', async () => {
    // Dynamic import to inspect the module's export keys at runtime.
    const tokensModule = await import('./tokens.js')
    const exportedKeys = Object.keys(tokensModule)
    expect(exportedKeys).not.toContain('Stance')
    expect(exportedKeys).not.toContain('Palette')
    expect(exportedKeys).not.toContain('StanceSchema')
    expect(exportedKeys).not.toContain('PaletteSchema')
  })
})

// ---------------------------------------------------------------------------
// tintColor — V1 Phase 1 Step 3 (T-0009-068..073, T-0009-240)
// ---------------------------------------------------------------------------

describe('tintColor (T-0009-068..073, T-0009-240)', () => {
  // T-0009-068: focus palette indigo → correct rgba
  it('T-0009-068: tintColor("#4F46E5", 0.06) returns "rgba(79, 70, 229, 0.06)"', () => {
    expect(tintColor('#4F46E5', 0.06)).toBe('rgba(79, 70, 229, 0.06)')
  })

  // T-0009-069: black at full opacity
  it('T-0009-069: tintColor("#000000", 1) returns "rgba(0, 0, 0, 1)"', () => {
    expect(tintColor('#000000', 1)).toBe('rgba(0, 0, 0, 1)')
  })

  // T-0009-070: non-hex input throws
  it('T-0009-070: tintColor("not-a-hex", 0.5) throws', () => {
    expect(() => tintColor('not-a-hex', 0.5)).toThrow()
  })

  // T-0009-071: alpha < 0 throws
  it('T-0009-071: tintColor("#FF0000", -0.1) throws (alpha out of range)', () => {
    expect(() => tintColor('#FF0000', -0.1)).toThrow()
  })

  // T-0009-072: alpha > 1 throws
  it('T-0009-072: tintColor("#FF0000", 1.5) throws (alpha out of range)', () => {
    expect(() => tintColor('#FF0000', 1.5)).toThrow()
  })

  // T-0009-073: white at zero opacity (boundary)
  it('T-0009-073: tintColor("#FFFFFF", 0) returns "rgba(255, 255, 255, 0)"', () => {
    expect(tintColor('#FFFFFF', 0)).toBe('rgba(255, 255, 255, 0)')
  })

  // T-0009-240: short-hex rejection — "#FFF" (3-char), "#FFFF" (4-char), etc.
  it('T-0009-240: tintColor("#FFF", 0.5) throws (short hex)', () => {
    expect(() => tintColor('#FFF', 0.5)).toThrow()
  })

  it('T-0009-240: tintColor("#FFFF", 0.5) throws (4-char hex)', () => {
    expect(() => tintColor('#FFFF', 0.5)).toThrow()
  })

  it('T-0009-240: tintColor("#FFFFF", 0.5) throws (5-char hex)', () => {
    expect(() => tintColor('#FFFFF', 0.5)).toThrow()
  })

  it('T-0009-240: tintColor("#FFFFFFFF", 0.5) throws (8-char hex)', () => {
    expect(() => tintColor('#FFFFFFFF', 0.5)).toThrow()
  })

  it('accepts alpha at exactly 0 and 1 (boundaries)', () => {
    expect(() => tintColor('#4F46E5', 0)).not.toThrow()
    expect(() => tintColor('#4F46E5', 1)).not.toThrow()
  })

  it('returns correct rgba for red at 20% (TransactionRow use case)', () => {
    expect(tintColor('#FF0000', 0.2)).toBe('rgba(255, 0, 0, 0.2)')
  })
})
