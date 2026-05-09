/**
 * Lists component schema tests — T-0005-072..097, T-0005-098..125,
 * T-0005-129..134 (Slot), T-0005-140 (legacy M1 breaking)
 * Components: List, ListItem, SwipeableRow, EmptyState, LoadingState (5 lists tier)
 */
import {
  ListSchema,
  ListItemSchema,
  SwipeableRowSchema,
  EmptyStateSchema,
  LoadingStateSchema,
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
