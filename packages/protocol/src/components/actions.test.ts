/**
 * Actions component schema tests — T-0005-072..097, T-0005-098..125,
 * T-0005-126..128 (F-2 Button regression), T-0005-140 (legacy M1 types)
 * Components: Button, FAB (2 actions tier)
 *
 * NOTE: This is packages/protocol/src/components/actions.test.ts — it tests
 * the *component* schemas Button and FAB, not the action verb schemas in
 * packages/protocol/src/actions.test.ts (which tests set/update/navigate etc.).
 */
import {ButtonSchema, FabSchema} from './actions.js'
import {BUTTON_FIXTURE, FAB_FIXTURE, BOOLEAN_BINDING_LITERAL} from '../../test/fixtures.js'

// ---- Button ----

describe('ButtonSchema', () => {
  it('parses minimal fixture (T-0005-072 parameterized)', () => {
    expect(() => ButtonSchema.parse(BUTTON_FIXTURE)).not.toThrow()
  })

  it('fails when label is missing (T-0005-098 parameterized)', () => {
    const {label: _l, ...rest} = BUTTON_FIXTURE
    expect(() => ButtonSchema.parse(rest)).toThrow()
  })

  it('fails when action is missing', () => {
    const {action: _a, ...rest} = BUTTON_FIXTURE
    expect(() => ButtonSchema.parse(rest)).toThrow()
  })

  it('accepts all variant values', () => {
    for (const variant of ['primary', 'secondary', 'destructive', 'text']) {
      expect(() => ButtonSchema.parse({...BUTTON_FIXTURE, variant})).not.toThrow()
    }
  })

  it('rejects invalid variant', () => {
    expect(() => ButtonSchema.parse({...BUTTON_FIXTURE, variant: 'ghost'})).toThrow()
  })

  it('accepts all size values', () => {
    for (const size of ['sm', 'md', 'lg']) {
      expect(() => ButtonSchema.parse({...BUTTON_FIXTURE, size})).not.toThrow()
    }
  })

  it('accepts optional icon and iconPosition', () => {
    expect(() =>
      ButtonSchema.parse({...BUTTON_FIXTURE, icon: 'plus', iconPosition: 'leading'}),
    ).not.toThrow()
  })

  it('accepts fullWidth: true', () => {
    expect(() => ButtonSchema.parse({...BUTTON_FIXTURE, fullWidth: true})).not.toThrow()
  })

  // T-0005-126: Button has NO loading prop — .strict() rejects it (F-2 closure)
  it('rejects loading: true — loading is not in ButtonSchema (T-0005-126)', () => {
    expect(() => ButtonSchema.parse({...BUTTON_FIXTURE, loading: true})).toThrow()
  })

  // T-0005-127: disabled as BooleanBinding succeeds
  it('accepts disabled as BooleanBinding (T-0005-127)', () => {
    expect(() =>
      ButtonSchema.parse({...BUTTON_FIXTURE, disabled: BOOLEAN_BINDING_LITERAL}),
    ).not.toThrow()
  })

  // T-0005-128: disabled as plain boolean fails — requires Binding
  it('rejects disabled: true (plain boolean) — BooleanBinding required (T-0005-128)', () => {
    expect(() => ButtonSchema.parse({...BUTTON_FIXTURE, disabled: true})).toThrow()
  })

  it('rejects disabled: false (plain boolean)', () => {
    expect(() => ButtonSchema.parse({...BUTTON_FIXTURE, disabled: false})).toThrow()
  })

  it('rejects extra props (.strict())', () => {
    expect(() => ButtonSchema.parse({...BUTTON_FIXTURE, onPress: () => {}})).toThrow()
  })
})

// ---- FAB ----

describe('FabSchema', () => {
  it('parses minimal fixture', () => {
    expect(() => FabSchema.parse(FAB_FIXTURE)).not.toThrow()
  })

  it('fails when icon is missing', () => {
    const {icon: _i, ...rest} = FAB_FIXTURE
    expect(() => FabSchema.parse(rest)).toThrow()
  })

  it('fails when action is missing', () => {
    const {action: _a, ...rest} = FAB_FIXTURE
    expect(() => FabSchema.parse(rest)).toThrow()
  })

  it('fails when accessibilityLabel is missing (required — no default)', () => {
    const {accessibilityLabel: _a, ...rest} = FAB_FIXTURE
    expect(() => FabSchema.parse(rest)).toThrow()
  })

  it('fails when accessibilityLabel is empty string (min 1)', () => {
    expect(() => FabSchema.parse({...FAB_FIXTURE, accessibilityLabel: ''})).toThrow()
  })

  it('accepts any valid icon name', () => {
    expect(() => FabSchema.parse({...FAB_FIXTURE, icon: 'camera'})).not.toThrow()
  })

  it('rejects empty icon name', () => {
    expect(() => FabSchema.parse({...FAB_FIXTURE, icon: ''})).toThrow()
  })

  it('rejects extra props (.strict())', () => {
    expect(() => FabSchema.parse({...FAB_FIXTURE, loading: false})).toThrow()
  })
})

// ---- T-0005-141: MAX_NESTING_DEPTH constant ----

describe('MAX_NESTING_DEPTH export', () => {
  it('MAX_NESTING_DEPTH equals 8 (T-0005-141)', async () => {
    const {MAX_NESTING_DEPTH} = await import('./index.js')
    expect(MAX_NESTING_DEPTH).toBe(8)
  })
})

// ---- T-0005-140: Legacy M1 component type rejection ----

describe('Legacy M1 component type rejection in actions tier (T-0005-140)', () => {
  const legacyTypes = ['Counter', 'Toggle', 'TextInput', 'Form', 'Container']

  test.each(legacyTypes)('%s is not a valid Button type', legacyType => {
    expect(() => ButtonSchema.parse({...BUTTON_FIXTURE, type: legacyType})).toThrow()
  })

  test.each(legacyTypes)('%s is not a valid FAB type', legacyType => {
    expect(() => FabSchema.parse({...FAB_FIXTURE, type: legacyType})).toThrow()
  })
})
