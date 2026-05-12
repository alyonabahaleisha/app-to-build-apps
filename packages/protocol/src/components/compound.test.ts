/**
 * Compound component schema tests — T-0005-072..097, T-0005-098..125
 * T-0005-072a..072r (F-09): ImagePicker × 3 binding kinds
 * V1 Phase 1 Step 1 additions: T-0009-006..010 (ImageSchema)
 * V1 Phase 1 Step 5 additions: T-0009-111, 116-117, 121, 125, 128, 134, 236
 * V1 Phase 1 Step 6 additions: T-0009-138..140, T-0009-147, T-0009-155..156, T-0009-244a
 * V1 Phase 1 Step 7 additions: T-0009-158..162, T-0009-165, T-0009-170, T-0009-174..177
 * Components: ConditionalSection, ListSummary, MediaTray, ImagePicker (4 compound tier)
 * V1 additions: Image (1 new), TransactionRow, Receipt, MetricTile, StepList (4 new),
 *               Calendar, Heatmap (2 new),
 *               Gallery, CommerceCard, BeforeAfter, DocumentPicker (4 new)
 */
import {
  ConditionalSectionSchema,
  ListSummarySchema,
  MediaTraySchema,
  ImagePickerSchema,
  ImageSchema,
  TransactionRowSchema,
  ReceiptSchema,
  MetricTileSchema,
  StepListSchema,
  CalendarSchema,
  HeatmapSchema,
  GallerySchema,
  CommerceCardSchema,
  BeforeAfterSchema,
  DocumentPickerSchema,
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

// ---------------------------------------------------------------------------
// V1 Phase 1 Step 5 — Productivity domain compound schemas
// ---------------------------------------------------------------------------

// ---- TransactionRow (T-0009-111, T-0009-134) ----

describe('TransactionRowSchema (T-0009-111, T-0009-134)', () => {
  const VALID_TRANSACTION = {
    id: 'txn1',
    type: 'TransactionRow' as const,
    date: '2026-01-15',
    merchant: 'Acme Coffee',
    amount: {kind: 'literal' as const, value: 1250},
    currency: 'USD' as const,
  }

  // T-0009-111: happy path with required fields
  it('T-0009-111: parses with date, merchant, amount, currency', () => {
    expect(() => TransactionRowSchema.parse(VALID_TRANSACTION)).not.toThrow()
  })

  it('parses without optional currency (defaults to undefined, renderer fills USD)', () => {
    const {currency: _c, ...rest} = VALID_TRANSACTION
    expect(() => TransactionRowSchema.parse(rest)).not.toThrow()
  })

  it('accepts optional categoryIcon', () => {
    expect(() =>
      TransactionRowSchema.parse({...VALID_TRANSACTION, categoryIcon: 'shopping-bag'}),
    ).not.toThrow()
  })

  it('accepts negative amount (outflow)', () => {
    expect(() =>
      TransactionRowSchema.parse({...VALID_TRANSACTION, amount: {kind: 'literal', value: -500}}),
    ).not.toThrow()
  })

  it('accepts state binding for amount', () => {
    expect(() =>
      TransactionRowSchema.parse({
        ...VALID_TRANSACTION,
        amount: {kind: 'state', slot: 'amountSlot'},
      }),
    ).not.toThrow()
  })

  it('rejects empty date', () => {
    expect(() =>
      TransactionRowSchema.parse({...VALID_TRANSACTION, date: ''}),
    ).toThrow()
  })

  it('rejects merchant over 80 chars', () => {
    expect(() =>
      TransactionRowSchema.parse({...VALID_TRANSACTION, merchant: 'A'.repeat(81)}),
    ).toThrow()
  })

  // T-0009-134: currency 'XYZ' not in CurrencySchema
  it('T-0009-134: rejects currency "XYZ" (not in CurrencySchema)', () => {
    expect(() =>
      TransactionRowSchema.parse({...VALID_TRANSACTION, currency: 'XYZ'}),
    ).toThrow()
  })

  it('rejects extra props (.strict())', () => {
    expect(() =>
      TransactionRowSchema.parse({...VALID_TRANSACTION, note: 'coffee'}),
    ).toThrow()
  })

  it('accepts diverse merchant names (i18n)', () => {
    for (const merchant of ['José García', '李明商店', "O'Brien's Pub"]) {
      expect(() =>
        TransactionRowSchema.parse({...VALID_TRANSACTION, merchant}),
      ).not.toThrow()
    }
  })
})

// ---- Receipt (T-0009-116, T-0009-117) ----

describe('ReceiptSchema (T-0009-116, T-0009-117)', () => {
  const RECEIPT_ITEM = {
    label: 'Cappuccino',
    amount: {kind: 'literal' as const, value: 450},
  }

  const VALID_RECEIPT = {
    id: 'rcp1',
    type: 'Receipt' as const,
    items: [RECEIPT_ITEM],
    subtotal: {kind: 'literal' as const, value: 450},
    total: {kind: 'literal' as const, value: 450},
  }

  // T-0009-116: happy path
  it('T-0009-116: parses with items, subtotal, total', () => {
    expect(() => ReceiptSchema.parse(VALID_RECEIPT)).not.toThrow()
  })

  it('accepts optional tax and tip', () => {
    expect(() =>
      ReceiptSchema.parse({
        ...VALID_RECEIPT,
        tax: {kind: 'literal', value: 45},
        tip: {kind: 'literal', value: 90},
        total: {kind: 'literal', value: 585},
      }),
    ).not.toThrow()
  })

  it('accepts items with quantity', () => {
    expect(() =>
      ReceiptSchema.parse({
        ...VALID_RECEIPT,
        items: [{...RECEIPT_ITEM, quantity: 2}],
      }),
    ).not.toThrow()
  })

  it('accepts all valid currencies', () => {
    for (const currency of ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'INR'] as const) {
      expect(() => ReceiptSchema.parse({...VALID_RECEIPT, currency})).not.toThrow()
    }
  })

  // T-0009-117: 51 items rejects (max 50)
  it('T-0009-117: rejects 51 items (max 50)', () => {
    const items = Array.from({length: 51}, (_, i) => ({
      label: `Item ${i + 1}`,
      amount: {kind: 'literal' as const, value: 100},
    }))
    expect(() => ReceiptSchema.parse({...VALID_RECEIPT, items})).toThrow()
  })

  it('accepts exactly 50 items (boundary)', () => {
    const items = Array.from({length: 50}, (_, i) => ({
      label: `Item ${i + 1}`,
      amount: {kind: 'literal' as const, value: 100},
    }))
    expect(() => ReceiptSchema.parse({...VALID_RECEIPT, items})).not.toThrow()
  })

  it('rejects 0 items (min 1)', () => {
    expect(() => ReceiptSchema.parse({...VALID_RECEIPT, items: []})).toThrow()
  })

  it('rejects extra props (.strict())', () => {
    expect(() =>
      ReceiptSchema.parse({...VALID_RECEIPT, discount: 100}),
    ).toThrow()
  })

  it('rejects item quantity that is not a positive integer', () => {
    expect(() =>
      ReceiptSchema.parse({
        ...VALID_RECEIPT,
        items: [{...RECEIPT_ITEM, quantity: 0}],
      }),
    ).toThrow()
  })
})

// ---- MetricTile (T-0009-121, T-0009-236) ----

describe('MetricTileSchema (T-0009-121, T-0009-236)', () => {
  const VALID_METRIC = {
    id: 'met1',
    type: 'MetricTile' as const,
    value: '42',
    label: 'Tasks completed',
    sparklineData: [1, 2, 3],
  }

  // T-0009-121: happy path
  it('T-0009-121: parses with value, label, sparklineData', () => {
    expect(() => MetricTileSchema.parse(VALID_METRIC)).not.toThrow()
  })

  it('parses without optional fields', () => {
    const {sparklineData: _s, ...rest} = VALID_METRIC
    expect(() => MetricTileSchema.parse(rest)).not.toThrow()
  })

  it('accepts deltaTone values', () => {
    for (const deltaTone of ['positive', 'negative', 'neutral'] as const) {
      expect(() =>
        MetricTileSchema.parse({...VALID_METRIC, deltaTone, delta: '+5'}),
      ).not.toThrow()
    }
  })

  it('accepts optional icon from the closed catalog', () => {
    expect(() => MetricTileSchema.parse({...VALID_METRIC, icon: 'trending-up'})).not.toThrow()
  })

  it('rejects empty value', () => {
    expect(() => MetricTileSchema.parse({...VALID_METRIC, value: ''})).toThrow()
  })

  it('rejects value over 40 chars', () => {
    expect(() =>
      MetricTileSchema.parse({...VALID_METRIC, value: 'x'.repeat(41)}),
    ).toThrow()
  })

  it('rejects invalid deltaTone', () => {
    expect(() =>
      MetricTileSchema.parse({...VALID_METRIC, deltaTone: 'good'}),
    ).toThrow()
  })

  // T-0009-236: sparklineData max 30 boundary
  it('T-0009-236: accepts exactly 30 sparkline data points (max-inclusive)', () => {
    expect(() =>
      MetricTileSchema.parse({...VALID_METRIC, sparklineData: Array(30).fill(1)}),
    ).not.toThrow()
  })

  it('T-0009-236: rejects 31 sparkline data points (exceeds max)', () => {
    expect(() =>
      MetricTileSchema.parse({...VALID_METRIC, sparklineData: Array(31).fill(1)}),
    ).toThrow()
  })

  it('rejects extra props (.strict())', () => {
    expect(() =>
      MetricTileSchema.parse({...VALID_METRIC, unit: 'tasks'}),
    ).toThrow()
  })
})

// ---- StepList (T-0009-125, T-0009-128) ----

describe('StepListSchema (T-0009-125, T-0009-128)', () => {
  const VALID_STEP_LIST = {
    id: 'sl1',
    type: 'StepList' as const,
    steps: [{title: 'Preheat oven to 180°C'}],
    style: 'numbered' as const,
  }

  // T-0009-125: happy path
  it('T-0009-125: parses with steps and style "numbered"', () => {
    expect(() => StepListSchema.parse(VALID_STEP_LIST)).not.toThrow()
  })

  it('parses checklist style', () => {
    expect(() =>
      StepListSchema.parse({...VALID_STEP_LIST, style: 'checklist'}),
    ).not.toThrow()
  })

  it('parses without optional style (defaults to undefined, renderer fills numbered)', () => {
    const {style: _s, ...rest} = VALID_STEP_LIST
    expect(() => StepListSchema.parse(rest)).not.toThrow()
  })

  it('accepts step with body and done binding', () => {
    expect(() =>
      StepListSchema.parse({
        ...VALID_STEP_LIST,
        steps: [
          {
            title: 'Mix ingredients',
            body: 'Combine flour and sugar in a bowl.',
            done: {kind: 'state', slot: 'step1Done'},
          },
        ],
      }),
    ).not.toThrow()
  })

  it('accepts steps with diverse titles (i18n)', () => {
    expect(() =>
      StepListSchema.parse({
        ...VALID_STEP_LIST,
        steps: [
          {title: 'José García cooks'},
          {title: '第一步：准备'},
          {title: "O'Brien's method"},
        ],
      }),
    ).not.toThrow()
  })

  it('rejects step with body over 240 chars', () => {
    expect(() =>
      StepListSchema.parse({
        ...VALID_STEP_LIST,
        steps: [{title: 'Step', body: 'x'.repeat(241)}],
      }),
    ).toThrow()
  })

  it('rejects step with empty title', () => {
    expect(() =>
      StepListSchema.parse({...VALID_STEP_LIST, steps: [{title: ''}]}),
    ).toThrow()
  })

  // T-0009-128: 21 steps rejects (max 20)
  it('T-0009-128: rejects 21 steps (max 20)', () => {
    const steps = Array.from({length: 21}, (_, i) => ({title: `Step ${i + 1}`}))
    expect(() => StepListSchema.parse({...VALID_STEP_LIST, steps})).toThrow()
  })

  it('accepts exactly 20 steps (boundary)', () => {
    const steps = Array.from({length: 20}, (_, i) => ({title: `Step ${i + 1}`}))
    expect(() => StepListSchema.parse({...VALID_STEP_LIST, steps})).not.toThrow()
  })

  it('rejects 0 steps (min 1)', () => {
    expect(() => StepListSchema.parse({...VALID_STEP_LIST, steps: []})).toThrow()
  })

  it('rejects invalid style', () => {
    expect(() =>
      StepListSchema.parse({...VALID_STEP_LIST, style: 'bulleted'}),
    ).toThrow()
  })

  it('rejects extra props (.strict())', () => {
    expect(() =>
      StepListSchema.parse({...VALID_STEP_LIST, ordered: true}),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// V1 Phase 1 Step 6 — Date component schemas
// ---------------------------------------------------------------------------

// ---- CalendarSchema (T-0009-138, T-0009-139, T-0009-140, T-0009-156) ----

describe('CalendarSchema (T-0009-138, T-0009-139, T-0009-140, T-0009-156)', () => {
  const BASE_CALENDAR = {
    id: 'cal1',
    type: 'Calendar' as const,
  }

  // T-0009-138: happy path without collection binding
  it('T-0009-138: parses without collection binding (view: month)', () => {
    const result = CalendarSchema.safeParse({...BASE_CALENDAR, view: 'month'})
    expect(result.success).toBe(true)
  })

  // T-0009-138 variant: parses with no view at all (optional)
  it('parses without any optional fields', () => {
    const result = CalendarSchema.safeParse(BASE_CALENDAR)
    expect(result.success).toBe(true)
  })

  // T-0009-139: happy path with full collection binding
  it('T-0009-139: parses with collectionId and dateField', () => {
    const result = CalendarSchema.safeParse({
      ...BASE_CALENDAR,
      view: 'month',
      collectionId: 'events',
      dateField: 'eventDate',
    })
    expect(result.success).toBe(true)
  })

  it('accepts selectedBinding as state binding', () => {
    const result = CalendarSchema.safeParse({
      ...BASE_CALENDAR,
      selectedBinding: {kind: 'state', slot: 'selectedDate'},
    })
    expect(result.success).toBe(true)
  })

  it('accepts firstDayOfWeek: sunday and monday', () => {
    for (const firstDayOfWeek of ['sunday', 'monday'] as const) {
      const result = CalendarSchema.safeParse({...BASE_CALENDAR, firstDayOfWeek})
      expect(result.success).toBe(true)
    }
  })

  it('accepts view: week', () => {
    const result = CalendarSchema.safeParse({...BASE_CALENDAR, view: 'week'})
    expect(result.success).toBe(true)
  })

  // T-0009-140: collectionId set but no dateField — superRefine rejects with specific message + path
  it('T-0009-140: rejects collectionId without dateField at superRefine', () => {
    const result = CalendarSchema.safeParse({
      ...BASE_CALENDAR,
      collectionId: 'events',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues[0]
      expect(issue).toBeDefined()
      expect(issue!.message).toBe('Calendar with collectionId requires dateField')
      expect(issue!.path).toEqual(['dateField'])
    }
  })

  // T-0009-156: view: 'year' is not in the enum — must reject
  it('T-0009-156: rejects view: "year" (not in enum)', () => {
    const result = CalendarSchema.safeParse({...BASE_CALENDAR, view: 'year'})
    expect(result.success).toBe(false)
  })

  it('rejects extra props (.strict())', () => {
    const result = CalendarSchema.safeParse({...BASE_CALENDAR, showWeekNumbers: true})
    expect(result.success).toBe(false)
  })

  it('accepts collectionId up to 64 chars', () => {
    const result = CalendarSchema.safeParse({
      ...BASE_CALENDAR,
      collectionId: 'a'.repeat(64),
      dateField: 'date',
    })
    expect(result.success).toBe(true)
  })

  it('rejects collectionId over 64 chars', () => {
    const result = CalendarSchema.safeParse({
      ...BASE_CALENDAR,
      collectionId: 'a'.repeat(65),
      dateField: 'date',
    })
    expect(result.success).toBe(false)
  })
})

// ---- HeatmapSchema (T-0009-147, T-0009-155, T-0009-244a) ----

describe('HeatmapSchema (T-0009-147, T-0009-155, T-0009-244a)', () => {
  const BASE_HEATMAP = {
    id: 'hm1',
    type: 'Heatmap' as const,
    collectionId: 'workouts',
    dateField: 'completedAt',
  }

  // T-0009-147: happy path with required fields + range
  it('T-0009-147: parses with collectionId, dateField, range: 90d', () => {
    const result = HeatmapSchema.safeParse({...BASE_HEATMAP, range: '90d'})
    expect(result.success).toBe(true)
  })

  it('parses with minimal required fields only', () => {
    const result = HeatmapSchema.safeParse(BASE_HEATMAP)
    expect(result.success).toBe(true)
  })

  it('accepts all valid range values', () => {
    for (const range of ['30d', '90d', '180d', '365d'] as const) {
      const result = HeatmapSchema.safeParse({...BASE_HEATMAP, range})
      expect(result.success).toBe(true)
    }
  })

  // T-0009-244a: range '365d' is the enum max — must succeed (boundary)
  it('T-0009-244a: accepts range: "365d" (exactly at enum max)', () => {
    const result = HeatmapSchema.safeParse({...BASE_HEATMAP, range: '365d'})
    expect(result.success).toBe(true)
  })

  // T-0009-155: range '500d' is not in the enum — must reject
  it('T-0009-155: rejects range: "500d" (not in enum)', () => {
    const result = HeatmapSchema.safeParse({...BASE_HEATMAP, range: '500d'})
    expect(result.success).toBe(false)
  })

  it('accepts intensityMode values', () => {
    for (const intensityMode of ['count', 'binary'] as const) {
      const result = HeatmapSchema.safeParse({...BASE_HEATMAP, intensityMode})
      expect(result.success).toBe(true)
    }
  })

  it('rejects missing collectionId', () => {
    const {collectionId: _c, ...rest} = BASE_HEATMAP
    const result = HeatmapSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects missing dateField', () => {
    const {dateField: _d, ...rest} = BASE_HEATMAP
    const result = HeatmapSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects extra props (.strict())', () => {
    const result = HeatmapSchema.safeParse({...BASE_HEATMAP, showLegend: true})
    expect(result.success).toBe(false)
  })

  it('accepts diverse collectionId formats (i18n safe)', () => {
    for (const collectionId of ['habits', 'workout-log', 'study_sessions']) {
      const result = HeatmapSchema.safeParse({...BASE_HEATMAP, collectionId})
      expect(result.success).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// V1 Phase 1 Step 7 — Content/Media expansion schemas
// ---------------------------------------------------------------------------

// ---- GallerySchema (T-0009-158..162) ----

describe('GallerySchema (T-0009-158..162)', () => {
  const IMAGE_BINDING_LITERAL = {kind: 'literal' as const, value: 'http://example.com/photo.jpg'}

  // T-0009-158: collectionId + imageField
  it('T-0009-158: parses with collectionId + imageField', () => {
    const result = GallerySchema.safeParse({
      id: 'g1',
      type: 'Gallery',
      collectionId: 'photos',
      imageField: 'photoUrl',
    })
    expect(result.success).toBe(true)
  })

  // T-0009-159: static images array
  it('T-0009-159: parses with images array (literal binding)', () => {
    const result = GallerySchema.safeParse({
      id: 'g1',
      type: 'Gallery',
      images: [IMAGE_BINDING_LITERAL],
    })
    expect(result.success).toBe(true)
  })

  // T-0009-160: both-set rejected
  it('T-0009-160: rejects when both collectionId+imageField and images are set', () => {
    const result = GallerySchema.safeParse({
      id: 'g1',
      type: 'Gallery',
      collectionId: 'photos',
      imageField: 'photoUrl',
      images: [IMAGE_BINDING_LITERAL],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]!.message).toContain('exactly one of')
    }
  })

  // T-0009-161: neither-set rejected
  it('T-0009-161: rejects when neither source is set', () => {
    const result = GallerySchema.safeParse({id: 'g1', type: 'Gallery'})
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]!.message).toContain('exactly one of')
    }
  })

  // T-0009-162: collectionId without imageField rejected at superRefine
  it('T-0009-162: rejects collectionId without imageField (superRefine path check)', () => {
    const result = GallerySchema.safeParse({id: 'g1', type: 'Gallery', collectionId: 'photos'})
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find(i => i.path.includes('imageField'))
      expect(issue).toBeDefined()
      expect(issue!.message).toBe('Gallery with collectionId requires imageField')
    }
  })

  it('accepts valid columns values (2, 3, 4)', () => {
    for (const columns of [2, 3, 4] as const) {
      const result = GallerySchema.safeParse({
        id: 'g1',
        type: 'Gallery',
        images: [IMAGE_BINDING_LITERAL],
        columns,
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects columns: 5 (not in literal union)', () => {
    const result = GallerySchema.safeParse({
      id: 'g1',
      type: 'Gallery',
      images: [IMAGE_BINDING_LITERAL],
      columns: 5,
    })
    expect(result.success).toBe(false)
  })

  it('accepts aspectRatio values', () => {
    for (const aspectRatio of ['1:1', '4:5'] as const) {
      const result = GallerySchema.safeParse({
        id: 'g1',
        type: 'Gallery',
        images: [IMAGE_BINDING_LITERAL],
        aspectRatio,
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects images array over 50 items', () => {
    const result = GallerySchema.safeParse({
      id: 'g1',
      type: 'Gallery',
      images: Array(51).fill(IMAGE_BINDING_LITERAL),
    })
    expect(result.success).toBe(false)
  })

  it('rejects extra props (.strict())', () => {
    const result = GallerySchema.safeParse({
      id: 'g1',
      type: 'Gallery',
      images: [IMAGE_BINDING_LITERAL],
      showCaption: true,
    })
    expect(result.success).toBe(false)
  })
})

// ---- CommerceCardSchema (T-0009-165) ----

describe('CommerceCardSchema (T-0009-165)', () => {
  const VALID_COMMERCE = {
    id: 'cc1',
    type: 'CommerceCard' as const,
    title: 'Blue Sneakers',
    image: {kind: 'literal' as const, value: 'https://example.com/sneakers.jpg'},
    price: {kind: 'literal' as const, value: 8999},
  }

  // T-0009-165: happy path
  it('T-0009-165: parses with image, title, price', () => {
    const result = CommerceCardSchema.safeParse(VALID_COMMERCE)
    expect(result.success).toBe(true)
  })

  it('currency is optional (renderer defaults to USD)', () => {
    const result = CommerceCardSchema.safeParse(VALID_COMMERCE)
    expect(result.success).toBe(true)
    if (result.success) {
      // Optional — schema stores undefined; renderer applies USD default
      expect(result.data.currency === undefined || typeof result.data.currency === 'string').toBe(true)
    }
  })

  it('ctaLabel is optional (renderer defaults to "Add")', () => {
    const result = CommerceCardSchema.safeParse(VALID_COMMERCE)
    expect(result.success).toBe(true)
    if (result.success) {
      // Optional — schema stores undefined; renderer applies 'Add' default
      expect(result.data.ctaLabel === undefined || typeof result.data.ctaLabel === 'string').toBe(true)
    }
  })

  it('accepts optional priceCompare', () => {
    const result = CommerceCardSchema.safeParse({
      ...VALID_COMMERCE,
      priceCompare: {kind: 'literal', value: 12999},
    })
    expect(result.success).toBe(true)
  })

  it('accepts optional badge', () => {
    const result = CommerceCardSchema.safeParse({...VALID_COMMERCE, badge: 'Sale'})
    expect(result.success).toBe(true)
  })

  it('accepts optional ctaAction', () => {
    const result = CommerceCardSchema.safeParse({
      ...VALID_COMMERCE,
      ctaAction: {type: 'toast', message: 'Added to cart'},
    })
    expect(result.success).toBe(true)
  })

  it('rejects title over 120 chars', () => {
    const result = CommerceCardSchema.safeParse({...VALID_COMMERCE, title: 'A'.repeat(121)})
    expect(result.success).toBe(false)
  })

  it('rejects ctaLabel over 40 chars', () => {
    const result = CommerceCardSchema.safeParse({
      ...VALID_COMMERCE,
      ctaLabel: 'Add to Cart Right Now Today'.padEnd(41, '!'),
    })
    expect(result.success).toBe(false)
  })

  it('accepts state binding for price', () => {
    const result = CommerceCardSchema.safeParse({
      ...VALID_COMMERCE,
      price: {kind: 'state', slot: 'priceSlot'},
    })
    expect(result.success).toBe(true)
  })

  it('accepts diverse titles (i18n)', () => {
    for (const title of ['José García', '電子製品', "O'Brien's Gadget"]) {
      const result = CommerceCardSchema.safeParse({...VALID_COMMERCE, title})
      expect(result.success).toBe(true)
    }
  })

  it('rejects extra props (.strict())', () => {
    const result = CommerceCardSchema.safeParse({...VALID_COMMERCE, discount: 0.2})
    expect(result.success).toBe(false)
  })
})

// ---- BeforeAfterSchema (T-0009-170) ----

describe('BeforeAfterSchema (T-0009-170)', () => {
  const BEFORE_IMAGE = {kind: 'literal' as const, value: 'https://example.com/before.jpg'}
  const AFTER_IMAGE = {kind: 'literal' as const, value: 'https://example.com/after.jpg'}

  const VALID_BEFORE_AFTER = {
    id: 'ba1',
    type: 'BeforeAfter' as const,
    before: BEFORE_IMAGE,
    after: AFTER_IMAGE,
  }

  // T-0009-170: happy path with mode: slider
  it('T-0009-170: parses with before, after, mode: slider', () => {
    const result = BeforeAfterSchema.safeParse({...VALID_BEFORE_AFTER, mode: 'slider'})
    expect(result.success).toBe(true)
  })

  it('parses with mode: side-by-side', () => {
    const result = BeforeAfterSchema.safeParse({...VALID_BEFORE_AFTER, mode: 'side-by-side'})
    expect(result.success).toBe(true)
  })

  it('parses without mode (optional — renderer defaults to slider)', () => {
    const result = BeforeAfterSchema.safeParse(VALID_BEFORE_AFTER)
    expect(result.success).toBe(true)
  })

  it('accepts optional beforeLabel + afterLabel', () => {
    const result = BeforeAfterSchema.safeParse({
      ...VALID_BEFORE_AFTER,
      beforeLabel: 'Before treatment',
      afterLabel: 'After treatment',
    })
    expect(result.success).toBe(true)
  })

  it('rejects beforeLabel over 40 chars', () => {
    const result = BeforeAfterSchema.safeParse({
      ...VALID_BEFORE_AFTER,
      beforeLabel: 'A'.repeat(41),
    })
    expect(result.success).toBe(false)
  })

  it('rejects mode: "fade" (not in enum)', () => {
    const result = BeforeAfterSchema.safeParse({...VALID_BEFORE_AFTER, mode: 'fade'})
    expect(result.success).toBe(false)
  })

  it('accepts state binding for before/after images', () => {
    const result = BeforeAfterSchema.safeParse({
      id: 'ba1',
      type: 'BeforeAfter',
      before: {kind: 'state', slot: 'beforeSlot'},
      after: {kind: 'state', slot: 'afterSlot'},
    })
    expect(result.success).toBe(true)
  })

  it('rejects extra props (.strict())', () => {
    const result = BeforeAfterSchema.safeParse({...VALID_BEFORE_AFTER, animate: true})
    expect(result.success).toBe(false)
  })
})

// ---- DocumentPickerSchema (T-0009-174..177) ----

describe('DocumentPickerSchema (T-0009-174..177)', () => {
  const VALID_DOC_PICKER = {
    id: 'dp1',
    type: 'DocumentPicker' as const,
    label: 'Attach Document',
    valueBinding: {kind: 'state' as const, slot: 'docUri'},
  }

  // T-0009-174: happy path
  it('T-0009-174: parses with label, valueBinding, acceptedTypes: ["pdf", "image"]', () => {
    const result = DocumentPickerSchema.safeParse({
      ...VALID_DOC_PICKER,
      acceptedTypes: ['pdf', 'image'],
    })
    expect(result.success).toBe(true)
  })

  it('parses without acceptedTypes (optional — renderer defaults to ["any"])', () => {
    const result = DocumentPickerSchema.safeParse(VALID_DOC_PICKER)
    expect(result.success).toBe(true)
    if (result.success) {
      // acceptedTypes is optional; renderer applies default ['any'] — schema stores undefined
      expect(result.data.acceptedTypes === undefined || Array.isArray(result.data.acceptedTypes)).toBe(true)
    }
  })

  // T-0009-175: empty array rejected
  it('T-0009-175: acceptedTypes: [] rejects (min 1)', () => {
    const result = DocumentPickerSchema.safeParse({...VALID_DOC_PICKER, acceptedTypes: []})
    expect(result.success).toBe(false)
  })

  // T-0009-176: 5 types rejected
  it('T-0009-176: 5 acceptedTypes rejects (max 4)', () => {
    const result = DocumentPickerSchema.safeParse({
      ...VALID_DOC_PICKER,
      acceptedTypes: ['pdf', 'image', 'video', 'audio', 'any'],
    })
    expect(result.success).toBe(false)
  })

  // T-0009-177: unknown enum value rejected
  it('T-0009-177: acceptedTypes: ["gif"] rejects (not in enum)', () => {
    const result = DocumentPickerSchema.safeParse({...VALID_DOC_PICKER, acceptedTypes: ['gif']})
    expect(result.success).toBe(false)
  })

  it('accepts all valid acceptedTypes enum values', () => {
    for (const t of ['pdf', 'image', 'video', 'audio', 'any'] as const) {
      const result = DocumentPickerSchema.safeParse({...VALID_DOC_PICKER, acceptedTypes: [t]})
      expect(result.success).toBe(true)
    }
  })

  it('accepts exactly 4 acceptedTypes (boundary)', () => {
    const result = DocumentPickerSchema.safeParse({
      ...VALID_DOC_PICKER,
      acceptedTypes: ['pdf', 'image', 'video', 'audio'],
    })
    expect(result.success).toBe(true)
  })

  it('rejects label over 80 chars', () => {
    const result = DocumentPickerSchema.safeParse({
      ...VALID_DOC_PICKER,
      label: 'A'.repeat(81),
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty label', () => {
    const result = DocumentPickerSchema.safeParse({...VALID_DOC_PICKER, label: ''})
    expect(result.success).toBe(false)
  })

  it('accepts diverse labels (i18n)', () => {
    for (const label of ['Fichier', '文件', "O'Brien's CV"]) {
      const result = DocumentPickerSchema.safeParse({...VALID_DOC_PICKER, label})
      expect(result.success).toBe(true)
    }
  })

  it('accepts optional placeholder', () => {
    const result = DocumentPickerSchema.safeParse({
      ...VALID_DOC_PICKER,
      placeholder: 'Select a PDF...',
    })
    expect(result.success).toBe(true)
  })

  it('rejects extra props (.strict())', () => {
    const result = DocumentPickerSchema.safeParse({...VALID_DOC_PICKER, multiple: true})
    expect(result.success).toBe(false)
  })
})
