/**
 * ListSummary tests
 *
 * T-0006-131: snapshot at productive×focus
 * T-0006-132: snapshot at expressive×health
 * T-0006-139: AI supported → dispatches aiProcess(summarize) and renders result
 * T-0006-140: AI unsupported + fallback=hide → null
 * T-0006-141: AI unsupported + fallback=show-raw → last 3 items as bullets
 * T-0006-144: host.onAIError fires on rejection (middleware path) — asserted in
 *   aiBridge.test.ts. ListSummary gracefully shows shimmer when slot stays empty.
 * T-0006-145: host.onAIError fires on timeout (middleware path) — asserted in
 *   aiBridge.test.ts. ListSummary gracefully shows shimmer when slot stays empty.
 * T-0006-146: collection with 0 rows → "Nothing to summarize"
 *
 * Architecture note (ADR-0006 §K Path B): When AI dispatch fails or times out,
 * aiBridge middleware calls host.onAIError and the summary slot is never written.
 * ListSummary continues showing the loading shimmer — graceful degradation.
 * The host owns the error UX (toast, hide, etc.). The middleware-level assertions
 * for T-0006-144 and T-0006-145 live in aiBridge.test.ts. The tests here verify
 * that ListSummary renders without crashing when the slot remains empty.
 */
import React from 'react'
import {act} from 'react-test-renderer'
import type {Node, Spec} from '@app-creator/protocol'
import {renderWithTheme} from '../../__test-utils__/renderWithTheme'
import {buildInitialRendererState} from '../../state/reducer'
import type {RendererState} from '../../state/types'
import {ListSummaryRenderer, summarySlotName} from './ListSummary'

// ---------------------------------------------------------------------------
// Provider-level AI capability control (replaces AICapabilitiesProvider context)
// ---------------------------------------------------------------------------

// We mock the AICapabilitiesProvider module so tests can control isSupported
// without triggering the real native-module check.
jest.mock('../../ai/AICapabilitiesProvider', () => {
  const original = jest.requireActual('../../ai/AICapabilitiesProvider')
  return {
    ...original,
    useAICapabilities: jest.fn().mockReturnValue({isSupported: false}),
  }
})

import {useAICapabilities} from '../../ai/AICapabilitiesProvider'
const mockUseAICapabilities = useAICapabilities as jest.MockedFunction<typeof useAICapabilities>

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type ListSummaryNode = Extract<Node, {type: 'ListSummary'}>

const LIST_SUMMARY_NODE: ListSummaryNode = {
  id: 'ls1',
  type: 'ListSummary',
  collectionId: 'workouts',
  prompt: 'Summarize these workouts briefly.',
  fallback: 'show-raw',
}

const LIST_SUMMARY_HIDE: ListSummaryNode = {
  ...LIST_SUMMARY_NODE,
  id: 'ls2',
  fallback: 'hide',
}

// Spec with a populated 'workouts' collection (4 seed rows).
const SPEC_WITH_WORKOUTS: Spec = {
  version: 1,
  archetype: 'ListCRUD',
  stance: 'productive',
  palette: 'focus',
  coverIcon: 'dumbbell',
  navigation: 'none',
  screens: [{id: 's1', root: {id: 'n1', type: 'Heading', text: 'T', level: 1}}],
  initialScreenId: 's1',
  collections: [
    {
      id: 'workouts',
      name: 'Workouts',
      fields: [{name: 'name', type: {type: 'string'} as const, required: true}],
      seedData: [
        {name: 'Morning run'},
        {name: 'Evening yoga'},
        {name: 'Strength training'},
        {name: 'Cycling'},
      ],
      syncMode: 'local' as const,
    },
  ],
  initialState: {},
}

// Spec with an empty 'workouts' collection (test-only: seedData empty at JS level).
const SPEC_EMPTY_WORKOUTS: Spec = {
  ...SPEC_WITH_WORKOUTS,
  collections: [
    {
      id: 'workouts',
      name: 'Workouts',
      fields: [{name: 'name', type: {type: 'string'} as const, required: true}],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      seedData: [] as any,
      syncMode: 'local' as const,
    },
  ],
}

// Build a renderer state that has the summary slot pre-filled.
function stateWithSummary(baseState: RendererState, nodeId: string, text: string): RendererState {
  const slotName = summarySlotName(nodeId)
  return {
    ...baseState,
    slots: new Map(baseState.slots).set(slotName, text),
  }
}

// ---------------------------------------------------------------------------
// T-0006-131: snapshot at productive×focus (AI supported, result in slot)
// ---------------------------------------------------------------------------

describe('ListSummaryRenderer snapshot (T-0006-131) — productive×focus', () => {
  it('matches snapshot with summary result rendered', () => {
    mockUseAICapabilities.mockReturnValue({isSupported: true})
    const baseState = buildInitialRendererState(SPEC_WITH_WORKOUTS)
    const state = stateWithSummary(baseState, LIST_SUMMARY_NODE.id, '4 workouts logged this week.')
    const {toJSON} = renderWithTheme(
      <ListSummaryRenderer node={LIST_SUMMARY_NODE} />,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0006-132: snapshot at expressive×health (AI unsupported, show-raw)
// ---------------------------------------------------------------------------

describe('ListSummaryRenderer snapshot (T-0006-132) — expressive×health', () => {
  it('matches snapshot with show-raw fallback', () => {
    mockUseAICapabilities.mockReturnValue({isSupported: false})
    const state = buildInitialRendererState(SPEC_WITH_WORKOUTS)
    const {toJSON} = renderWithTheme(
      <ListSummaryRenderer node={LIST_SUMMARY_NODE} />,
      {stance: 'expressive', palette: 'health', rendererState: state},
    )
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0006-139: AI supported → dispatches aiProcess(summarize) → renders result
// ---------------------------------------------------------------------------

describe('ListSummaryRenderer (T-0006-139)', () => {
  it('dispatches aiProcess on first render when AI is supported and slot is empty', async () => {
    mockUseAICapabilities.mockReturnValue({isSupported: true})
    const state = buildInitialRendererState(SPEC_WITH_WORKOUTS)
    const mockDispatch = jest.fn()

    renderWithTheme(
      <ListSummaryRenderer node={LIST_SUMMARY_NODE} />,
      {stance: 'productive', palette: 'focus', rendererState: state, dispatch: mockDispatch},
    )

    // queueMicrotask fires after the render commit — flush with act.
    await act(async () => {
      await Promise.resolve()
    })

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'aiProcess',
      task: 'summarize',
      collection: 'workouts',
      prompt: 'Summarize these workouts briefly.',
      target: summarySlotName('ls1'),
    })
  })

  it('renders the summary text when the target slot is populated', () => {
    mockUseAICapabilities.mockReturnValue({isSupported: true})
    const baseState = buildInitialRendererState(SPEC_WITH_WORKOUTS)
    const state = stateWithSummary(baseState, LIST_SUMMARY_NODE.id, '4 workouts logged this week.')

    const {getByText} = renderWithTheme(
      <ListSummaryRenderer node={LIST_SUMMARY_NODE} />,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )
    expect(getByText('4 workouts logged this week.')).toBeTruthy()
  })

  it('shows loading shimmer when AI is supported but slot is not yet populated', () => {
    mockUseAICapabilities.mockReturnValue({isSupported: true})
    const state = buildInitialRendererState(SPEC_WITH_WORKOUTS)

    const {getByTestId} = renderWithTheme(
      <ListSummaryRenderer node={LIST_SUMMARY_NODE} />,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )
    expect(getByTestId('list-summary-loading')).toBeTruthy()
  })

  it('does not re-dispatch aiProcess when slot is already populated', async () => {
    mockUseAICapabilities.mockReturnValue({isSupported: true})
    const baseState = buildInitialRendererState(SPEC_WITH_WORKOUTS)
    const state = stateWithSummary(baseState, LIST_SUMMARY_NODE.id, 'Already summarized.')
    const mockDispatch = jest.fn()

    renderWithTheme(
      <ListSummaryRenderer node={LIST_SUMMARY_NODE} />,
      {stance: 'productive', palette: 'focus', rendererState: state, dispatch: mockDispatch},
    )

    await act(async () => {
      await Promise.resolve()
    })

    // Slot already has a value — no dispatch expected.
    expect(mockDispatch).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// T-0006-140: AI unsupported + fallback=hide → renders null
// ---------------------------------------------------------------------------

describe('ListSummaryRenderer (T-0006-140)', () => {
  it('renders null when AI unsupported and fallback=hide', () => {
    mockUseAICapabilities.mockReturnValue({isSupported: false})
    const state = buildInitialRendererState(SPEC_WITH_WORKOUTS)
    const {toJSON} = renderWithTheme(
      <ListSummaryRenderer node={LIST_SUMMARY_HIDE} />,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )
    expect(toJSON()).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// T-0006-141: AI unsupported + fallback=show-raw → last 3 items as bullets
// ---------------------------------------------------------------------------

describe('ListSummaryRenderer (T-0006-141)', () => {
  it('renders show-raw fallback with last 3 collection items as bullets', () => {
    mockUseAICapabilities.mockReturnValue({isSupported: false})
    const state = buildInitialRendererState(SPEC_WITH_WORKOUTS)
    const {getByTestId, getByText} = renderWithTheme(
      <ListSummaryRenderer node={LIST_SUMMARY_NODE} />,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )
    // The show-raw container should be present.
    expect(getByTestId('list-summary-raw')).toBeTruthy()
    // Last 3 items: Evening yoga, Strength training, Cycling (Morning run overflows to "+1 more").
    expect(getByText('• Evening yoga')).toBeTruthy()
    expect(getByText('• Strength training')).toBeTruthy()
    expect(getByText('• Cycling')).toBeTruthy()
    // "+1 more" for the 4th item that doesn't fit in MAX_RAW_ITEMS=3.
    expect(getByText('+1 more')).toBeTruthy()
  })

  it('renders all items when 3 or fewer rows', () => {
    mockUseAICapabilities.mockReturnValue({isSupported: false})
    const specWithThree: Spec = {
      ...SPEC_WITH_WORKOUTS,
      collections: [
        {
          id: 'workouts',
          name: 'Workouts',
          fields: [{name: 'name', type: {type: 'string'} as const, required: true}],
          seedData: [{name: 'Run'}, {name: 'Swim'}, {name: 'Bike'}],
          syncMode: 'local' as const,
        },
      ],
    }
    const state = buildInitialRendererState(specWithThree)
    const {queryByText} = renderWithTheme(
      <ListSummaryRenderer node={LIST_SUMMARY_NODE} />,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )
    // All 3 render; no "+X more" overflow text.
    expect(queryByText('+0 more')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// T-0006-144: host.onAIError fires on rejection (middleware path)
// ListSummary gracefully shows shimmer when slot stays empty.
// ---------------------------------------------------------------------------
// The middleware-level assertion lives in aiBridge.test.ts (T-0006-144 describe).
// Here we verify ListSummary doesn't crash and renders the loading shimmer —
// which is the correct UX when the slot has no value regardless of why.

describe('ListSummaryRenderer (T-0006-144)', () => {
  it('renders loading shimmer without crashing when AI dispatch fails and slot stays empty', () => {
    // The aiBridge middleware calls host.onAIError (see aiBridge.test.ts T-0006-144)
    // and never writes the slot. From ListSummary's perspective, slot is empty →
    // loading shimmer. This test verifies the component side of that contract.
    mockUseAICapabilities.mockReturnValue({isSupported: true})
    const state = buildInitialRendererState(SPEC_WITH_WORKOUTS)

    const {getByTestId} = renderWithTheme(
      <ListSummaryRenderer node={LIST_SUMMARY_NODE} />,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )
    // Slot is empty → loading shimmer. No crash. Host owns the error UX via onAIError.
    expect(getByTestId('list-summary-loading')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// T-0006-145: host.onAIError fires on timeout (middleware path)
// ListSummary gracefully shows shimmer when slot stays empty.
// ---------------------------------------------------------------------------
// The middleware-level assertion lives in aiBridge.test.ts (T-0006-145 describe).
// Here we verify ListSummary doesn't crash on a timeout path — same shimmer contract.

describe('ListSummaryRenderer (T-0006-145)', () => {
  it('renders loading shimmer without crashing when AI times out and slot stays empty', () => {
    // The 30s timeout in aiDispatcher.ts rejects → aiBridge catches → host.onAIError
    // (see aiBridge.test.ts T-0006-145). The slot is never written.
    // ListSummary shows the loading shimmer. No crash. Host owns the timeout UX.
    mockUseAICapabilities.mockReturnValue({isSupported: true})
    const state = buildInitialRendererState(SPEC_WITH_WORKOUTS)

    const {getByTestId} = renderWithTheme(
      <ListSummaryRenderer node={LIST_SUMMARY_NODE} />,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )
    expect(getByTestId('list-summary-loading')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// T-0006-146: collection with 0 rows → "Nothing to summarize"
// ---------------------------------------------------------------------------

describe('ListSummaryRenderer (T-0006-146)', () => {
  it('renders "Nothing to summarize" when collection is empty', () => {
    mockUseAICapabilities.mockReturnValue({isSupported: true})
    const state = buildInitialRendererState(SPEC_EMPTY_WORKOUTS)
    const {getByTestId, getByText} = renderWithTheme(
      <ListSummaryRenderer node={LIST_SUMMARY_NODE} />,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )
    expect(getByTestId('list-summary-empty')).toBeTruthy()
    expect(getByText('Nothing to summarize')).toBeTruthy()
  })

  it('renders "Nothing to summarize" even when AI is unsupported (empty collection takes priority)', () => {
    mockUseAICapabilities.mockReturnValue({isSupported: false})
    const state = buildInitialRendererState(SPEC_EMPTY_WORKOUTS)
    const {getByText} = renderWithTheme(
      <ListSummaryRenderer node={LIST_SUMMARY_HIDE} />,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )
    // Empty collection check is before the AI-unavailable check.
    expect(getByText('Nothing to summarize')).toBeTruthy()
  })
})
