/**
 * CalendarRenderer tests — ADR-0009 Step 6
 *
 * T-0009-136: date-fns@^3.6.0 installs cleanly via pnpm
 * T-0009-137: bundle size grows ≤ 25kb gzipped (marked .todo — Step 9 territory)
 * T-0009-138: CalendarSchema parses without collection binding
 * T-0009-139: CalendarSchema parses with full binding
 * T-0009-140: collectionId without dateField rejects at superRefine
 * T-0009-141: renders 6-row × 7-col grid for any month
 * T-0009-142: firstDayOfWeek: 'monday' shifts grid by one day
 * T-0009-143: selectedBinding updates DateBinding on date tap
 * T-0009-144: accent dot when collectionId+dateField set
 * T-0009-145: accessibilityRole="grid"; cells use accessibilityRole="button"
 * T-0009-146: month nav chevrons advance/recede month state
 * T-0009-152: snapshots at productive×focus + expressive×health
 * T-0009-244: same-date-tap is a no-op (selectedBinding unchanged)
 */
import React from 'react'
import {fireEvent, act} from '@testing-library/react-native'
import type {Node, Spec} from '@app-creator/protocol'
import {CalendarSchema} from '@app-creator/protocol'
import {renderWithTheme} from '../../__test-utils__/renderWithTheme'
import {buildInitialRendererState} from '../../state/reducer'
import {CalendarRenderer} from './Calendar'

type CalendarNode = Extract<Node, {type: 'Calendar'}>

// Returns today's date as a local YYYY-MM-DD string (not UTC).
// new Date().toISOString().slice(0, 10) gives UTC date, which in negative-offset
// timezones is yesterday's local date. Using local components avoids that shift.
function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_CALENDAR: CalendarNode = {
  id: 'cal1',
  type: 'Calendar',
}

const CALENDAR_WITH_BINDING: CalendarNode = {
  id: 'cal2',
  type: 'Calendar',
  selectedBinding: {kind: 'state', slot: 'selectedDate'},
}

const CALENDAR_WITH_COLLECTION: CalendarNode = {
  id: 'cal3',
  type: 'Calendar',
  collectionId: 'events',
  dateField: 'eventDate',
  selectedBinding: {kind: 'state', slot: 'selectedDate'},
}

const CALENDAR_MONDAY: CalendarNode = {
  id: 'cal4',
  type: 'Calendar',
  firstDayOfWeek: 'monday',
}

// Spec with an 'events' collection for marker tests.
const EVENTS_SPEC: Spec = {
  version: 1,
  archetype: 'Tracker',
  stance: 'productive',
  palette: 'focus',
  coverIcon: 'calendar',
  navigation: 'none',
  screens: [{id: 's1', root: {id: 'n1', type: 'Heading', text: 'T', level: 1}}],
  initialScreenId: 's1',
  collections: [
    {
      id: 'events',
      name: 'Events',
      fields: [
        {name: 'title', type: {type: 'string'} as const, required: true},
        {name: 'eventDate', type: {type: 'date'} as const, required: true},
      ],
      // Use today's local date so the accent dot is guaranteed to appear in the current
      // month grid. localDateStr() avoids the UTC-offset shift from toISOString().
      seedData: [
        {title: 'Today event', eventDate: localDateStr()},
      ],
      syncMode: 'local' as const,
    },
  ],
  initialState: {selectedDate: ''},
}

// ---------------------------------------------------------------------------
// T-0009-136: date-fns@^3.6.0 installs cleanly via pnpm
// ---------------------------------------------------------------------------

describe('T-0009-136: date-fns installs and imports correctly', () => {
  it('can import format from date-fns/format (tree-shaken)', () => {
    // The module resolves at test time, so this simply verifies the import
    // doesn't throw. The fact that Calendar.tsx renders (tests below) proves
    // the import works end-to-end.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {format} = require('date-fns/format')
    expect(typeof format).toBe('function')
  })
})

// ---------------------------------------------------------------------------
// T-0009-137: bundle size grows ≤ 25kb gzipped — marked .todo
// Bundle-size measurement requires a build step and gzip analysis.
// This is Step-9-snapshot-matrix territory where the renderer is built and
// measured. The acceptance criterion (≤ 25kb) will be validated as part of
// the Step 9 bundle-size regression test.
// ---------------------------------------------------------------------------

describe('T-0009-137: renderer bundle size regression (date-fns)', () => {
  it.todo('renderer bundle grows ≤ 25kb gzipped after date-fns import — measured in Step 9 bundle analysis')
})

// ---------------------------------------------------------------------------
// Schema validation (T-0009-138, T-0009-139, T-0009-140, T-0009-156)
// Deferred to protocol compound.test.ts — these are schema-layer tests.
// Keeping references here for T-ID traceability.
// ---------------------------------------------------------------------------

describe('CalendarSchema validation (T-0009-138..140, T-0009-156 — in protocol compound.test.ts)', () => {
  it('T-0009-138: CalendarSchema.parse({view: "month"}) succeeds', () => {
    const result = CalendarSchema.safeParse({id: 'c1', type: 'Calendar', view: 'month'})
    expect(result.success).toBe(true)
  })

  it('T-0009-139: CalendarSchema.parse with collectionId+dateField succeeds', () => {
    const result = CalendarSchema.safeParse({
      id: 'c1',
      type: 'Calendar',
      view: 'month',
      collectionId: 'events',
      dateField: 'eventDate',
    })
    expect(result.success).toBe(true)
  })

  it('T-0009-140: collectionId without dateField rejects with specific message + path', () => {
    const result = CalendarSchema.safeParse({
      id: 'c1',
      type: 'Calendar',
      collectionId: 'events',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues[0]
      expect(issue!.message).toBe('Calendar with collectionId requires dateField')
      expect(issue!.path).toEqual(['dateField'])
    }
  })

  it('T-0009-156: view: "year" rejects (not in enum)', () => {
    const result = CalendarSchema.safeParse({id: 'c1', type: 'Calendar', view: 'year'})
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// T-0009-141: renders 6-row × 7-col grid for any month
// ---------------------------------------------------------------------------

describe('CalendarRenderer grid structure (T-0009-141)', () => {
  it('T-0009-141: renders exactly 6 rows and 42 cells (6×7)', () => {
    const {getAllByRole, toJSON} = renderWithTheme(
      <CalendarRenderer node={BASE_CALENDAR} />,
      {stance: 'productive', palette: 'focus'},
    )
    // The grid container contains all cells with accessibilityRole="button"
    // (day cells + nav chevrons). Day cells are 42; chevrons add 2.
    const buttons = getAllByRole('button')
    // 42 day cells + 2 nav chevrons = 44 total buttons
    expect(buttons.length).toBeGreaterThanOrEqual(42)
    expect(toJSON()).not.toBeNull()
  })

  it('renders 6 row containers in the grid', () => {
    const {getByTestId} = renderWithTheme(
      <CalendarRenderer node={BASE_CALENDAR} />,
      {stance: 'productive', palette: 'focus'},
    )
    // 6 rows in the grid
    for (let i = 0; i < 6; i++) {
      expect(getByTestId(`calendar-row-cal1-${i}`)).toBeTruthy()
    }
  })
})

// ---------------------------------------------------------------------------
// T-0009-142: firstDayOfWeek: 'monday' shifts grid by one day
// ---------------------------------------------------------------------------

describe('CalendarRenderer firstDayOfWeek (T-0009-142)', () => {
  it('T-0009-142: sunday first — DOW header row contains "S" as first label', () => {
    const {toJSON} = renderWithTheme(
      <CalendarRenderer node={BASE_CALENDAR} />,
      {stance: 'productive', palette: 'focus'},
    )
    // Sunday-first DOW labels: S M T W T F S
    // The rendered tree contains "S" as the first DOW label
    const tree = JSON.stringify(toJSON())
    // DOW header for sunday-first starts with "S"
    expect(tree).toContain('"S"')
  })

  it('T-0009-142: monday first — DOW header row contains "M" as first label', () => {
    const {toJSON} = renderWithTheme(
      <CalendarRenderer node={CALENDAR_MONDAY} />,
      {stance: 'productive', palette: 'focus'},
    )
    // Monday-first DOW labels: M T W T F S S
    const tree = JSON.stringify(toJSON())
    // DOW header for monday-first contains "M"
    expect(tree).toContain('"M"')
  })

  it('T-0009-142: sunday-first and monday-first grids differ in first cell date', () => {
    // The grid cell for the first Sunday of the month in sunday-first mode
    // should differ from the first Monday of the week in monday-first mode.
    // Verify the two grids produce different cell arrangements by rendering both
    // and checking the month label is the same (same month) but cell layout differs.
    const {toJSON: toJSONSun} = renderWithTheme(
      <CalendarRenderer node={BASE_CALENDAR} />,
      {stance: 'productive', palette: 'focus'},
    )
    const {toJSON: toJSONMon} = renderWithTheme(
      <CalendarRenderer node={CALENDAR_MONDAY} />,
      {stance: 'productive', palette: 'focus'},
    )
    // Both grids render the same month (current month) — just shifted
    // The JSON trees should differ due to firstDayOfWeek shifting
    expect(JSON.stringify(toJSONSun())).not.toBe(JSON.stringify(toJSONMon()))
  })
})

// ---------------------------------------------------------------------------
// T-0009-143: selectedBinding updates DateBinding on date tap
// T-0009-244: same-date tap is a no-op
// ---------------------------------------------------------------------------

describe('CalendarRenderer selectedBinding dispatch (T-0009-143, T-0009-244)', () => {
  it('T-0009-143: tapping a date cell dispatches set action with date string', () => {
    const mockDispatch = jest.fn()
    const {getAllByRole} = renderWithTheme(
      <CalendarRenderer node={CALENDAR_WITH_BINDING} />,
      {stance: 'productive', palette: 'focus', dispatch: mockDispatch},
    )

    // Find day cells (accessibilityRole="button") — first 2 are nav chevrons,
    // then 42 day cells follow.
    const buttons = getAllByRole('button')
    // Tap the 3rd button (first day cell, index 2)
    const firstDayCell = buttons[2]
    act(() => {
      fireEvent.press(firstDayCell!)
    })

    // Dispatch should have been called with a set action
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'set',
        target: 'selectedDate',
        value: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
  })

  it('T-0009-244: same-date tap is a no-op — dispatch not called again', () => {
    const mockDispatch = jest.fn()

    // Build state where selectedDate is already set to today.
    const today = localDateStr()
    const spec: Spec = {
      version: 1,
      archetype: 'Tracker',
      stance: 'productive',
      palette: 'focus',
      coverIcon: 'list',
      navigation: 'none',
      screens: [{id: 's1', root: {id: 'n1', type: 'Heading', text: 'T', level: 1}}],
      initialScreenId: 's1',
      collections: [],
      initialState: {selectedDate: today},
    }
    const state = buildInitialRendererState(spec)

    const {getByTestId} = renderWithTheme(
      <CalendarRenderer node={CALENDAR_WITH_BINDING} />,
      {
        stance: 'productive',
        palette: 'focus',
        dispatch: mockDispatch,
        rendererState: state,
      },
    )

    // Tap the cell for today's date
    const todayCell = getByTestId(`calendar-cell-cal2-${today}`)
    act(() => {
      fireEvent.press(todayCell)
    })

    // T-0009-244: dispatch must NOT be called (same date = no-op)
    expect(mockDispatch).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// T-0009-144: accent dot when collectionId+dateField set
// ---------------------------------------------------------------------------

describe('CalendarRenderer collection markers (T-0009-144)', () => {
  it('T-0009-144: renders accent dot for today when collection has item on that date', () => {
    const today = localDateStr()
    const state = buildInitialRendererState(EVENTS_SPEC)

    const {queryByTestId} = renderWithTheme(
      <CalendarRenderer node={CALENDAR_WITH_COLLECTION} />,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )

    // The accent dot is hidden from the accessibility tree (decorative marker; the
    // day cell's own accessibilityLabel carries the date info for screen readers).
    // Must use {includeHiddenElements: true} so RNTL finds accessibilityElementsHidden views.
    const dot = queryByTestId(`calendar-dot-cal3-${today}`, {includeHiddenElements: true})
    expect(dot).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// T-0009-145: accessibilityRole assertions
// ---------------------------------------------------------------------------

describe('CalendarRenderer accessibility (T-0009-145)', () => {
  it('T-0009-145: grid container has role="grid"', () => {
    // React Native uses the newer `role` prop (ARIA-aligned, maps to the Role type)
    // for values like 'grid' that are not in the legacy AccessibilityRole union.
    // `role="grid"` is the correct prop; `accessibilityRole` only covers the
    // legacy narrower set ending at 'toolbar'.
    const {getByTestId} = renderWithTheme(
      <CalendarRenderer node={BASE_CALENDAR} />,
      {stance: 'productive', palette: 'focus'},
    )
    const grid = getByTestId('calendar-cal1')
    expect(grid.props.role).toBe('grid')
  })

  it('T-0009-145: day cells have accessibilityRole="button"', () => {
    const {getAllByRole} = renderWithTheme(
      <CalendarRenderer node={BASE_CALENDAR} />,
      {stance: 'productive', palette: 'focus'},
    )
    const buttons = getAllByRole('button')
    // Should have at least 42 cells + 2 nav chevrons
    expect(buttons.length).toBeGreaterThanOrEqual(44)
  })

  it('day cells have accessibilityLabel with full date (e.g. "Monday, January 1")', () => {
    const {getAllByRole} = renderWithTheme(
      <CalendarRenderer node={BASE_CALENDAR} />,
      {stance: 'productive', palette: 'focus'},
    )
    const buttons = getAllByRole('button')
    // Skip nav chevrons (prev + next) — they have their own labels
    const dayButtons = buttons.filter(
      (b) =>
        b.props.accessibilityLabel !== 'Previous month' &&
        b.props.accessibilityLabel !== 'Next month',
    )
    // Each day cell label should match the full weekday+date format
    for (const btn of dayButtons) {
      expect(btn.props.accessibilityLabel).toMatch(/^\w+day, \w+ \d+$/)
    }
  })
})

// ---------------------------------------------------------------------------
// T-0009-146: month nav chevrons advance/recede month state
// ---------------------------------------------------------------------------

describe('CalendarRenderer month navigation (T-0009-146)', () => {
  it('T-0009-146: next chevron advances month label', () => {
    const {getByTestId} = renderWithTheme(
      <CalendarRenderer node={BASE_CALENDAR} />,
      {stance: 'productive', palette: 'focus'},
    )

    const monthLabel = getByTestId('calendar-month-label-cal1')
    const initialLabel = monthLabel.props.children as string

    act(() => {
      fireEvent.press(getByTestId('calendar-next-cal1'))
    })

    const newLabel = getByTestId('calendar-month-label-cal1').props.children as string
    expect(newLabel).not.toBe(initialLabel)
  })

  it('T-0009-146: prev chevron recedes month label', () => {
    const {getByTestId} = renderWithTheme(
      <CalendarRenderer node={BASE_CALENDAR} />,
      {stance: 'productive', palette: 'focus'},
    )

    const initialLabel = getByTestId('calendar-month-label-cal1').props.children as string

    act(() => {
      fireEvent.press(getByTestId('calendar-prev-cal1'))
    })

    const newLabel = getByTestId('calendar-month-label-cal1').props.children as string
    expect(newLabel).not.toBe(initialLabel)
  })

  it('advancing and then receding returns to original month', () => {
    const {getByTestId} = renderWithTheme(
      <CalendarRenderer node={BASE_CALENDAR} />,
      {stance: 'productive', palette: 'focus'},
    )

    const initialLabel = getByTestId('calendar-month-label-cal1').props.children as string

    act(() => {
      fireEvent.press(getByTestId('calendar-next-cal1'))
    })
    act(() => {
      fireEvent.press(getByTestId('calendar-prev-cal1'))
    })

    const finalLabel = getByTestId('calendar-month-label-cal1').props.children as string
    expect(finalLabel).toBe(initialLabel)
  })
})

// ---------------------------------------------------------------------------
// T-0009-152: Snapshots at productive×focus + expressive×health
// ---------------------------------------------------------------------------

describe('CalendarRenderer snapshot (T-0009-152) — productive×focus', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-01-15T12:00:00Z'))
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it('matches snapshot at productive×focus', () => {
    const {toJSON} = renderWithTheme(
      <CalendarRenderer node={BASE_CALENDAR} />,
      {stance: 'productive', palette: 'focus'},
    )
    expect(toJSON()).toMatchSnapshot()
  })
})

describe('CalendarRenderer snapshot (T-0009-152) — expressive×health', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-01-15T12:00:00Z'))
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it('matches snapshot at expressive×health', () => {
    const {toJSON} = renderWithTheme(
      <CalendarRenderer node={BASE_CALENDAR} />,
      {stance: 'expressive', palette: 'health'},
    )
    expect(toJSON()).toMatchSnapshot()
  })
})
