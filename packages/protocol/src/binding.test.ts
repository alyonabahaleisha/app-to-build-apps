import {
  SlotNameSchema,
  BindingValueSchema,
  StringBindingSchema,
  NumberBindingSchema,
  BooleanBindingSchema,
  DateBindingSchema,
  ImageBindingSchema,
} from './binding.js'

// ---------------------------------------------------------------------------
// SlotNameSchema
// ---------------------------------------------------------------------------

describe('SlotNameSchema', () => {
  it('accepts a simple valid slot name', () => {
    expect(SlotNameSchema.parse('username')).toBe('username')
  })

  it('accepts a max-length 64-char name starting with a letter', () => {
    const name = 'a' + 'b'.repeat(63)
    // 64 chars total — SlotNameSchema regex allows [a-z][a-zA-Z0-9_]{0,63}
    // which is 1 + 63 = 64 chars max
    expect(SlotNameSchema.parse(name)).toBe(name)
  })

  it('rejects a name longer than 64 chars', () => {
    const name = 'a'.repeat(65)
    expect(() => SlotNameSchema.parse(name)).toThrow()
  })

  it('rejects a name that starts with a digit', () => {
    expect(() => SlotNameSchema.parse('1numericStart')).toThrow()
  })

  it('rejects an empty string', () => {
    expect(() => SlotNameSchema.parse('')).toThrow()
  })
})

// ---------------------------------------------------------------------------
// StringBindingSchema — T-0005-028..036, T-0005-036a (StringBinding branch)
// ---------------------------------------------------------------------------

describe('StringBindingSchema', () => {
  // T-0005-028
  it('T-0005-028 — parses literal kind with string value', () => {
    expect(StringBindingSchema.parse({kind: 'literal', value: 'hello'})).toEqual({
      kind: 'literal',
      value: 'hello',
    })
  })

  // T-0005-029
  it('T-0005-029 — parses state kind with valid slot name', () => {
    expect(StringBindingSchema.parse({kind: 'state', slot: 'username'})).toEqual({
      kind: 'state',
      slot: 'username',
    })
  })

  // T-0005-030
  it('T-0005-030 — parses collectionField kind with collectionId and field', () => {
    expect(
      StringBindingSchema.parse({kind: 'collectionField', collectionId: 'workouts', field: 'name'}),
    ).toEqual({kind: 'collectionField', collectionId: 'workouts', field: 'name'})
  })

  // T-0005-031
  it('T-0005-031 — rejects literal kind with number value (number for string binding)', () => {
    expect(() => StringBindingSchema.parse({kind: 'literal', value: 42})).toThrow()
  })

  // T-0005-032
  it('T-0005-032 — rejects state kind with empty slot name (min length)', () => {
    expect(() => StringBindingSchema.parse({kind: 'state', slot: ''})).toThrow()
  })

  // T-0005-033
  it('T-0005-033 — rejects collectionField kind missing collectionId and field', () => {
    expect(() => StringBindingSchema.parse({kind: 'collectionField'})).toThrow()
  })

  // T-0005-034
  it('T-0005-034 — rejects invalid kind discriminant', () => {
    expect(() => StringBindingSchema.parse({kind: 'invalid'})).toThrow()
  })

  // T-0005-035
  it('T-0005-035 — accepts state kind with exactly 64-char slot name (max length)', () => {
    const slot = 'a' + 'b'.repeat(63)
    expect(StringBindingSchema.parse({kind: 'state', slot})).toEqual({kind: 'state', slot})
  })

  // T-0005-036
  it('T-0005-036 — rejects state kind with 65-char slot name (over-length)', () => {
    const slot = 'a'.repeat(65)
    expect(() => StringBindingSchema.parse({kind: 'state', slot})).toThrow()
  })
})

// T-0005-036a — parameterized regex-failure test across all 5 binding types.
// Confirms Binding<*>.slot uses SlotNameSchema (not plain z.string()),
// so a numeric-start slot name fails on ALL binding types.
describe('T-0005-036a — SlotNameSchema regex enforced on all 5 binding types', () => {
  const BINDING_SCHEMAS = [
    {name: 'StringBindingSchema', schema: StringBindingSchema},
    {name: 'NumberBindingSchema', schema: NumberBindingSchema},
    {name: 'BooleanBindingSchema', schema: BooleanBindingSchema},
    {name: 'DateBindingSchema', schema: DateBindingSchema},
    {name: 'ImageBindingSchema', schema: ImageBindingSchema},
  ]

  it.each(BINDING_SCHEMAS)(
    '$name rejects slot: "1numericStart" (regex requires lowercase-letter start)',
    ({schema}) => {
      expect(() => schema.parse({kind: 'state', slot: '1numericStart'})).toThrow()
    },
  )
})

// T-0005-037 — NumberBinding, BooleanBinding, DateBinding, ImageBinding each
// parse their literal variant correctly.
describe('T-0005-037 — all 4 remaining binding types parse literal variant', () => {
  it('NumberBindingSchema parses literal number', () => {
    expect(NumberBindingSchema.parse({kind: 'literal', value: 42})).toEqual({
      kind: 'literal',
      value: 42,
    })
  })

  it('BooleanBindingSchema parses literal boolean', () => {
    expect(BooleanBindingSchema.parse({kind: 'literal', value: true})).toEqual({
      kind: 'literal',
      value: true,
    })
  })

  it('DateBindingSchema parses literal date string', () => {
    expect(DateBindingSchema.parse({kind: 'literal', value: '2026-05-07'})).toEqual({
      kind: 'literal',
      value: '2026-05-07',
    })
  })

  it('ImageBindingSchema parses literal image URI', () => {
    expect(ImageBindingSchema.parse({kind: 'literal', value: 'file:///images/photo.jpg'})).toEqual({
      kind: 'literal',
      value: 'file:///images/photo.jpg',
    })
  })
})

// ---------------------------------------------------------------------------
// BindingValueSchema
// ---------------------------------------------------------------------------

describe('BindingValueSchema', () => {
  it('accepts a string', () => {
    expect(BindingValueSchema.parse('hello')).toBe('hello')
  })

  it('accepts a number', () => {
    expect(BindingValueSchema.parse(42)).toBe(42)
  })

  it('accepts a boolean', () => {
    expect(BindingValueSchema.parse(true)).toBe(true)
  })

  it('rejects an object (not a primitive)', () => {
    expect(() => BindingValueSchema.parse({kind: 'literal'})).toThrow()
  })

  it('rejects null', () => {
    expect(() => BindingValueSchema.parse(null)).toThrow()
  })
})
