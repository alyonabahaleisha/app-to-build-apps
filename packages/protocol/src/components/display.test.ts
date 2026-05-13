/**
 * Display component schema tests — T-0005-072..097, T-0005-098..125
 * V1 Phase 1 Step 3 additions: T-0009-074..075 (AvatarGroup), T-0009-079 (Callout)
 * V0 actions hotfix: T-0006-101..102 (Stat.valueBinding XOR)
 * Components: Stat, Badge, Chip, Avatar (4 display tier)
 * V1 additions: AvatarGroup, Callout (2 new)
 */
import {StatSchema, BadgeSchema, ChipSchema, AvatarSchema, AvatarGroupSchema, CalloutSchema} from './display.js'
import {STAT_FIXTURE, STAT_FIXTURE_WITH_BINDING, BADGE_FIXTURE, CHIP_FIXTURE, AVATAR_FIXTURE, TOAST_ACTION} from '../../test/fixtures.js'

// ---- Stat ----

describe('StatSchema', () => {
  it('parses minimal fixture', () => {
    expect(() => StatSchema.parse(STAT_FIXTURE)).not.toThrow()
  })

  it('fails when neither value nor valueBinding is provided', () => {
    const {value: _v, ...rest} = STAT_FIXTURE
    expect(() => StatSchema.parse(rest)).toThrow()
  })

  it('fails when both value and valueBinding are provided (XOR refine)', () => {
    expect(() =>
      StatSchema.parse({...STAT_FIXTURE, valueBinding: {kind: 'state', slot: 'count'}}),
    ).toThrow()
  })

  // T-0006-101 — Stat.valueBinding parses with all 3 binding kinds
  it('T-0006-101a: parses with valueBinding: {kind: "state", slot: "count"}', () => {
    expect(() => StatSchema.parse(STAT_FIXTURE_WITH_BINDING)).not.toThrow()
  })

  it('T-0006-101b: parses with valueBinding: {kind: "literal", value: 42}', () => {
    const {value: _v, ...rest} = STAT_FIXTURE
    expect(() =>
      StatSchema.parse({...rest, valueBinding: {kind: 'literal', value: 42}}),
    ).not.toThrow()
  })

  it('T-0006-101c: parses with valueBinding: {kind: "collectionField", ...}', () => {
    const {value: _v, ...rest} = STAT_FIXTURE
    expect(() =>
      StatSchema.parse({
        ...rest,
        valueBinding: {kind: 'collectionField', collectionId: 'workouts', field: 'reps'},
      }),
    ).not.toThrow()
  })

  // T-0006-102 — Stat XOR refine rejects both value and valueBinding
  it('T-0006-102: rejects both value and valueBinding present (XOR)', () => {
    expect(() =>
      StatSchema.parse({...STAT_FIXTURE, valueBinding: {kind: 'state', slot: 'count'}}),
    ).toThrow()
  })

  it('fails when label is missing', () => {
    const {label: _l, ...rest} = STAT_FIXTURE
    expect(() => StatSchema.parse(rest)).toThrow()
  })

  it('accepts optional delta and deltaTone', () => {
    expect(() =>
      StatSchema.parse({...STAT_FIXTURE, delta: '+12%', deltaTone: 'positive'}),
    ).not.toThrow()
  })

  it('rejects invalid deltaTone', () => {
    expect(() => StatSchema.parse({...STAT_FIXTURE, deltaTone: 'success'})).toThrow()
  })

  it('accepts align: start and center', () => {
    expect(() => StatSchema.parse({...STAT_FIXTURE, align: 'start'})).not.toThrow()
    expect(() => StatSchema.parse({...STAT_FIXTURE, align: 'center'})).not.toThrow()
  })

  it('rejects align: end (not in Stat align options)', () => {
    expect(() => StatSchema.parse({...STAT_FIXTURE, align: 'end'})).toThrow()
  })

  it('rejects extra props (.strict())', () => {
    expect(() => StatSchema.parse({...STAT_FIXTURE, unit: 'kg'})).toThrow()
  })
})

// ---- Badge ----

describe('BadgeSchema', () => {
  it('parses minimal fixture', () => {
    expect(() => BadgeSchema.parse(BADGE_FIXTURE)).not.toThrow()
  })

  it('fails when text is missing', () => {
    const {text: _t, ...rest} = BADGE_FIXTURE
    expect(() => BadgeSchema.parse(rest)).toThrow()
  })

  it('accepts all tone values', () => {
    for (const tone of ['neutral', 'accent', 'success', 'warning', 'danger']) {
      expect(() => BadgeSchema.parse({...BADGE_FIXTURE, tone})).not.toThrow()
    }
  })

  it('rejects invalid tone', () => {
    expect(() => BadgeSchema.parse({...BADGE_FIXTURE, tone: 'error'})).toThrow()
  })

  it('rejects extra props (.strict())', () => {
    expect(() => BadgeSchema.parse({...BADGE_FIXTURE, size: 'md'})).toThrow()
  })
})

// ---- Chip ----

describe('ChipSchema', () => {
  it('parses minimal fixture', () => {
    expect(() => ChipSchema.parse(CHIP_FIXTURE)).not.toThrow()
  })

  it('fails when text is missing', () => {
    const {text: _t, ...rest} = CHIP_FIXTURE
    expect(() => ChipSchema.parse(rest)).toThrow()
  })

  it('accepts selected and icon', () => {
    expect(() =>
      ChipSchema.parse({...CHIP_FIXTURE, selected: true, icon: 'star'}),
    ).not.toThrow()
  })

  it('accepts optional action', () => {
    expect(() => ChipSchema.parse({...CHIP_FIXTURE, action: TOAST_ACTION})).not.toThrow()
  })

  it('rejects extra props (.strict())', () => {
    expect(() => ChipSchema.parse({...CHIP_FIXTURE, variant: 'filter'})).toThrow()
  })
})

// ---- Avatar ----

describe('AvatarSchema', () => {
  it('parses minimal fixture', () => {
    expect(() => AvatarSchema.parse(AVATAR_FIXTURE)).not.toThrow()
  })

  it('fails when name is missing', () => {
    const {name: _n, ...rest} = AVATAR_FIXTURE
    expect(() => AvatarSchema.parse(rest)).toThrow()
  })

  it('accepts optional imageUrl', () => {
    expect(() =>
      AvatarSchema.parse({...AVATAR_FIXTURE, imageUrl: 'https://example.com/photo.jpg'}),
    ).not.toThrow()
  })

  it('accepts all size values', () => {
    for (const size of ['sm', 'md', 'lg']) {
      expect(() => AvatarSchema.parse({...AVATAR_FIXTURE, size})).not.toThrow()
    }
  })

  it('rejects invalid size', () => {
    expect(() => AvatarSchema.parse({...AVATAR_FIXTURE, size: 'xl'})).toThrow()
  })

  it('rejects extra props (.strict())', () => {
    expect(() => AvatarSchema.parse({...AVATAR_FIXTURE, shape: 'square'})).toThrow()
  })
})

// ---------------------------------------------------------------------------
// AvatarGroup — V1 Phase 1 Step 3 (T-0009-074..075)
// ---------------------------------------------------------------------------

describe('AvatarGroupSchema (T-0009-074..075)', () => {
  const VALID_AVATAR_GROUP = {
    id: 'ag1',
    type: 'AvatarGroup' as const,
    avatars: [{name: 'Alex'}, {name: 'Sam'}, {name: 'Jordan'}],
  }

  // T-0009-074: happy path
  it('T-0009-074: parses with required props (avatars)', () => {
    expect(() => AvatarGroupSchema.parse(VALID_AVATAR_GROUP)).not.toThrow()
  })

  // T-0009-075: 6 avatars rejects (max 5)
  it('T-0009-075: rejects 6 avatars (max 5)', () => {
    const tooMany = [
      {name: 'A'}, {name: 'B'}, {name: 'C'},
      {name: 'D'}, {name: 'E'}, {name: 'F'},
    ]
    expect(() => AvatarGroupSchema.parse({...VALID_AVATAR_GROUP, avatars: tooMany})).toThrow()
  })

  it('accepts exactly 5 avatars', () => {
    const five = [{name: 'A'}, {name: 'B'}, {name: 'C'}, {name: 'D'}, {name: 'E'}]
    expect(() => AvatarGroupSchema.parse({...VALID_AVATAR_GROUP, avatars: five})).not.toThrow()
  })

  it('rejects empty avatars array (min 1)', () => {
    expect(() => AvatarGroupSchema.parse({...VALID_AVATAR_GROUP, avatars: []})).toThrow()
  })

  it('accepts all size values', () => {
    for (const size of ['sm', 'md', 'lg'] as const) {
      expect(() => AvatarGroupSchema.parse({...VALID_AVATAR_GROUP, size})).not.toThrow()
    }
  })

  it('accepts all overlap values', () => {
    for (const overlap of ['tight', 'spread'] as const) {
      expect(() => AvatarGroupSchema.parse({...VALID_AVATAR_GROUP, overlap})).not.toThrow()
    }
  })

  it('accepts optional maxShown in range [1,5]', () => {
    for (const maxShown of [1, 2, 3, 4, 5]) {
      expect(() => AvatarGroupSchema.parse({...VALID_AVATAR_GROUP, maxShown})).not.toThrow()
    }
  })

  it('rejects maxShown: 0 (min 1)', () => {
    expect(() => AvatarGroupSchema.parse({...VALID_AVATAR_GROUP, maxShown: 0})).toThrow()
  })

  it('rejects maxShown: 6 (max 5)', () => {
    expect(() => AvatarGroupSchema.parse({...VALID_AVATAR_GROUP, maxShown: 6})).toThrow()
  })

  it('rejects extra props (.strict())', () => {
    expect(() => AvatarGroupSchema.parse({...VALID_AVATAR_GROUP, gap: 'space-sm'})).toThrow()
  })
})

// ---------------------------------------------------------------------------
// Callout — V1 Phase 1 Step 3 (T-0009-079)
// ---------------------------------------------------------------------------

describe('CalloutSchema (T-0009-079)', () => {
  const VALID_CALLOUT = {
    id: 'cal1',
    type: 'Callout' as const,
    headline: 'Welcome to the app',
  }

  // T-0009-079: happy path
  it('T-0009-079: parses with required props (headline)', () => {
    expect(() => CalloutSchema.parse(VALID_CALLOUT)).not.toThrow()
  })

  it('variant is optional (undefined when omitted — renderer defaults to "info")', () => {
    // variant is optional in the schema; the renderer handles the default via ?? 'info'.
    // Using .optional() instead of .default('info') keeps the ZodType<Node> annotation valid.
    const result = CalloutSchema.parse(VALID_CALLOUT)
    expect(result.variant).toBeUndefined()
  })

  it('accepts all 5 variant values', () => {
    for (const variant of ['info', 'success', 'warning', 'tip', 'danger'] as const) {
      expect(() => CalloutSchema.parse({...VALID_CALLOUT, variant})).not.toThrow()
    }
  })

  it('rejects invalid variant', () => {
    expect(() => CalloutSchema.parse({...VALID_CALLOUT, variant: 'error'})).toThrow()
  })

  it('accepts optional body', () => {
    expect(() => CalloutSchema.parse({...VALID_CALLOUT, body: 'Supporting text'})).not.toThrow()
  })

  it('rejects body > 400 chars', () => {
    expect(() =>
      CalloutSchema.parse({...VALID_CALLOUT, body: 'x'.repeat(401)}),
    ).toThrow()
  })

  it('rejects headline > 200 chars', () => {
    expect(() =>
      CalloutSchema.parse({...VALID_CALLOUT, headline: 'x'.repeat(201)}),
    ).toThrow()
  })

  it('rejects empty headline (min 1)', () => {
    expect(() => CalloutSchema.parse({...VALID_CALLOUT, headline: ''})).toThrow()
  })

  it('accepts optional icon (from IconNameSchema)', () => {
    expect(() => CalloutSchema.parse({...VALID_CALLOUT, icon: 'info'})).not.toThrow()
  })

  it('rejects invalid icon name', () => {
    expect(() => CalloutSchema.parse({...VALID_CALLOUT, icon: 'rainbow'})).toThrow()
  })

  it('accepts optional action with label and action verb', () => {
    expect(() =>
      CalloutSchema.parse({
        ...VALID_CALLOUT,
        action: {label: 'Learn more', action: TOAST_ACTION},
      }),
    ).not.toThrow()
  })

  it('rejects action with empty label', () => {
    expect(() =>
      CalloutSchema.parse({
        ...VALID_CALLOUT,
        action: {label: '', action: TOAST_ACTION},
      }),
    ).toThrow()
  })

  it('rejects action label > 40 chars', () => {
    expect(() =>
      CalloutSchema.parse({
        ...VALID_CALLOUT,
        action: {label: 'x'.repeat(41), action: TOAST_ACTION},
      }),
    ).toThrow()
  })

  it('rejects extra props (.strict())', () => {
    expect(() => CalloutSchema.parse({...VALID_CALLOUT, color: 'red'})).toThrow()
  })
})
