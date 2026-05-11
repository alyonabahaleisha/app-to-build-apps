/**
 * Layout component schema tests — T-0005-070..071 + parameterized T-0005-072..098
 * V1 Phase 1 Step 1 additions: T-0009-001..005, T-0009-243 (Divider)
 * Components: Screen, Section, Stack, Row, Card (5 layout tier)
 * V1 additions: Divider (1 new)
 */
import {ScreenSchema, SectionSchema, StackSchema, RowSchema, CardSchema, DividerSchema} from './layout.js'
import {
  SCREEN_FIXTURE,
  SECTION_FIXTURE,
  STACK_FIXTURE,
  ROW_FIXTURE,
  CARD_FIXTURE,
} from '../../test/fixtures.js'

// ---- Screen ----

describe('ScreenSchema', () => {
  // T-0005-070
  it('parses with required props', () => {
    const result = ScreenSchema.parse({
      id: 's1',
      type: 'Screen',
      padding: 'space-lg',
      safeArea: 'both',
      children: [],
    })
    expect(result.type).toBe('Screen')
    expect(result.id).toBe('s1')
  })

  // T-0005-071
  it('fails when children is missing', () => {
    expect(() => ScreenSchema.parse({id: 's1', type: 'Screen'})).toThrow()
  })

  it('parses minimal fixture (T-0005-072 parameterized)', () => {
    expect(() => ScreenSchema.parse(SCREEN_FIXTURE)).not.toThrow()
  })

  it('fails when type is wrong', () => {
    expect(() => ScreenSchema.parse({...SCREEN_FIXTURE, type: 'Container'})).toThrow()
  })

  it('fails when id is missing (T-0005-098 parameterized)', () => {
    const {id: _id, ...rest} = SCREEN_FIXTURE
    expect(() => ScreenSchema.parse(rest)).toThrow()
  })

  it('fails with extra props due to .strict()', () => {
    expect(() => ScreenSchema.parse({...SCREEN_FIXTURE, unknownProp: true})).toThrow()
  })

  it('accepts all valid safeArea values', () => {
    for (const v of ['top', 'bottom', 'both', 'none']) {
      expect(() => ScreenSchema.parse({...SCREEN_FIXTURE, safeArea: v})).not.toThrow()
    }
  })

  it('rejects invalid safeArea', () => {
    expect(() => ScreenSchema.parse({...SCREEN_FIXTURE, safeArea: 'left'})).toThrow()
  })

  it('accepts valid padding space token', () => {
    expect(() => ScreenSchema.parse({...SCREEN_FIXTURE, padding: 'space-lg'})).not.toThrow()
  })

  it('rejects invalid padding value', () => {
    expect(() => ScreenSchema.parse({...SCREEN_FIXTURE, padding: '20px'})).toThrow()
  })
})

// ---- Section ----

describe('SectionSchema', () => {
  it('parses minimal fixture', () => {
    expect(() => SectionSchema.parse(SECTION_FIXTURE)).not.toThrow()
  })

  it('parses with optional title and caption', () => {
    expect(() =>
      SectionSchema.parse({...SECTION_FIXTURE, title: 'My Section', caption: 'Details'}),
    ).not.toThrow()
  })

  it('fails when children is missing', () => {
    const {children: _c, ...rest} = SECTION_FIXTURE
    expect(() => SectionSchema.parse(rest)).toThrow()
  })

  it('fails with extra props (.strict())', () => {
    expect(() => SectionSchema.parse({...SECTION_FIXTURE, bg: 'accent'})).toThrow()
  })

  it('fails when id is missing', () => {
    const {id: _id, ...rest} = SECTION_FIXTURE
    expect(() => SectionSchema.parse(rest)).toThrow()
  })
})

// ---- Stack ----

describe('StackSchema', () => {
  it('parses minimal fixture', () => {
    expect(() => StackSchema.parse(STACK_FIXTURE)).not.toThrow()
  })

  it('accepts valid gap token', () => {
    expect(() => StackSchema.parse({...STACK_FIXTURE, gap: 'space-md'})).not.toThrow()
  })

  it('accepts valid align values', () => {
    for (const v of ['start', 'center', 'end', 'stretch']) {
      expect(() => StackSchema.parse({...STACK_FIXTURE, align: v})).not.toThrow()
    }
  })

  it('fails when children is missing', () => {
    const {children: _c, ...rest} = STACK_FIXTURE
    expect(() => StackSchema.parse(rest)).toThrow()
  })

  it('fails with unknown align', () => {
    expect(() => StackSchema.parse({...STACK_FIXTURE, align: 'baseline'})).toThrow()
  })

  it('fails with extra props (.strict())', () => {
    expect(() => StackSchema.parse({...STACK_FIXTURE, direction: 'column'})).toThrow()
  })
})

// ---- Row ----

describe('RowSchema', () => {
  it('parses minimal fixture', () => {
    expect(() => RowSchema.parse(ROW_FIXTURE)).not.toThrow()
  })

  it('accepts all justify values', () => {
    for (const v of ['start', 'center', 'end', 'space-between', 'space-around']) {
      expect(() => RowSchema.parse({...ROW_FIXTURE, justify: v})).not.toThrow()
    }
  })

  it('accepts wrap: true', () => {
    expect(() => RowSchema.parse({...ROW_FIXTURE, wrap: true})).not.toThrow()
  })

  it('fails when children is missing', () => {
    const {children: _c, ...rest} = ROW_FIXTURE
    expect(() => RowSchema.parse(rest)).toThrow()
  })

  it('fails with invalid align', () => {
    // Row does not support 'stretch' in its align enum (only start/center/end)
    expect(() => RowSchema.parse({...ROW_FIXTURE, align: 'stretch'})).toThrow()
  })

  it('fails with extra props (.strict())', () => {
    expect(() => RowSchema.parse({...ROW_FIXTURE, flex: 1})).toThrow()
  })
})

// ---- Card ----

describe('CardSchema', () => {
  it('parses minimal fixture', () => {
    expect(() => CardSchema.parse(CARD_FIXTURE)).not.toThrow()
  })

  it('accepts all elevation values', () => {
    for (const v of ['flat', 'raised', 'floating']) {
      expect(() => CardSchema.parse({...CARD_FIXTURE, elevation: v})).not.toThrow()
    }
  })

  it('accepts all radius token values', () => {
    for (const v of ['radius-none', 'radius-sm', 'radius-md', 'radius-lg', 'radius-full']) {
      expect(() => CardSchema.parse({...CARD_FIXTURE, radius: v})).not.toThrow()
    }
  })

  it('fails when children is missing', () => {
    const {children: _c, ...rest} = CARD_FIXTURE
    expect(() => CardSchema.parse(rest)).toThrow()
  })

  it('fails with invalid elevation', () => {
    expect(() => CardSchema.parse({...CARD_FIXTURE, elevation: 'shadow-xl'})).toThrow()
  })

  it('fails with extra props (.strict())', () => {
    expect(() => CardSchema.parse({...CARD_FIXTURE, shadow: true})).toThrow()
  })
})

// ---------------------------------------------------------------------------
// Divider — V1 Phase 1 Step 1 (T-0009-001..005, T-0009-243)
// ---------------------------------------------------------------------------

describe('DividerSchema (T-0009-001..005)', () => {
  // T-0009-001: minimal parse — no optional props
  it('T-0009-001: parses with no optional props', () => {
    expect(() =>
      DividerSchema.parse({id: 'div1', type: 'Divider'}),
    ).not.toThrow()
  })

  // T-0009-002: parses with all optional props
  it('T-0009-002: parses with label, inset, weight', () => {
    expect(() =>
      DividerSchema.parse({
        id: 'div2',
        type: 'Divider',
        label: 'Today',
        inset: 'start',
        weight: 'thick',
      }),
    ).not.toThrow()
  })

  // T-0009-003: label > 40 chars rejects
  it('T-0009-003: rejects label > 40 chars', () => {
    expect(() =>
      DividerSchema.parse({id: 'div3', type: 'Divider', label: 'x'.repeat(41)}),
    ).toThrow()
  })

  // T-0009-004: invalid inset value rejects
  it('T-0009-004: rejects invalid inset "middle"', () => {
    expect(() =>
      DividerSchema.parse({id: 'div4', type: 'Divider', inset: 'middle'}),
    ).toThrow()
  })

  // T-0009-005: label at exactly 40 chars succeeds
  it('T-0009-005: accepts label at exactly 40 chars (boundary)', () => {
    expect(() =>
      DividerSchema.parse({id: 'div5', type: 'Divider', label: 'x'.repeat(40)}),
    ).not.toThrow()
  })

  // T-0009-243: no label → accessibilityLabel auto; label → accessibilityLabel set
  // Schema-level: accessibilityLabel is optional; renderer enforces the role behavior.
  it('T-0009-243: parses without accessibilityLabel (renderer sets role per label presence)', () => {
    // No label, no accessibilityLabel — valid schema
    expect(() =>
      DividerSchema.parse({id: 'div6', type: 'Divider'}),
    ).not.toThrow()
    // With label — also valid schema
    expect(() =>
      DividerSchema.parse({id: 'div7', type: 'Divider', label: 'Or', accessibilityLabel: 'Or'}),
    ).not.toThrow()
  })

  it('accepts all valid inset values', () => {
    for (const inset of ['none', 'start', 'both'] as const) {
      expect(() =>
        DividerSchema.parse({id: 'd1', type: 'Divider', inset}),
      ).not.toThrow()
    }
  })

  it('accepts all valid weight values', () => {
    for (const weight of ['hairline', 'thick'] as const) {
      expect(() =>
        DividerSchema.parse({id: 'd2', type: 'Divider', weight}),
      ).not.toThrow()
    }
  })

  it('rejects extra props (.strict())', () => {
    expect(() =>
      DividerSchema.parse({id: 'd3', type: 'Divider', color: 'red'}),
    ).toThrow()
  })
})

// ---- T-0005-137: component id max 64 chars (boundary, applies to all) ----

describe('Component id regex boundary (T-0005-137)', () => {
  it('accepts id at exactly 64 chars', () => {
    // 'a' + 63 more lowercase letters = 64 chars
    const longId = 'a' + 'b'.repeat(63)
    expect(() => ScreenSchema.parse({...SCREEN_FIXTURE, id: longId})).not.toThrow()
  })

  it('rejects id at 65 chars', () => {
    // 'a' + 64 = 65 chars
    const tooLong = 'a' + 'b'.repeat(64)
    expect(() => ScreenSchema.parse({...SCREEN_FIXTURE, id: tooLong})).toThrow()
  })

  it('rejects id starting with uppercase', () => {
    expect(() => ScreenSchema.parse({...SCREEN_FIXTURE, id: 'MyScreen'})).toThrow()
  })

  it('rejects id starting with digit', () => {
    expect(() => ScreenSchema.parse({...SCREEN_FIXTURE, id: '1screen'})).toThrow()
  })

  it('rejects id starting with underscore', () => {
    expect(() => ScreenSchema.parse({...SCREEN_FIXTURE, id: '_screen'})).toThrow()
  })
})
