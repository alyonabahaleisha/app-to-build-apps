/**
 * Compound component schema tests — T-0005-072..097, T-0005-098..125
 * T-0005-072a..072r (F-09): ImagePicker × 3 binding kinds
 * V1 Phase 1 Step 1 additions: T-0009-006..010 (ImageSchema)
 * Components: ConditionalSection, ListSummary, MediaTray, ImagePicker (4 compound tier)
 * V1 additions: Image (1 new)
 */
import {
  ConditionalSectionSchema,
  ListSummarySchema,
  MediaTraySchema,
  ImagePickerSchema,
  ImageSchema,
} from './compound.js'
import {
  CONDITIONAL_SECTION_FIXTURE,
  LIST_SUMMARY_FIXTURE,
  MEDIA_TRAY_FIXTURE,
  IMAGE_PICKER_FIXTURE,
  TOAST_ACTION,
  IMAGE_BINDING_LITERAL,
  IMAGE_BINDING_STATE,
  IMAGE_BINDING_COLLECTION,
} from '../../test/fixtures.js'

// ---------------------------------------------------------------------------
// Image — V1 Phase 1 Step 1 (T-0009-006..010)
// ---------------------------------------------------------------------------

describe('ImageSchema (T-0009-006..010)', () => {
  const VALID_IMAGE = {
    id: 'img1',
    type: 'Image' as const,
    source: IMAGE_BINDING_LITERAL,
    alt: 'A photo of a sunset',
  }

  // T-0009-006: happy path with required props
  it('T-0009-006: parses with source and alt', () => {
    expect(() => ImageSchema.parse(VALID_IMAGE)).not.toThrow()
  })

  // T-0009-007: empty alt rejects (accessibility critical)
  it('T-0009-007: rejects empty alt string', () => {
    expect(() => ImageSchema.parse({...VALID_IMAGE, alt: ''})).toThrow()
  })

  // T-0009-008: missing alt rejects (required)
  it('T-0009-008: rejects when alt is missing entirely', () => {
    const {alt: _alt, ...rest} = VALID_IMAGE
    expect(() => ImageSchema.parse(rest)).toThrow()
  })

  // T-0009-009: alt > 200 chars rejects
  it('T-0009-009: rejects alt > 200 chars', () => {
    expect(() => ImageSchema.parse({...VALID_IMAGE, alt: 'x'.repeat(201)})).toThrow()
  })

  // T-0009-010: alt at exactly 200 chars succeeds
  it('T-0009-010: accepts alt at exactly 200 chars (boundary)', () => {
    expect(() => ImageSchema.parse({...VALID_IMAGE, alt: 'x'.repeat(200)})).not.toThrow()
  })

  it('accepts all aspectRatio values', () => {
    for (const aspectRatio of ['1:1', '4:5', '16:9', '3:4', '21:9'] as const) {
      expect(() => ImageSchema.parse({...VALID_IMAGE, aspectRatio})).not.toThrow()
    }
  })

  it('accepts all fit values', () => {
    for (const fit of ['cover', 'contain'] as const) {
      expect(() => ImageSchema.parse({...VALID_IMAGE, fit})).not.toThrow()
    }
  })

  it('accepts all radius values', () => {
    for (const radius of ['radius-none', 'radius-sm', 'radius-md', 'radius-lg', 'radius-full'] as const) {
      expect(() => ImageSchema.parse({...VALID_IMAGE, radius})).not.toThrow()
    }
  })

  it('accepts fallbackIcon', () => {
    expect(() => ImageSchema.parse({...VALID_IMAGE, fallbackIcon: 'image'})).not.toThrow()
  })

  it('rejects invalid aspectRatio', () => {
    expect(() => ImageSchema.parse({...VALID_IMAGE, aspectRatio: '3:2'})).toThrow()
  })

  it('rejects extra props (.strict())', () => {
    expect(() => ImageSchema.parse({...VALID_IMAGE, loading: 'lazy'})).toThrow()
  })

  it('accepts all 3 binding kinds for source', () => {
    for (const source of [IMAGE_BINDING_LITERAL, IMAGE_BINDING_STATE, IMAGE_BINDING_COLLECTION]) {
      expect(() => ImageSchema.parse({...VALID_IMAGE, source})).not.toThrow()
    }
  })
})

// ---- F-09: ImagePicker × 3 binding kinds ----

describe('F-09: ImagePicker with all 3 binding kinds', () => {
  test.each([
    ['literal', IMAGE_BINDING_LITERAL],
    ['state', IMAGE_BINDING_STATE],
    ['collectionField', IMAGE_BINDING_COLLECTION],
  ])('ImagePicker with %s binding parses', (_kind, valueBinding) => {
    expect(() => ImagePickerSchema.parse({...IMAGE_PICKER_FIXTURE, valueBinding})).not.toThrow()
  })
})

// ---- ConditionalSection ----

describe('ConditionalSectionSchema', () => {
  it('parses minimal fixture', () => {
    expect(() => ConditionalSectionSchema.parse(CONDITIONAL_SECTION_FIXTURE)).not.toThrow()
  })

  it('fails when collectionId is missing', () => {
    const {collectionId: _c, ...rest} = CONDITIONAL_SECTION_FIXTURE
    expect(() => ConditionalSectionSchema.parse(rest)).toThrow()
  })

  it('fails when showWhen is missing', () => {
    const {showWhen: _s, ...rest} = CONDITIONAL_SECTION_FIXTURE
    expect(() => ConditionalSectionSchema.parse(rest)).toThrow()
  })

  it('fails when children is missing', () => {
    const {children: _c, ...rest} = CONDITIONAL_SECTION_FIXTURE
    expect(() => ConditionalSectionSchema.parse(rest)).toThrow()
  })

  it('accepts showWhen: whenNotEmpty', () => {
    expect(() =>
      ConditionalSectionSchema.parse({...CONDITIONAL_SECTION_FIXTURE, showWhen: 'whenNotEmpty'}),
    ).not.toThrow()
  })

  it('rejects invalid showWhen', () => {
    expect(() =>
      ConditionalSectionSchema.parse({...CONDITIONAL_SECTION_FIXTURE, showWhen: 'always'}),
    ).toThrow()
  })

  it('rejects extra props (.strict())', () => {
    expect(() =>
      ConditionalSectionSchema.parse({...CONDITIONAL_SECTION_FIXTURE, predicate: 'custom'}),
    ).toThrow()
  })
})

// ---- ListSummary ----

describe('ListSummarySchema', () => {
  it('parses minimal fixture', () => {
    expect(() => ListSummarySchema.parse(LIST_SUMMARY_FIXTURE)).not.toThrow()
  })

  it('fails when collectionId is missing', () => {
    const {collectionId: _c, ...rest} = LIST_SUMMARY_FIXTURE
    expect(() => ListSummarySchema.parse(rest)).toThrow()
  })

  it('fails when prompt is missing', () => {
    const {prompt: _p, ...rest} = LIST_SUMMARY_FIXTURE
    expect(() => ListSummarySchema.parse(rest)).toThrow()
  })

  it('accepts fallback: show-raw and hide', () => {
    expect(() =>
      ListSummarySchema.parse({...LIST_SUMMARY_FIXTURE, fallback: 'show-raw'}),
    ).not.toThrow()
    expect(() =>
      ListSummarySchema.parse({...LIST_SUMMARY_FIXTURE, fallback: 'hide'}),
    ).not.toThrow()
  })

  it('rejects invalid fallback', () => {
    expect(() =>
      ListSummarySchema.parse({...LIST_SUMMARY_FIXTURE, fallback: 'error'}),
    ).toThrow()
  })

  it('rejects empty prompt', () => {
    expect(() =>
      ListSummarySchema.parse({...LIST_SUMMARY_FIXTURE, prompt: ''}),
    ).toThrow()
  })

  it('rejects extra props (.strict())', () => {
    expect(() =>
      ListSummarySchema.parse({...LIST_SUMMARY_FIXTURE, model: 'gpt-4'}),
    ).toThrow()
  })
})

// ---- MediaTray ----

describe('MediaTraySchema', () => {
  it('parses minimal fixture', () => {
    expect(() => MediaTraySchema.parse(MEDIA_TRAY_FIXTURE)).not.toThrow()
  })

  it('fails when collectionId is missing', () => {
    const {collectionId: _c, ...rest} = MEDIA_TRAY_FIXTURE
    expect(() => MediaTraySchema.parse(rest)).toThrow()
  })

  it('fails when imageField is missing', () => {
    const {imageField: _f, ...rest} = MEDIA_TRAY_FIXTURE
    expect(() => MediaTraySchema.parse(rest)).toThrow()
  })

  it('accepts all aspectRatio values', () => {
    for (const aspectRatio of ['1:1', '4:5', '16:9']) {
      expect(() => MediaTraySchema.parse({...MEDIA_TRAY_FIXTURE, aspectRatio})).not.toThrow()
    }
  })

  it('rejects invalid aspectRatio', () => {
    expect(() => MediaTraySchema.parse({...MEDIA_TRAY_FIXTURE, aspectRatio: '3:2'})).toThrow()
  })

  it('accepts optional tapAction', () => {
    expect(() =>
      MediaTraySchema.parse({...MEDIA_TRAY_FIXTURE, tapAction: TOAST_ACTION}),
    ).not.toThrow()
  })

  it('rejects extra props (.strict())', () => {
    expect(() =>
      MediaTraySchema.parse({...MEDIA_TRAY_FIXTURE, columns: 3}),
    ).toThrow()
  })
})

// ---- ImagePicker ----

describe('ImagePickerSchema', () => {
  it('parses minimal fixture', () => {
    expect(() => ImagePickerSchema.parse(IMAGE_PICKER_FIXTURE)).not.toThrow()
  })

  it('fails when label is missing', () => {
    const {label: _l, ...rest} = IMAGE_PICKER_FIXTURE
    expect(() => ImagePickerSchema.parse(rest)).toThrow()
  })

  it('fails when valueBinding is missing', () => {
    const {valueBinding: _v, ...rest} = IMAGE_PICKER_FIXTURE
    expect(() => ImagePickerSchema.parse(rest)).toThrow()
  })

  it('accepts all source values', () => {
    for (const source of ['camera', 'library', 'both']) {
      expect(() => ImagePickerSchema.parse({...IMAGE_PICKER_FIXTURE, source})).not.toThrow()
    }
  })

  it('rejects invalid source', () => {
    expect(() => ImagePickerSchema.parse({...IMAGE_PICKER_FIXTURE, source: 'url'})).toThrow()
  })

  it('rejects a plain string as valueBinding', () => {
    expect(() =>
      ImagePickerSchema.parse({...IMAGE_PICKER_FIXTURE, valueBinding: 'file://photo.jpg'}),
    ).toThrow()
  })

  it('rejects extra props (.strict())', () => {
    expect(() =>
      ImagePickerSchema.parse({...IMAGE_PICKER_FIXTURE, quality: 0.8}),
    ).toThrow()
  })
})
