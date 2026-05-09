/**
 * Inputs component schema tests — T-0005-072a..072r (F-09), T-0005-072..097,
 * T-0005-098..125, T-0005-138..139
 *
 * F-09 parameterized: every input component × all 3 binding kinds (18 tests)
 * Components: TextField, NumberField, DateField, Picker, Switch (5 inputs tier)
 */
import {
  TextFieldSchema,
  NumberFieldSchema,
  DateFieldSchema,
  PickerSchema,
  SwitchSchema,
} from './inputs.js'
import {
  TEXT_FIELD_FIXTURE,
  NUMBER_FIELD_FIXTURE,
  DATE_FIELD_FIXTURE,
  PICKER_FIXTURE,
  SWITCH_FIXTURE,
  STRING_BINDING_LITERAL,
  STRING_BINDING_STATE,
  STRING_BINDING_COLLECTION,
  NUMBER_BINDING_LITERAL,
  NUMBER_BINDING_STATE,
  NUMBER_BINDING_COLLECTION,
  BOOLEAN_BINDING_LITERAL,
  BOOLEAN_BINDING_STATE,
  BOOLEAN_BINDING_COLLECTION,
  DATE_BINDING_LITERAL,
  DATE_BINDING_STATE,
  DATE_BINDING_COLLECTION,
} from '../../test/fixtures.js'

// ---- T-0005-072a..072r: F-09 parameterized binding-kind tests ----
// Every input component (TextField, NumberField, DateField, Picker, Switch,
// ImagePicker) × all 3 binding kinds (literal, state, collectionField) = 18 tests.
// (ImagePicker is in compound.test.ts to keep files focused by tier.)

describe('F-09: input components × all 3 binding kinds (T-0005-072a..072r)', () => {
  // TextField × 3 (T-0005-072a, 072b, 072c per ADR note)
  test.each([
    ['literal', STRING_BINDING_LITERAL],
    ['state', STRING_BINDING_STATE],
    ['collectionField', STRING_BINDING_COLLECTION],
  ])('TextField with %s binding parses', (_kind, valueBinding) => {
    expect(() => TextFieldSchema.parse({...TEXT_FIELD_FIXTURE, valueBinding})).not.toThrow()
  })

  // NumberField × 3
  test.each([
    ['literal', NUMBER_BINDING_LITERAL],
    ['state', NUMBER_BINDING_STATE],
    ['collectionField', NUMBER_BINDING_COLLECTION],
  ])('NumberField with %s binding parses', (_kind, valueBinding) => {
    expect(() => NumberFieldSchema.parse({...NUMBER_FIELD_FIXTURE, valueBinding})).not.toThrow()
  })

  // DateField × 3
  test.each([
    ['literal', DATE_BINDING_LITERAL],
    ['state', DATE_BINDING_STATE],
    ['collectionField', DATE_BINDING_COLLECTION],
  ])('DateField with %s binding parses', (_kind, valueBinding) => {
    expect(() => DateFieldSchema.parse({...DATE_FIELD_FIXTURE, valueBinding})).not.toThrow()
  })

  // Picker × 3 (uses StringBinding per F-9)
  test.each([
    ['literal', STRING_BINDING_LITERAL],
    ['state', STRING_BINDING_STATE],
    ['collectionField', STRING_BINDING_COLLECTION],
  ])('Picker with %s binding parses', (_kind, valueBinding) => {
    expect(() => PickerSchema.parse({...PICKER_FIXTURE, valueBinding})).not.toThrow()
  })

  // Switch × 3
  test.each([
    ['literal', BOOLEAN_BINDING_LITERAL],
    ['state', BOOLEAN_BINDING_STATE],
    ['collectionField', BOOLEAN_BINDING_COLLECTION],
  ])('Switch with %s binding parses', (_kind, valueBinding) => {
    expect(() => SwitchSchema.parse({...SWITCH_FIXTURE, valueBinding})).not.toThrow()
  })
})

// ---- TextField ----

describe('TextFieldSchema', () => {
  it('parses minimal fixture', () => {
    expect(() => TextFieldSchema.parse(TEXT_FIELD_FIXTURE)).not.toThrow()
  })

  it('fails when label is missing', () => {
    const {label: _l, ...rest} = TEXT_FIELD_FIXTURE
    expect(() => TextFieldSchema.parse(rest)).toThrow()
  })

  it('fails when valueBinding is missing', () => {
    const {valueBinding: _v, ...rest} = TEXT_FIELD_FIXTURE
    expect(() => TextFieldSchema.parse(rest)).toThrow()
  })

  it('accepts all keyboardType values', () => {
    for (const keyboardType of ['default', 'email-address', 'url']) {
      expect(() => TextFieldSchema.parse({...TEXT_FIELD_FIXTURE, keyboardType})).not.toThrow()
    }
  })

  it('rejects unknown keyboardType', () => {
    expect(() => TextFieldSchema.parse({...TEXT_FIELD_FIXTURE, keyboardType: 'numeric'})).toThrow()
  })

  // T-0005-138: maxLength: 0 fails (positive integer required)
  it('rejects maxLength: 0 (T-0005-138)', () => {
    expect(() => TextFieldSchema.parse({...TEXT_FIELD_FIXTURE, maxLength: 0})).toThrow()
  })

  // T-0005-139: maxLength: 2001 fails (max 2000)
  it('rejects maxLength: 2001 (T-0005-139)', () => {
    expect(() => TextFieldSchema.parse({...TEXT_FIELD_FIXTURE, maxLength: 2001})).toThrow()
  })

  it('accepts maxLength: 2000 (boundary)', () => {
    expect(() => TextFieldSchema.parse({...TEXT_FIELD_FIXTURE, maxLength: 2000})).not.toThrow()
  })

  it('rejects extra props (.strict())', () => {
    expect(() => TextFieldSchema.parse({...TEXT_FIELD_FIXTURE, value: 'hello'})).toThrow()
  })

  it('rejects a plain string as valueBinding (binding required)', () => {
    expect(() => TextFieldSchema.parse({...TEXT_FIELD_FIXTURE, valueBinding: 'hello'})).toThrow()
  })
})

// ---- NumberField ----

describe('NumberFieldSchema', () => {
  it('parses minimal fixture', () => {
    expect(() => NumberFieldSchema.parse(NUMBER_FIELD_FIXTURE)).not.toThrow()
  })

  it('fails when label is missing', () => {
    const {label: _l, ...rest} = NUMBER_FIELD_FIXTURE
    expect(() => NumberFieldSchema.parse(rest)).toThrow()
  })

  it('fails when valueBinding is missing', () => {
    const {valueBinding: _v, ...rest} = NUMBER_FIELD_FIXTURE
    expect(() => NumberFieldSchema.parse(rest)).toThrow()
  })

  it('accepts min, max, step', () => {
    expect(() =>
      NumberFieldSchema.parse({...NUMBER_FIELD_FIXTURE, min: 0, max: 100, step: 5}),
    ).not.toThrow()
  })

  it('rejects step: 0 (positive required)', () => {
    expect(() => NumberFieldSchema.parse({...NUMBER_FIELD_FIXTURE, step: 0})).toThrow()
  })

  it('rejects extra props (.strict())', () => {
    expect(() =>
      NumberFieldSchema.parse({...NUMBER_FIELD_FIXTURE, keyboardType: 'numeric'}),
    ).toThrow()
  })

  it('rejects a plain number as valueBinding', () => {
    expect(() => NumberFieldSchema.parse({...NUMBER_FIELD_FIXTURE, valueBinding: 42})).toThrow()
  })
})

// ---- DateField ----

describe('DateFieldSchema', () => {
  it('parses minimal fixture', () => {
    expect(() => DateFieldSchema.parse(DATE_FIELD_FIXTURE)).not.toThrow()
  })

  it('fails when label is missing', () => {
    const {label: _l, ...rest} = DATE_FIELD_FIXTURE
    expect(() => DateFieldSchema.parse(rest)).toThrow()
  })

  it('fails when valueBinding is missing', () => {
    const {valueBinding: _v, ...rest} = DATE_FIELD_FIXTURE
    expect(() => DateFieldSchema.parse(rest)).toThrow()
  })

  it('accepts all mode values', () => {
    for (const mode of ['date', 'time', 'datetime']) {
      expect(() => DateFieldSchema.parse({...DATE_FIELD_FIXTURE, mode})).not.toThrow()
    }
  })

  it('rejects invalid mode', () => {
    expect(() => DateFieldSchema.parse({...DATE_FIELD_FIXTURE, mode: 'year'})).toThrow()
  })

  it('rejects extra props (.strict())', () => {
    expect(() => DateFieldSchema.parse({...DATE_FIELD_FIXTURE, format: 'ISO'})).toThrow()
  })
})

// ---- Picker ----

describe('PickerSchema', () => {
  it('parses minimal fixture', () => {
    expect(() => PickerSchema.parse(PICKER_FIXTURE)).not.toThrow()
  })

  it('fails when options is missing', () => {
    const {options: _o, ...rest} = PICKER_FIXTURE
    expect(() => PickerSchema.parse(rest)).toThrow()
  })

  it('fails when label is missing', () => {
    const {label: _l, ...rest} = PICKER_FIXTURE
    expect(() => PickerSchema.parse(rest)).toThrow()
  })

  // T-0005-136: Picker.options max 12 elements
  it('accepts options array with 12 elements (T-0005-136)', () => {
    const options = Array.from({length: 12}, (_, i) => ({value: `v${i}`, label: `L${i}`}))
    expect(() => PickerSchema.parse({...PICKER_FIXTURE, options})).not.toThrow()
  })

  it('rejects options array with 13 elements (T-0005-136)', () => {
    const options = Array.from({length: 13}, (_, i) => ({value: `v${i}`, label: `L${i}`}))
    expect(() => PickerSchema.parse({...PICKER_FIXTURE, options})).toThrow()
  })

  it('rejects empty options array (min 1)', () => {
    expect(() => PickerSchema.parse({...PICKER_FIXTURE, options: []})).toThrow()
  })

  it('rejects extra props (.strict())', () => {
    expect(() => PickerSchema.parse({...PICKER_FIXTURE, multiple: true})).toThrow()
  })
})

// ---- Switch ----

describe('SwitchSchema', () => {
  it('parses minimal fixture', () => {
    expect(() => SwitchSchema.parse(SWITCH_FIXTURE)).not.toThrow()
  })

  it('fails when label is missing', () => {
    const {label: _l, ...rest} = SWITCH_FIXTURE
    expect(() => SwitchSchema.parse(rest)).toThrow()
  })

  it('fails when valueBinding is missing', () => {
    const {valueBinding: _v, ...rest} = SWITCH_FIXTURE
    expect(() => SwitchSchema.parse(rest)).toThrow()
  })

  it('rejects a plain boolean as valueBinding', () => {
    expect(() => SwitchSchema.parse({...SWITCH_FIXTURE, valueBinding: true})).toThrow()
  })

  it('rejects extra props (.strict())', () => {
    expect(() => SwitchSchema.parse({...SWITCH_FIXTURE, trackColor: 'red'})).toThrow()
  })
})
