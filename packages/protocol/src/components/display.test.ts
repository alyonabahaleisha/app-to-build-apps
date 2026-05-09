/**
 * Display component schema tests — T-0005-072..097, T-0005-098..125
 * Components: Stat, Badge, Chip, Avatar (4 display tier)
 */
import {StatSchema, BadgeSchema, ChipSchema, AvatarSchema} from './display.js'
import {STAT_FIXTURE, BADGE_FIXTURE, CHIP_FIXTURE, AVATAR_FIXTURE, TOAST_ACTION} from '../../test/fixtures.js'

// ---- Stat ----

describe('StatSchema', () => {
  it('parses minimal fixture', () => {
    expect(() => StatSchema.parse(STAT_FIXTURE)).not.toThrow()
  })

  it('fails when value is missing', () => {
    const {value: _v, ...rest} = STAT_FIXTURE
    expect(() => StatSchema.parse(rest)).toThrow()
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
