/**
 * Typography component schema tests — T-0005-072..097, T-0005-098..125, T-0005-135
 * Components: Heading, Body, Caption (3 typography tier)
 */
import {HeadingSchema, BodySchema, CaptionSchema} from './typography.js'
import {HEADING_FIXTURE, BODY_FIXTURE, CAPTION_FIXTURE} from '../../test/fixtures.js'

// ---- Heading ----

describe('HeadingSchema', () => {
  it('parses minimal fixture (T-0005-072 parameterized)', () => {
    expect(() => HeadingSchema.parse(HEADING_FIXTURE)).not.toThrow()
  })

  it('fails when text is missing (T-0005-098 parameterized)', () => {
    const {text: _t, ...rest} = HEADING_FIXTURE
    expect(() => HeadingSchema.parse(rest)).toThrow()
  })

  it('accepts all valid level values (1, 2, 3)', () => {
    for (const level of [1, 2, 3] as const) {
      expect(() => HeadingSchema.parse({...HEADING_FIXTURE, level})).not.toThrow()
    }
  })

  it('rejects level 0 (not in union)', () => {
    expect(() => HeadingSchema.parse({...HEADING_FIXTURE, level: 0})).toThrow()
  })

  it('rejects level 4 (not in union)', () => {
    expect(() => HeadingSchema.parse({...HEADING_FIXTURE, level: 4})).toThrow()
  })

  it('accepts all align values', () => {
    for (const align of ['start', 'center', 'end']) {
      expect(() => HeadingSchema.parse({...HEADING_FIXTURE, align})).not.toThrow()
    }
  })

  // T-0005-135: Heading.text max 200 chars boundary
  it('accepts text at exactly 200 chars (T-0005-135)', () => {
    expect(() => HeadingSchema.parse({...HEADING_FIXTURE, text: 'a'.repeat(200)})).not.toThrow()
  })

  it('rejects text at 201 chars (T-0005-135)', () => {
    expect(() => HeadingSchema.parse({...HEADING_FIXTURE, text: 'a'.repeat(201)})).toThrow()
  })

  it('rejects empty text', () => {
    expect(() => HeadingSchema.parse({...HEADING_FIXTURE, text: ''})).toThrow()
  })

  it('rejects extra props (.strict())', () => {
    expect(() => HeadingSchema.parse({...HEADING_FIXTURE, fontSize: 24})).toThrow()
  })
})

// ---- Body ----

describe('BodySchema', () => {
  it('parses minimal fixture', () => {
    expect(() => BodySchema.parse(BODY_FIXTURE)).not.toThrow()
  })

  it('fails when text is missing', () => {
    const {text: _t, ...rest} = BODY_FIXTURE
    expect(() => BodySchema.parse(rest)).toThrow()
  })

  it('accepts all weight values', () => {
    for (const weight of ['regular', 'strong']) {
      expect(() => BodySchema.parse({...BODY_FIXTURE, weight})).not.toThrow()
    }
  })

  it('accepts all valid color values', () => {
    for (const color of ['fg', 'fg-muted', 'fg-faint', 'success', 'warning', 'danger', 'accent']) {
      expect(() => BodySchema.parse({...BODY_FIXTURE, color})).not.toThrow()
    }
  })

  it('rejects invalid color (not in the 7-color subset)', () => {
    expect(() => BodySchema.parse({...BODY_FIXTURE, color: 'bg-elevated'})).toThrow()
  })

  it('rejects extra props (.strict())', () => {
    expect(() => BodySchema.parse({...BODY_FIXTURE, lineHeight: 24})).toThrow()
  })
})

// ---- Caption ----

describe('CaptionSchema', () => {
  it('parses minimal fixture', () => {
    expect(() => CaptionSchema.parse(CAPTION_FIXTURE)).not.toThrow()
  })

  it('fails when text is missing', () => {
    const {text: _t, ...rest} = CAPTION_FIXTURE
    expect(() => CaptionSchema.parse(rest)).toThrow()
  })

  it('accepts weight and color like Body', () => {
    expect(() =>
      CaptionSchema.parse({...CAPTION_FIXTURE, weight: 'strong', color: 'fg-muted'}),
    ).not.toThrow()
  })

  it('rejects extra props (.strict())', () => {
    expect(() => CaptionSchema.parse({...CAPTION_FIXTURE, truncate: true})).toThrow()
  })

  it('type literal is Caption not Body', () => {
    // type field must be 'Caption'; a 'Body' node should NOT parse as Caption
    expect(() => CaptionSchema.parse({...CAPTION_FIXTURE, type: 'Body'})).toThrow()
  })
})
