/**
 * Lists component schema tests — T-0005-072..097, T-0005-098..125,
 * T-0005-129..134 (Slot), T-0005-140 (legacy M1 breaking)
 * V1 Phase 1 Step 4: T-0009-089..110 (GridList, Carousel, Timeline, ErrorState)
 * Components: List, ListItem, SwipeableRow, EmptyState, LoadingState (5 lists tier)
 *             + GridList, Carousel, Timeline, ErrorState (4 new in Step 4)
 */
import {
  ListSchema,
  ListItemSchema,
  SwipeableRowSchema,
  EmptyStateSchema,
  LoadingStateSchema,
  GridListSchema,
  CarouselSchema,
  TimelineSchema,
  ErrorStateSchema,
} from './lists.js'
import {
  LIST_FIXTURE,
  LIST_ITEM_FIXTURE,
  SWIPEABLE_ROW_FIXTURE,
  EMPTY_STATE_FIXTURE,
  LOADING_STATE_FIXTURE,
  TOAST_ACTION,
  SLOT_NONE,
  SLOT_ICON,
  SLOT_AVATAR,
  SLOT_BADGE,
} from '../../test/fixtures.js'

// ---- List ----

describe('ListSchema', () => {
  it('parses minimal fixture', () => {
    expect(() => ListSchema.parse(LIST_FIXTURE)).not.toThrow()
  })

  it('fails when collectionId is missing', () => {
    const {collectionId: _c, ...rest} = LIST_FIXTURE
    expect(() => ListSchema.parse(rest)).toThrow()
  })

  it('accepts all itemLayout values', () => {
    for (const itemLayout of ['compact', 'standard', 'expanded']) {
      expect(() => ListSchema.parse({...LIST_FIXTURE, itemLayout})).not.toThrow()
    }
  })

  it('rejects invalid itemLayout', () => {
    expect(() => ListSchema.parse({...LIST_FIXTURE, itemLayout: 'large'})).toThrow()
  })

  it('rejects extra props (.strict())', () => {
    expect(() => ListSchema.parse({...LIST_FIXTURE, sortField: 'date'})).toThrow()
  })
})

// ---- ListItem and Slot tests (T-0005-129..134) ----

describe('ListItemSchema', () => {
  it('parses minimal fixture', () => {
    expect(() => ListItemSchema.parse(LIST_ITEM_FIXTURE)).not.toThrow()
  })

  it('fails when title is missing', () => {
    const {title: _t, ...rest} = LIST_ITEM_FIXTURE
    expect(() => ListItemSchema.parse(rest)).toThrow()
  })

  it('accepts optional subtitle', () => {
    expect(() => ListItemSchema.parse({...LIST_ITEM_FIXTURE, subtitle: 'Details'})).not.toThrow()
  })

  it('accepts tapAction', () => {
    expect(() =>
      ListItemSchema.parse({...LIST_ITEM_FIXTURE, tapAction: TOAST_ACTION}),
    ).not.toThrow()
  })

  // T-0005-129: leading accepts icon slot
  it("leading accepts kind='icon' (T-0005-129)", () => {
    expect(() => ListItemSchema.parse({...LIST_ITEM_FIXTURE, leading: SLOT_ICON})).not.toThrow()
    expect(ListItemSchema.parse({...LIST_ITEM_FIXTURE, leading: SLOT_ICON}).leading?.kind).toBe(
      'icon',
    )
  })

  // T-0005-130: leading accepts avatar slot
  it("leading accepts kind='avatar' (T-0005-130)", () => {
    expect(() => ListItemSchema.parse({...LIST_ITEM_FIXTURE, leading: SLOT_AVATAR})).not.toThrow()
    expect(ListItemSchema.parse({...LIST_ITEM_FIXTURE, leading: SLOT_AVATAR}).leading?.kind).toBe(
      'avatar',
    )
  })

  // T-0005-131: leading accepts badge slot
  it("leading accepts kind='badge' (T-0005-131)", () => {
    expect(() => ListItemSchema.parse({...LIST_ITEM_FIXTURE, leading: SLOT_BADGE})).not.toThrow()
  })

  // T-0005-132: leading accepts none slot
  it("leading accepts kind='none' (T-0005-132)", () => {
    expect(() => ListItemSchema.parse({...LIST_ITEM_FIXTURE, leading: SLOT_NONE})).not.toThrow()
  })

  // T-0005-133: leading rejects Stat kind
  it("leading rejects kind='stat' (T-0005-133)", () => {
    const statSlot = {kind: 'stat', node: {id: 'st1', type: 'Stat', value: '5', label: 'count'}}
    expect(() => ListItemSchema.parse({...LIST_ITEM_FIXTURE, leading: statSlot})).toThrow()
  })

  // T-0005-134: closed-enum rejection — 'invalid-icon' is not in the 80-name catalog.
  // IconNameSchema is now a z.enum([...80 values]); any name outside the closed set fails.
  it("leading icon with name='invalid-icon' fails (T-0005-134 — closed enum)", () => {
    expect(() =>
      ListItemSchema.parse({...LIST_ITEM_FIXTURE, leading: {kind: 'icon', name: 'invalid-icon'}}),
    ).toThrow()
  })

  it('trailing also accepts all slot kinds', () => {
    for (const slot of [SLOT_NONE, SLOT_ICON, SLOT_AVATAR, SLOT_BADGE]) {
      expect(() =>
        ListItemSchema.parse({...LIST_ITEM_FIXTURE, trailing: slot}),
      ).not.toThrow()
    }
  })

  it('rejects extra props (.strict())', () => {
    expect(() => ListItemSchema.parse({...LIST_ITEM_FIXTURE, swipeable: true})).toThrow()
  })
})

// ---- SwipeableRow ----

describe('SwipeableRowSchema', () => {
  it('parses minimal fixture', () => {
    expect(() => SwipeableRowSchema.parse(SWIPEABLE_ROW_FIXTURE)).not.toThrow()
  })

  it('fails when title is missing', () => {
    const {title: _t, ...rest} = SWIPEABLE_ROW_FIXTURE
    expect(() => SwipeableRowSchema.parse(rest)).toThrow()
  })

  it('accepts swipe action props', () => {
    expect(() =>
      SwipeableRowSchema.parse({
        ...SWIPEABLE_ROW_FIXTURE,
        leadingAction: TOAST_ACTION,
        leadingActionIcon: 'archive',
        leadingActionColor: 'success',
        trailingAction: {type: 'removeItem', collection: 'items', itemId: 'x'},
        trailingActionIcon: 'trash',
        trailingActionColor: 'danger',
      }),
    ).not.toThrow()
  })

  it('rejects invalid leadingActionColor', () => {
    expect(() =>
      SwipeableRowSchema.parse({...SWIPEABLE_ROW_FIXTURE, leadingActionColor: 'danger'}),
    ).toThrow()
  })

  it('rejects invalid trailingActionColor', () => {
    expect(() =>
      SwipeableRowSchema.parse({...SWIPEABLE_ROW_FIXTURE, trailingActionColor: 'accent'}),
    ).toThrow()
  })

  it('accepts Slot on leading and trailing', () => {
    expect(() =>
      SwipeableRowSchema.parse({
        ...SWIPEABLE_ROW_FIXTURE,
        leading: SLOT_ICON,
        trailing: SLOT_BADGE,
      }),
    ).not.toThrow()
  })

  it('rejects extra props (.strict())', () => {
    expect(() =>
      SwipeableRowSchema.parse({...SWIPEABLE_ROW_FIXTURE, loading: true}),
    ).toThrow()
  })
})

// ---- EmptyState ----

describe('EmptyStateSchema', () => {
  it('parses minimal fixture', () => {
    expect(() => EmptyStateSchema.parse(EMPTY_STATE_FIXTURE)).not.toThrow()
  })

  it('fails when icon is missing', () => {
    const {icon: _i, ...rest} = EMPTY_STATE_FIXTURE
    expect(() => EmptyStateSchema.parse(rest)).toThrow()
  })

  it('fails when headline is missing', () => {
    const {headline: _h, ...rest} = EMPTY_STATE_FIXTURE
    expect(() => EmptyStateSchema.parse(rest)).toThrow()
  })

  it('accepts optional body and action', () => {
    expect(() =>
      EmptyStateSchema.parse({
        ...EMPTY_STATE_FIXTURE,
        body: 'Create your first item.',
        actionLabel: 'Add',
        action: TOAST_ACTION,
      }),
    ).not.toThrow()
  })

  it('rejects empty icon name', () => {
    expect(() => EmptyStateSchema.parse({...EMPTY_STATE_FIXTURE, icon: ''})).toThrow()
  })

  it('rejects extra props (.strict())', () => {
    expect(() => EmptyStateSchema.parse({...EMPTY_STATE_FIXTURE, tone: 'warning'})).toThrow()
  })
})

// ---- LoadingState ----

describe('LoadingStateSchema', () => {
  it('parses minimal fixture', () => {
    expect(() => LoadingStateSchema.parse(LOADING_STATE_FIXTURE)).not.toThrow()
  })

  it('accepts optional lines', () => {
    expect(() =>
      LoadingStateSchema.parse({...LOADING_STATE_FIXTURE, lines: 5}),
    ).not.toThrow()
  })

  it('rejects lines: 0 (positive integer)', () => {
    expect(() => LoadingStateSchema.parse({...LOADING_STATE_FIXTURE, lines: 0})).toThrow()
  })

  it('rejects lines: 21 (max 20)', () => {
    expect(() => LoadingStateSchema.parse({...LOADING_STATE_FIXTURE, lines: 21})).toThrow()
  })

  it('rejects extra props (.strict())', () => {
    expect(() => LoadingStateSchema.parse({...LOADING_STATE_FIXTURE, shimmer: true})).toThrow()
  })
})

// ---------------------------------------------------------------------------
// V1 Phase 1 Step 4 — GridList, Carousel, Timeline, ErrorState
// T-0009-089..T-0009-110
// ---------------------------------------------------------------------------

const GRID_LIST_FIXTURE = {
  id: 'gl1',
  type: 'GridList' as const,
  collectionId: 'photos',
}

const CAROUSEL_COLLECTION_FIXTURE = {
  id: 'c1',
  type: 'Carousel' as const,
  collectionId: 'featured',
}

const CAROUSEL_CARDS_FIXTURE = {
  id: 'c2',
  type: 'Carousel' as const,
  cards: [{id: 'card1', type: 'Heading', text: 'Slide 1', level: 1}],
}

const TIMELINE_FIXTURE = {
  id: 't1',
  type: 'Timeline' as const,
  collectionId: 'events',
  dateField: 'createdAt',
}

const ERROR_STATE_FIXTURE = {
  id: 'err1',
  type: 'ErrorState' as const,
  headline: 'Something broke',
}

// ---- GridList (T-0009-089, T-0009-090) ----

describe('GridListSchema (T-0009-089, T-0009-090)', () => {
  // T-0009-089: Happy — collectionId + columns: 2 succeeds
  it('T-0009-089: parses with collectionId and columns: 2', () => {
    expect(() => GridListSchema.parse({...GRID_LIST_FIXTURE, columns: 2})).not.toThrow()
    expect(GridListSchema.parse({...GRID_LIST_FIXTURE, columns: 2}).columns).toBe(2)
  })

  it('parses minimal fixture (no optional fields)', () => {
    expect(() => GridListSchema.parse(GRID_LIST_FIXTURE)).not.toThrow()
  })

  it('accepts columns: 3', () => {
    expect(() => GridListSchema.parse({...GRID_LIST_FIXTURE, columns: 3})).not.toThrow()
  })

  // T-0009-090: Failure — columns: 4 rejects
  it('T-0009-090: rejects columns: 4 (only 2 or 3 allowed)', () => {
    expect(() => GridListSchema.parse({...GRID_LIST_FIXTURE, columns: 4})).toThrow()
  })

  it('rejects columns: 1', () => {
    expect(() => GridListSchema.parse({...GRID_LIST_FIXTURE, columns: 1})).toThrow()
  })

  it('accepts all itemAspectRatio values', () => {
    for (const itemAspectRatio of ['1:1', '4:5', '3:4'] as const) {
      expect(() => GridListSchema.parse({...GRID_LIST_FIXTURE, itemAspectRatio})).not.toThrow()
    }
  })

  it('rejects invalid itemAspectRatio', () => {
    expect(() => GridListSchema.parse({...GRID_LIST_FIXTURE, itemAspectRatio: '16:9'})).toThrow()
  })

  it('accepts all gap values', () => {
    for (const gap of ['space-none', 'space-xs', 'space-sm', 'space-md', 'space-lg', 'space-xl'] as const) {
      expect(() => GridListSchema.parse({...GRID_LIST_FIXTURE, gap})).not.toThrow()
    }
  })

  it('accepts optional emptyState and loadingState (unknown)', () => {
    expect(() => GridListSchema.parse({...GRID_LIST_FIXTURE, emptyState: {id: 'e1', type: 'EmptyState', icon: 'list', headline: 'Empty'}, loadingState: {id: 'l1', type: 'LoadingState'}})).not.toThrow()
  })

  it('fails when collectionId is missing', () => {
    const {collectionId: _c, ...rest} = GRID_LIST_FIXTURE
    expect(() => GridListSchema.parse(rest)).toThrow()
  })

  it('rejects extra props (.strict())', () => {
    expect(() => GridListSchema.parse({...GRID_LIST_FIXTURE, sortField: 'date'})).toThrow()
  })
})

// ---- Carousel (T-0009-092..T-0009-095) ----

describe('CarouselSchema (T-0009-092..T-0009-095)', () => {
  // T-0009-092: Happy — collectionId only
  it('T-0009-092: parses with collectionId only', () => {
    expect(() => CarouselSchema.parse(CAROUSEL_COLLECTION_FIXTURE)).not.toThrow()
  })

  // T-0009-093: Happy — cards only
  it('T-0009-093: parses with cards only', () => {
    expect(() => CarouselSchema.parse(CAROUSEL_CARDS_FIXTURE)).not.toThrow()
  })

  // T-0009-094: Failure — both collectionId and cards rejects
  it('T-0009-094: rejects when both collectionId and cards are set', () => {
    expect(() =>
      CarouselSchema.parse({
        id: 'c3',
        type: 'Carousel',
        collectionId: 'featured',
        cards: [{id: 'card1', type: 'Heading', text: 'Slide 1', level: 1}],
      }),
    ).toThrow('Carousel requires exactly one of collectionId or cards')
  })

  // T-0009-095: Failure — neither rejects
  it('T-0009-095: rejects when neither collectionId nor cards are set', () => {
    expect(() =>
      CarouselSchema.parse({
        id: 'c4',
        type: 'Carousel',
      }),
    ).toThrow('Carousel requires exactly one of collectionId or cards')
  })

  it('rejects when cards array is empty (treated as "neither")', () => {
    expect(() =>
      CarouselSchema.parse({
        id: 'c5',
        type: 'Carousel',
        cards: [],
      }),
    ).toThrow()
  })

  it('accepts indicator: dots, fraction, none', () => {
    for (const indicator of ['dots', 'fraction', 'none'] as const) {
      expect(() => CarouselSchema.parse({...CAROUSEL_COLLECTION_FIXTURE, indicator})).not.toThrow()
    }
  })

  it('accepts cardWidth: snap, peek, full', () => {
    for (const cardWidth of ['snap', 'peek', 'full'] as const) {
      expect(() => CarouselSchema.parse({...CAROUSEL_COLLECTION_FIXTURE, cardWidth})).not.toThrow()
    }
  })

  it('accepts autoplay: true and false', () => {
    expect(() => CarouselSchema.parse({...CAROUSEL_COLLECTION_FIXTURE, autoplay: true})).not.toThrow()
    expect(() => CarouselSchema.parse({...CAROUSEL_COLLECTION_FIXTURE, autoplay: false})).not.toThrow()
  })

  it('rejects cards with more than 10 items', () => {
    const tooManyCards = Array.from({length: 11}, (_, i) => ({id: `card${i}`, type: 'Heading', text: `Slide ${i}`, level: 1}))
    expect(() => CarouselSchema.parse({id: 'c6', type: 'Carousel', cards: tooManyCards})).toThrow()
  })

  it('rejects extra props (.strict())', () => {
    expect(() => CarouselSchema.parse({...CAROUSEL_COLLECTION_FIXTURE, snapDistance: 10})).toThrow()
  })
})

// ---- Timeline (T-0009-098) ----

describe('TimelineSchema (T-0009-098)', () => {
  // T-0009-098: Happy — collectionId + dateField succeeds
  it('T-0009-098: parses with collectionId and dateField', () => {
    expect(() => TimelineSchema.parse(TIMELINE_FIXTURE)).not.toThrow()
    const parsed = TimelineSchema.parse(TIMELINE_FIXTURE)
    expect(parsed.collectionId).toBe('events')
    expect(parsed.dateField).toBe('createdAt')
  })

  it('accepts all dateFormat values', () => {
    for (const dateFormat of ['relative', 'absolute', 'short'] as const) {
      expect(() => TimelineSchema.parse({...TIMELINE_FIXTURE, dateFormat})).not.toThrow()
    }
  })

  it('accepts all groupBy values', () => {
    for (const groupBy of ['none', 'day', 'week', 'month'] as const) {
      expect(() => TimelineSchema.parse({...TIMELINE_FIXTURE, groupBy})).not.toThrow()
    }
  })

  it('fails when collectionId is missing', () => {
    const {collectionId: _c, ...rest} = TIMELINE_FIXTURE
    expect(() => TimelineSchema.parse(rest)).toThrow()
  })

  it('fails when dateField is missing', () => {
    const {dateField: _d, ...rest} = TIMELINE_FIXTURE
    expect(() => TimelineSchema.parse(rest)).toThrow()
  })

  it('rejects invalid dateFormat', () => {
    expect(() => TimelineSchema.parse({...TIMELINE_FIXTURE, dateFormat: 'iso'})).toThrow()
  })

  it('rejects extra props (.strict())', () => {
    expect(() => TimelineSchema.parse({...TIMELINE_FIXTURE, itemHeight: 60})).toThrow()
  })
})

// T-0009-110: .todo — Timeline without dateField (when collectionId set) rejects
// at cross-ref validate. Cannot be implemented in Step 4; cross-ref validator
// extension (date_field_required code) is delivered in Step 8.
// Implemented in Step 8: see T-0009-189.
it.todo('T-0009-110: Timeline without dateField rejects at validateCrossRefs (Step 8: T-0009-189)')

// ---- ErrorState (T-0009-101..T-0009-104) ----

describe('ErrorStateSchema (T-0009-101..T-0009-104)', () => {
  // T-0009-101: Happy — headline only succeeds (uses default icon)
  it('T-0009-101: parses with headline only (uses default icon in renderer)', () => {
    expect(() => ErrorStateSchema.parse(ERROR_STATE_FIXTURE)).not.toThrow()
  })

  it('accepts explicit icon from the closed catalog', () => {
    expect(() =>
      ErrorStateSchema.parse({...ERROR_STATE_FIXTURE, icon: 'alert-triangle'}),
    ).not.toThrow()
  })

  it('accepts body and actionLabel and action', () => {
    expect(() =>
      ErrorStateSchema.parse({
        ...ERROR_STATE_FIXTURE,
        body: 'Check your connection and try again.',
        actionLabel: 'Retry',
        action: {type: 'toast', message: 'Retrying...', tone: 'warning'},
      }),
    ).not.toThrow()
  })

  it('fails when headline is missing', () => {
    const {headline: _h, ...rest} = ERROR_STATE_FIXTURE
    expect(() => ErrorStateSchema.parse(rest)).toThrow()
  })

  it('rejects headline over 200 chars', () => {
    expect(() => ErrorStateSchema.parse({...ERROR_STATE_FIXTURE, headline: 'x'.repeat(201)})).toThrow()
  })

  it('rejects body over 400 chars', () => {
    expect(() => ErrorStateSchema.parse({...ERROR_STATE_FIXTURE, body: 'x'.repeat(401)})).toThrow()
  })

  it('rejects actionLabel over 80 chars', () => {
    expect(() => ErrorStateSchema.parse({...ERROR_STATE_FIXTURE, actionLabel: 'x'.repeat(81)})).toThrow()
  })

  it('rejects extra props (.strict())', () => {
    expect(() => ErrorStateSchema.parse({...ERROR_STATE_FIXTURE, tone: 'danger'})).toThrow()
  })

  it('accepts Unicode headline — "José García rejects O\'Brien"', () => {
    expect(() => ErrorStateSchema.parse({...ERROR_STATE_FIXTURE, headline: 'Fehler: José García'})).not.toThrow()
    expect(() => ErrorStateSchema.parse({...ERROR_STATE_FIXTURE, headline: '错误：无法连接'})).not.toThrow()
    expect(() => ErrorStateSchema.parse({...ERROR_STATE_FIXTURE, headline: "O'Brien connection failed"})).not.toThrow()
  })
})

// ---- T-0005-140: Legacy M1 component type regression ----

describe('Legacy M1 component type rejection (T-0005-140)', () => {
  // M1 components that are NOT in the 28-component V0 catalog.
  // These are component-level rejections verified through the ListItem
  // slot schema or through attempting to parse any V0 schema with the
  // wrong type. The definitive test is that no V0 schema accepts type: 'Counter'.
  const legacyTypes = ['Counter', 'Toggle', 'TextInput', 'Form', 'Container']

  test.each(legacyTypes)('%s type is not a valid ListItem type', legacyType => {
    expect(() =>
      ListItemSchema.parse({...LIST_ITEM_FIXTURE, type: legacyType}),
    ).toThrow()
  })

  test.each(legacyTypes)('%s type is not a valid List type', legacyType => {
    expect(() => ListSchema.parse({...LIST_FIXTURE, type: legacyType})).toThrow()
  })
})
