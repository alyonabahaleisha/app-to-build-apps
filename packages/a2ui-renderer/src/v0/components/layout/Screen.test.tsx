/**
 * ScreenRenderer tests
 * T-0006-039: renders at productive×focus
 * T-0006-040: renders at expressive×health
 * T-0006-049: snapshot at productive×focus
 * T-0006-054: snapshot at expressive×health
 * T-0006-059: Screen with invalid safeArea rejected at schema parse
 *
 * Roz Finding 2 pickup (from roz-step4-qa-ADR-0006.md):
 *   Three render-path tests for safeArea: 'top' | 'bottom' | 'none' arms.
 *   buildSafePadding had 0% branch coverage for these three values. Added here
 *   to bring ScreenRenderer to full branch coverage on buildSafePadding.
 */
import React from 'react'
import {renderWithTheme} from '../../__test-utils__/renderWithTheme'
import {ScreenSchema} from '@app-creator/protocol'
import type {Node} from '@app-creator/protocol'
import {ScreenRenderer} from './Screen'

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const SCREEN_NODE: Extract<Node, {type: 'Screen'}> = {
  id: 'screen1',
  type: 'Screen',
  padding: 'space-lg',
  safeArea: 'both',
  children: [],
}

const SCREEN_WITH_CHILD: Extract<Node, {type: 'Screen'}> = {
  id: 'screen2',
  type: 'Screen',
  children: [
    {
      id: 'child1',
      type: 'Stack',
      children: [],
    },
  ],
}

// ---------------------------------------------------------------------------
// T-0006-039: renders at productive×focus (happy path)
// ---------------------------------------------------------------------------

describe('ScreenRenderer (T-0006-039) — productive×focus', () => {
  it('renders without error at productive×focus', () => {
    const {toJSON} = renderWithTheme(<ScreenRenderer node={SCREEN_NODE} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// T-0006-040: renders at expressive×health (happy path)
// ---------------------------------------------------------------------------

describe('ScreenRenderer (T-0006-040) — expressive×health', () => {
  it('renders without error at expressive×health', () => {
    const {toJSON} = renderWithTheme(<ScreenRenderer node={SCREEN_NODE} />, {
      stance: 'expressive',
      palette: 'health',
    })
    expect(toJSON()).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// T-0006-049: snapshot at productive×focus
// ---------------------------------------------------------------------------

describe('ScreenRenderer snapshot (T-0006-049) — productive×focus', () => {
  it('matches snapshot at productive×focus', () => {
    const {toJSON} = renderWithTheme(<ScreenRenderer node={SCREEN_WITH_CHILD} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0006-054: snapshot at expressive×health
// ---------------------------------------------------------------------------

describe('ScreenRenderer snapshot (T-0006-054) — expressive×health', () => {
  it('matches snapshot at expressive×health', () => {
    const {toJSON} = renderWithTheme(<ScreenRenderer node={SCREEN_WITH_CHILD} />, {
      stance: 'expressive',
      palette: 'health',
    })
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0006-059: invalid safeArea rejected at schema parse
// ---------------------------------------------------------------------------

describe('Screen schema (T-0006-059)', () => {
  it('rejects invalid safeArea at schema parse', () => {
    const result = ScreenSchema.safeParse({
      id: 'screen_bad',
      type: 'Screen',
      safeArea: 'left', // not in enum: top | bottom | both | none
      children: [],
    })
    expect(result.success).toBe(false)
  })

  it('accepts valid safeArea values', () => {
    for (const safeArea of ['top', 'bottom', 'both', 'none'] as const) {
      const result = ScreenSchema.safeParse({
        id: 'screen_ok',
        type: 'Screen',
        safeArea,
        children: [],
      })
      expect(result.success).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// Roz Finding 2 pickup — render-path tests for safeArea: 'top' | 'bottom' | 'none'
//
// buildSafePadding had zero render-path coverage for these three arms.
// The jestSetup mock returns {top: 0, bottom: 0} insets; we verify each arm
// renders without error (the mock insets make padding values all 0, which is
// fine — we're testing the branch is exercised, not the pixel values).
// ---------------------------------------------------------------------------

describe('ScreenRenderer safeArea render paths (Roz Finding 2)', () => {
  it('renders with safeArea: "top" without error', () => {
    const node: Extract<Node, {type: 'Screen'}> = {
      id: 'screen_top',
      type: 'Screen',
      safeArea: 'top',
      children: [],
    }
    const {toJSON} = renderWithTheme(<ScreenRenderer node={node} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('renders with safeArea: "bottom" without error', () => {
    const node: Extract<Node, {type: 'Screen'}> = {
      id: 'screen_bottom',
      type: 'Screen',
      safeArea: 'bottom',
      children: [],
    }
    const {toJSON} = renderWithTheme(<ScreenRenderer node={node} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('renders with safeArea: "none" without error', () => {
    const node: Extract<Node, {type: 'Screen'}> = {
      id: 'screen_none',
      type: 'Screen',
      safeArea: 'none',
      children: [],
    }
    const {toJSON} = renderWithTheme(<ScreenRenderer node={node} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })
})
