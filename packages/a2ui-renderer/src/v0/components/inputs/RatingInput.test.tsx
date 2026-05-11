/**
 * RatingInputRenderer tests — ADR-0009 Step 2
 *
 * T-0009-048: Schema parses with scale: 5, glyph: 'star'.
 * T-0009-049: Tap glyph 3 sets value to 3.
 * T-0009-050: allowHalf supports half-step taps.
 * T-0009-059: Snapshots at productive×focus + expressive×health.
 * T-0009-063: scale: 7 rejects.
 * T-0009-064: glyph: 'cube' rejects.
 */
import React from 'react'
import {fireEvent, act} from '@testing-library/react-native'
import type {Node, Spec} from '@app-creator/protocol'
import {RatingInputSchema} from '@app-creator/protocol'
import {renderWithTheme} from '../../__test-utils__/renderWithTheme'
import {buildInitialRendererState} from '../../state/reducer'
import {RatingInputRenderer} from './RatingInput'

type RatingInputNode = Extract<Node, {type: 'RatingInput'}>

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SPEC: Spec = {
  version: 1,
  archetype: 'Tracker',
  stance: 'productive',
  palette: 'health',
  coverIcon: 'list',
  navigation: 'none',
  screens: [{id: 's1', root: {id: 'n1', type: 'Heading', text: 'T', level: 1}}],
  initialScreenId: 's1',
  collections: [],
  initialState: {rating: 3},
}

const RI_STAR: RatingInputNode = {
  id: 'ri1',
  type: 'RatingInput',
  label: 'Rating',
  valueBinding: {kind: 'state', slot: 'rating'},
  scale: 5,
  glyph: 'star',
}

const RI_HALF: RatingInputNode = {
  id: 'ri2',
  type: 'RatingInput',
  label: 'Quality',
  valueBinding: {kind: 'state', slot: 'rating'},
  scale: 5,
  glyph: 'star',
  allowHalf: true,
}

const RI_SCALE10: RatingInputNode = {
  id: 'ri3',
  type: 'RatingInput',
  label: 'Difficulty',
  valueBinding: {kind: 'literal', value: 7},
  scale: 10,
}

// ---------------------------------------------------------------------------
// Schema validation (T-0009-048, T-0009-063, T-0009-064)
// ---------------------------------------------------------------------------

describe('RatingInputSchema validation', () => {
  const BASE = {
    id: 'ri1',
    type: 'RatingInput' as const,
    label: 'Rating',
    valueBinding: {kind: 'state' as const, slot: 'r'},
  }

  it('parses with scale: 5, glyph: "star" (T-0009-048)', () => {
    const result = RatingInputSchema.safeParse({...BASE, scale: 5, glyph: 'star'})
    expect(result.success).toBe(true)
  })

  it('parses with scale: 10', () => {
    const result = RatingInputSchema.safeParse({...BASE, scale: 10})
    expect(result.success).toBe(true)
  })

  it('rejects scale: 7 (T-0009-063)', () => {
    const result = RatingInputSchema.safeParse({...BASE, scale: 7})
    expect(result.success).toBe(false)
  })

  it('rejects glyph: "cube" (T-0009-064)', () => {
    const result = RatingInputSchema.safeParse({...BASE, glyph: 'cube'})
    expect(result.success).toBe(false)
  })

  it('parses all valid glyphs', () => {
    for (const glyph of ['star', 'heart', 'flame', 'circle']) {
      const result = RatingInputSchema.safeParse({...BASE, glyph})
      expect(result.success).toBe(true)
    }
  })

  it('parses allowHalf: true', () => {
    const result = RatingInputSchema.safeParse({...BASE, allowHalf: true})
    expect(result.success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// T-0009-059: Snapshots
// ---------------------------------------------------------------------------

describe('RatingInputRenderer snapshot (T-0009-059) — productive×focus', () => {
  it('matches snapshot at productive×focus', () => {
    const state = buildInitialRendererState(SPEC)
    const {toJSON} = renderWithTheme(
      <RatingInputRenderer node={RI_STAR} />,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )
    expect(toJSON()).toMatchSnapshot()
  })
})

describe('RatingInputRenderer snapshot (T-0009-059) — expressive×health', () => {
  it('matches snapshot at expressive×health', () => {
    const state = buildInitialRendererState(SPEC)
    const {toJSON} = renderWithTheme(
      <RatingInputRenderer node={RI_STAR} />,
      {stance: 'expressive', palette: 'health', rendererState: state},
    )
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// Behavior (T-0009-049, T-0009-050)
// ---------------------------------------------------------------------------

describe('RatingInputRenderer behavior', () => {
  it('tap glyph 3 dispatches value 3 (T-0009-049)', () => {
    const mockDispatch = jest.fn()
    const state = buildInitialRendererState({
      ...SPEC,
      initialState: {rating: 0},
    })
    const {getByTestId} = renderWithTheme(
      <RatingInputRenderer node={RI_STAR} />,
      {stance: 'productive', palette: 'focus', rendererState: state, dispatch: mockDispatch},
    )

    act(() => { fireEvent.press(getByTestId('ratinginput-glyph-3-ri1')) })

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'set',
      target: 'rating',
      value: 3,
    })
  })

  it('tap glyph at current value clears (sets 0) (T-0009-049)', () => {
    const mockDispatch = jest.fn()
    const state = buildInitialRendererState(SPEC) // rating = 3
    const {getByTestId} = renderWithTheme(
      <RatingInputRenderer node={RI_STAR} />,
      {stance: 'productive', palette: 'focus', rendererState: state, dispatch: mockDispatch},
    )

    // Tap glyph 3 when current value is 3 → should set 0.
    act(() => { fireEvent.press(getByTestId('ratinginput-glyph-3-ri1')) })

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'set',
      target: 'rating',
      value: 0,
    })
  })

  it('scale=10 renders 10 glyphs', () => {
    const {toJSON} = renderWithTheme(
      <RatingInputRenderer node={RI_SCALE10} />,
      {stance: 'productive', palette: 'focus'},
    )
    // 10 glyphs should be present (testID pattern has 1..10).
    const tree = JSON.stringify(toJSON())
    // Check that glyph-10 testID exists.
    expect(tree).toContain('ratinginput-glyph-10-ri3')
  })

  it('allowHalf: VoiceOver increment dispatches 0.5 step (T-0009-050)', () => {
    const mockDispatch = jest.fn()
    const state = buildInitialRendererState({
      ...SPEC,
      initialState: {rating: 2},
    })
    const {getByTestId} = renderWithTheme(
      <RatingInputRenderer node={RI_HALF} />,
      {stance: 'productive', palette: 'focus', rendererState: state, dispatch: mockDispatch},
    )

    const container = getByTestId('ratinginput-container-ri2')
    act(() => {
      fireEvent(container, 'accessibilityAction', {nativeEvent: {actionName: 'increment'}})
    })

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'set',
      target: 'rating',
      value: 2.5,
    })
  })

  it('has accessibilityRole adjustable on container', () => {
    const {toJSON} = renderWithTheme(
      <RatingInputRenderer node={RI_STAR} />,
      {stance: 'productive', palette: 'focus'},
    )
    const tree = JSON.stringify(toJSON())
    expect(tree).toContain('"accessibilityRole":"adjustable"')
  })

  it('does not dispatch for literal binding', () => {
    const mockDispatch = jest.fn()
    const {getByTestId} = renderWithTheme(
      <RatingInputRenderer node={RI_SCALE10} />,
      {stance: 'productive', palette: 'focus', dispatch: mockDispatch},
    )

    act(() => { fireEvent.press(getByTestId('ratinginput-glyph-5-ri3')) })

    expect(mockDispatch).not.toHaveBeenCalled()
  })
})
