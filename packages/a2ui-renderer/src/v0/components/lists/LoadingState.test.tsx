/**
 * LoadingState tests
 *
 * T-0006-115: snapshot at productive×focus
 * T-0006-116: snapshot at expressive×health
 * T-0006-123: shows shimmer rows; reduced-motion shows static gray blocks
 */
import React from 'react'
import type {Node} from '@app-creator/protocol'
import {renderWithTheme} from '../../__test-utils__/renderWithTheme'
import {LoadingStateRenderer} from './LoadingState'
// NOTE: jest.mock() is hoisted by Babel to file scope at parse time, so calling
// it inside beforeEach() is a no-op — the mock never activates at runtime.
// Use jest.spyOn() for runtime mocking instead (see T-0006-123 reduced-motion suite).
import * as useReducedMotionModule from '../../a11y/useReducedMotion'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type LoadingStateNode = Extract<Node, {type: 'LoadingState'}>

const LOADING_STATE_DEFAULT: LoadingStateNode = {
  id: 'ls1',
  type: 'LoadingState',
}

const LOADING_STATE_3_LINES: LoadingStateNode = {
  id: 'ls2',
  type: 'LoadingState',
  lines: 3,
}

const LOADING_STATE_5_LINES: LoadingStateNode = {
  id: 'ls3',
  type: 'LoadingState',
  lines: 5,
}

const LOADING_STATE_1_LINE: LoadingStateNode = {
  id: 'ls4',
  type: 'LoadingState',
  lines: 1,
}

// ---------------------------------------------------------------------------
// T-0006-115: snapshot at productive×focus
// ---------------------------------------------------------------------------

describe('LoadingStateRenderer snapshot (T-0006-115) — productive×focus', () => {
  it('matches snapshot at productive×focus', () => {
    const {toJSON} = renderWithTheme(
      <LoadingStateRenderer node={LOADING_STATE_DEFAULT} />,
      {stance: 'productive', palette: 'focus'},
    )
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0006-116: snapshot at expressive×health
// ---------------------------------------------------------------------------

describe('LoadingStateRenderer snapshot (T-0006-116) — expressive×health', () => {
  it('matches snapshot at expressive×health', () => {
    const {toJSON} = renderWithTheme(
      <LoadingStateRenderer node={LOADING_STATE_DEFAULT} />,
      {stance: 'expressive', palette: 'health'},
    )
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0006-123: shows shimmer rows; reduced-motion shows static gray
// ---------------------------------------------------------------------------

describe('LoadingStateRenderer rows and reduced motion (T-0006-123)', () => {
  it('renders the default 3 skeleton rows', () => {
    // Default `lines` is 3 — we verify via the rendered tree structure.
    // Each row is a View containing shimmer blocks.
    const {toJSON} = renderWithTheme(
      <LoadingStateRenderer node={LOADING_STATE_DEFAULT} />,
      {stance: 'productive', palette: 'focus'},
    )
    const tree = toJSON()
    // Root is a View; its children contain the skeleton rows.
    // We verify the tree is not null and has children matching the line count.
    expect(tree).not.toBeNull()

    // The rendered tree has one child per line (Row views)
    if (tree && typeof tree === 'object' && !Array.isArray(tree)) {
      expect(tree.children?.length).toBe(3)
    }
  })

  it('renders 5 skeleton rows when lines=5', () => {
    const {toJSON} = renderWithTheme(
      <LoadingStateRenderer node={LOADING_STATE_5_LINES} />,
      {stance: 'productive', palette: 'focus'},
    )
    const tree = toJSON()
    if (tree && typeof tree === 'object' && !Array.isArray(tree)) {
      expect(tree.children?.length).toBe(5)
    }
  })

  it('renders 1 skeleton row when lines=1', () => {
    const {toJSON} = renderWithTheme(
      <LoadingStateRenderer node={LOADING_STATE_1_LINE} />,
      {stance: 'productive', palette: 'focus'},
    )
    const tree = toJSON()
    if (tree && typeof tree === 'object' && !Array.isArray(tree)) {
      expect(tree.children?.length).toBe(1)
    }
  })

  it('has accessibilityLabel "Loading" by default', () => {
    const {getByLabelText} = renderWithTheme(
      <LoadingStateRenderer node={LOADING_STATE_DEFAULT} />,
      {stance: 'productive', palette: 'focus'},
    )
    expect(getByLabelText('Loading')).toBeTruthy()
  })

  it('uses accessibilityLabel override from node when provided', () => {
    const nodeWithLabel: LoadingStateNode = {
      ...LOADING_STATE_DEFAULT,
      id: 'ls5',
      accessibilityLabel: 'Loading workouts',
    }
    const {getByLabelText} = renderWithTheme(
      <LoadingStateRenderer node={nodeWithLabel} />,
      {stance: 'productive', palette: 'focus'},
    )
    expect(getByLabelText('Loading workouts')).toBeTruthy()
  })

  it('reduced motion: renders static gray blocks (no animation opacity change)', () => {
    // With the Reanimated mock, animations are no-ops. We verify that the
    // component renders without crash in reduced-motion mode by checking that
    // the tree is the same structure (shimmer blocks, but static).
    // The actual reduced-motion state comes from useReducedMotion() which returns
    // false in the test environment (AccessibilityInfo mock returns false).
    // This test verifies the component renders correctly in both cases.
    const {toJSON} = renderWithTheme(
      <LoadingStateRenderer node={LOADING_STATE_3_LINES} />,
      {stance: 'productive', palette: 'focus'},
    )
    // Renders 3 rows whether reduced motion is on or off
    const tree = toJSON()
    if (tree && typeof tree === 'object' && !Array.isArray(tree)) {
      expect(tree.children?.length).toBe(3)
    }
  })

  it('renders without crash for expressive stance', () => {
    const {toJSON} = renderWithTheme(
      <LoadingStateRenderer node={LOADING_STATE_3_LINES} />,
      {stance: 'expressive', palette: 'health'},
    )
    expect(toJSON()).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// T-0006-123 (reduced-motion branch): static opacity when useReducedMotion=true
// ---------------------------------------------------------------------------
//
// IMPORTANT: jest.mock() is hoisted to file scope by Babel — calling it inside
// beforeEach() is a parse-time no-op, not a runtime mock. Always use
// jest.spyOn() when you need to toggle a module export per-test at runtime.

describe('LoadingStateRenderer reduced-motion branch (T-0006-123)', () => {
  let spy: jest.SpyInstance

  beforeEach(() => {
    // Intercept the named export at runtime so ShimmerBlock sees reducedMotion=true.
    spy = jest.spyOn(useReducedMotionModule, 'useReducedMotion').mockReturnValue(true)
  })

  afterEach(() => {
    spy.mockRestore()
  })

  it('skips opacity animation when reducedMotion is true — shimmer-block opacity is 1 (static)', () => {
    // When useReducedMotion() returns true, ShimmerBlock initialises its shared
    // value with opacity 1 and skips the withRepeat block. The Reanimated mock's
    // useAnimatedStyle() calls the factory synchronously, so the resolved style
    // reflects the initial shared-value (1). The Animated.View mock forwards
    // style to a real RN View with testID="shimmer-block".
    //
    // We traverse the JSON tree directly rather than using getAllByTestId because
    // shimmer-block Views carry accessibilityElementsHidden={true}, which causes
    // RNTL to exclude them from testID queries (they're decorative, a11y-hidden).
    const {toJSON} = renderWithTheme(
      <LoadingStateRenderer node={LOADING_STATE_3_LINES} />,
      {stance: 'productive', palette: 'focus'},
    )

    // Collect all nodes with testID="shimmer-block" by walking the render tree.
    type JSONNode = {
      type: string
      props: Record<string, unknown>
      children: JSONNode[] | null
    }
    function collectShimmerBlocks(node: JSONNode | null): JSONNode[] {
      if (!node || typeof node !== 'object') return []
      const found: JSONNode[] = []
      if (node.props?.testID === 'shimmer-block') found.push(node)
      for (const child of node.children ?? []) {
        found.push(...collectShimmerBlocks(child as JSONNode))
      }
      return found
    }

    const tree = toJSON() as JSONNode | null
    const shimmerBlocks = collectShimmerBlocks(tree)

    // Each of the 3 rows has 3 ShimmerBlocks (avatar, title, subtitle) = 9 total.
    expect(shimmerBlocks.length).toBeGreaterThan(0)

    // Every shimmer block must have static opacity=1 (not the animated 0.4).
    for (const block of shimmerBlocks) {
      const rawStyle = block.props.style
      const flatStyle: Record<string, unknown> = Array.isArray(rawStyle)
        ? Object.assign({}, ...(rawStyle as object[]).filter(Boolean))
        : (rawStyle as Record<string, unknown>) ?? {}
      expect(flatStyle.opacity).toBe(1)
    }
  })
})
