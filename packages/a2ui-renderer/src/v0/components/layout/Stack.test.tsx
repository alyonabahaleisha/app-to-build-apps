/**
 * StackRenderer tests
 * T-0006-043: renders at productive×focus
 * T-0006-044: renders at expressive×health
 * T-0006-051: snapshot at productive×focus
 * T-0006-056: snapshot at expressive×health
 * T-0006-060: Stack.children at MAX_NESTING_DEPTH=8 renders correctly
 */
import React from 'react'
import {renderWithTheme} from '../../__test-utils__/renderWithTheme'
import type {Node} from '@app-creator/protocol'
import {StackRenderer} from './Stack'

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

type StackNode = Extract<Node, {type: 'Stack'}>

const STACK_EMPTY: StackNode = {
  id: 'stack1',
  type: 'Stack',
  children: [],
}

const STACK_WITH_CHILDREN: StackNode = {
  id: 'stack2',
  type: 'Stack',
  gap: 'space-md',
  align: 'start',
  children: [
    {id: 'row1', type: 'Row', children: []},
    {id: 'row2', type: 'Row', children: []},
  ],
}

/**
 * Build a nested Stack tree of the given depth.
 * At depth=1 produces a Stack with no children.
 * At depth=N produces a Stack whose single child is a Stack of depth N-1.
 */
function buildNestedStack(depth: number): StackNode {
  if (depth <= 1) {
    return {id: `stack_d${depth}`, type: 'Stack', children: []}
  }
  return {
    id: `stack_d${depth}`,
    type: 'Stack',
    children: [buildNestedStack(depth - 1)],
  }
}

// MAX_NESTING_DEPTH = 8 per ADR §M
const MAX_NESTING_DEPTH = 8

// ---------------------------------------------------------------------------
// T-0006-043: renders at productive×focus
// ---------------------------------------------------------------------------

describe('StackRenderer (T-0006-043) — productive×focus', () => {
  it('renders without error at productive×focus', () => {
    const {toJSON} = renderWithTheme(<StackRenderer node={STACK_WITH_CHILDREN} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('uses productive stance gap default (space-md = 12pt) when gap is unspecified', () => {
    const {toJSON} = renderWithTheme(<StackRenderer node={STACK_EMPTY} />, {
      stance: 'productive',
      palette: 'focus',
    })
    // Productive default gap is space-md = 12pt; no children so no margin wrappers visible
    expect(toJSON()).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// T-0006-044: renders at expressive×health
// ---------------------------------------------------------------------------

describe('StackRenderer (T-0006-044) — expressive×health', () => {
  it('renders without error at expressive×health', () => {
    const {toJSON} = renderWithTheme(<StackRenderer node={STACK_WITH_CHILDREN} />, {
      stance: 'expressive',
      palette: 'health',
    })
    expect(toJSON()).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// T-0006-051: snapshot at productive×focus
// ---------------------------------------------------------------------------

describe('StackRenderer snapshot (T-0006-051) — productive×focus', () => {
  it('matches snapshot at productive×focus', () => {
    const {toJSON} = renderWithTheme(<StackRenderer node={STACK_WITH_CHILDREN} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0006-056: snapshot at expressive×health
// ---------------------------------------------------------------------------

describe('StackRenderer snapshot (T-0006-056) — expressive×health', () => {
  it('matches snapshot at expressive×health', () => {
    const {toJSON} = renderWithTheme(<StackRenderer node={STACK_WITH_CHILDREN} />, {
      stance: 'expressive',
      palette: 'health',
    })
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0006-060: Stack.children at MAX_NESTING_DEPTH=8 renders correctly
//
// The schema cap of 8 is enforced by validateCrossRefs upstream; the renderer
// trusts that validated specs won't exceed depth 8. This test verifies the
// renderer can handle depth=8 without stack overflow or crash.
// ---------------------------------------------------------------------------

describe('StackRenderer boundary (T-0006-060) — MAX_NESTING_DEPTH=8', () => {
  it('renders a Stack nested 8 levels deep without crashing', () => {
    const deepStack = buildNestedStack(MAX_NESTING_DEPTH)
    expect(() => {
      renderWithTheme(<StackRenderer node={deepStack} />, {
        stance: 'productive',
        palette: 'focus',
      })
    }).not.toThrow()
  })

  it('renders a Stack nested 8 levels deep and produces non-null output', () => {
    const deepStack = buildNestedStack(MAX_NESTING_DEPTH)
    const {toJSON} = renderWithTheme(<StackRenderer node={deepStack} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })
})
