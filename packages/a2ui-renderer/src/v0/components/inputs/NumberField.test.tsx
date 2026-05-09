/**
 * NumberFieldRenderer tests
 *
 * T-0006-089: snapshot at productive×focus
 * T-0006-090: snapshot at expressive×health
 * T-0006-098: non-numeric input rejected on blur
 * T-0006-102 (NumberField): 3 binding kinds render without error
 * T-0006-FP3 (NumberField): focus preservation — draft not overwritten while focused
 * T-0006-FP4 (NumberField): external sync while unfocused — draft updates to new boundValue
 */
import React, {useState} from 'react'
import {act, fireEvent, render} from '@testing-library/react-native'
import type {Node, Spec} from '@app-creator/protocol'
import {RendererThemeProvider} from '../../theme/RendererThemeProvider'
import {HostProvider} from '../../host/HostContext'
import type {HostCallbacks} from '../../state/hostCallbacks'
import {RendererStateContext} from '../../state/useRendererState'
import {renderWithTheme} from '../../__test-utils__/renderWithTheme'
import {buildInitialRendererState} from '../../state/reducer'
import {NumberFieldRenderer} from './NumberField'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type NumberFieldNode = Extract<Node, {type: 'NumberField'}>

const SPEC_WITH_SLOT: Spec = {
  version: 1,
  archetype: 'ListCRUD',
  stance: 'productive',
  palette: 'focus',
  coverIcon: 'list',
  navigation: 'none',
  screens: [{id: 's1', root: {id: 'n1', type: 'Heading', text: 'T', level: 1}}],
  initialScreenId: 's1',
  collections: [],
  initialState: {weight: 75},
}

const FIELD_STATE: NumberFieldNode = {
  id: 'nf1',
  type: 'NumberField',
  label: 'Weight (kg)',
  valueBinding: {kind: 'state', slot: 'weight'},
  min: 0,
  max: 500,
}

const FIELD_LITERAL: NumberFieldNode = {
  id: 'nf2',
  type: 'NumberField',
  label: 'Fixed value',
  valueBinding: {kind: 'literal', value: 42},
}

const FIELD_COLLECTION: NumberFieldNode = {
  id: 'nf3',
  type: 'NumberField',
  label: 'Reps',
  valueBinding: {kind: 'collectionField', collectionId: 'workouts', field: 'reps'},
}

// ---------------------------------------------------------------------------
// T-0006-089: snapshot at productive×focus
// ---------------------------------------------------------------------------

describe('NumberFieldRenderer snapshot (T-0006-089) — productive×focus', () => {
  it('matches snapshot at productive×focus', () => {
    const state = buildInitialRendererState(SPEC_WITH_SLOT)
    const {toJSON} = renderWithTheme(
      <NumberFieldRenderer node={FIELD_STATE} />,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0006-090: snapshot at expressive×health
// ---------------------------------------------------------------------------

describe('NumberFieldRenderer snapshot (T-0006-090) — expressive×health', () => {
  it('matches snapshot at expressive×health', () => {
    const state = buildInitialRendererState(SPEC_WITH_SLOT)
    const {toJSON} = renderWithTheme(
      <NumberFieldRenderer node={FIELD_STATE} />,
      {stance: 'expressive', palette: 'health', rendererState: state},
    )
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0006-098: non-numeric input rejected on blur
// ---------------------------------------------------------------------------

describe('NumberFieldRenderer numeric validation (T-0006-098)', () => {
  it('rejects non-numeric input on blur and does not dispatch', () => {
    const mockDispatch = jest.fn()
    const state = buildInitialRendererState(SPEC_WITH_SLOT)
    const {getByLabelText} = renderWithTheme(
      <NumberFieldRenderer node={FIELD_STATE} />,
      {stance: 'productive', palette: 'focus', rendererState: state, dispatch: mockDispatch},
    )

    const input = getByLabelText('Weight (kg)')
    fireEvent.changeText(input, 'not-a-number')
    fireEvent(input, 'blur')

    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it('dispatches set with parsed float on valid numeric blur', () => {
    const mockDispatch = jest.fn()
    const state = buildInitialRendererState(SPEC_WITH_SLOT)
    const {getByLabelText} = renderWithTheme(
      <NumberFieldRenderer node={FIELD_STATE} />,
      {stance: 'productive', palette: 'focus', rendererState: state, dispatch: mockDispatch},
    )

    const input = getByLabelText('Weight (kg)')
    fireEvent.changeText(input, '82.5')
    fireEvent(input, 'blur')

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'set',
      target: 'weight',
      value: 82.5,
    })
  })

  it('clamps value to max on blur', () => {
    const mockDispatch = jest.fn()
    const state = buildInitialRendererState(SPEC_WITH_SLOT)
    const {getByLabelText} = renderWithTheme(
      <NumberFieldRenderer node={FIELD_STATE} />,
      {stance: 'productive', palette: 'focus', rendererState: state, dispatch: mockDispatch},
    )

    const input = getByLabelText('Weight (kg)')
    fireEvent.changeText(input, '9999')
    fireEvent(input, 'blur')

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'set',
      target: 'weight',
      value: 500, // clamped to max
    })
  })

  it('clamps value to min on blur', () => {
    const mockDispatch = jest.fn()
    const state = buildInitialRendererState(SPEC_WITH_SLOT)
    const {getByLabelText} = renderWithTheme(
      <NumberFieldRenderer node={FIELD_STATE} />,
      {stance: 'productive', palette: 'focus', rendererState: state, dispatch: mockDispatch},
    )

    const input = getByLabelText('Weight (kg)')
    fireEvent.changeText(input, '-50')
    fireEvent(input, 'blur')

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'set',
      target: 'weight',
      value: 0, // clamped to min
    })
  })

  it('literal binding does not dispatch on blur', () => {
    const mockDispatch = jest.fn()
    const {getByLabelText} = renderWithTheme(
      <NumberFieldRenderer node={FIELD_LITERAL} />,
      {stance: 'productive', palette: 'focus', dispatch: mockDispatch},
    )

    const input = getByLabelText('Fixed value')
    fireEvent.changeText(input, '99')
    fireEvent(input, 'blur')

    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it('accessibilityRole is adjustable', () => {
    const state = buildInitialRendererState(SPEC_WITH_SLOT)
    const {toJSON} = renderWithTheme(
      <NumberFieldRenderer node={FIELD_STATE} />,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )
    const tree = JSON.stringify(toJSON())
    expect(tree).toContain('"accessibilityRole":"adjustable"')
  })
})

// ---------------------------------------------------------------------------
// T-0006-102 (NumberField): 3 binding kinds render without error
// ---------------------------------------------------------------------------

describe('NumberFieldRenderer binding kinds (T-0006-102)', () => {
  it.each([
    ['literal binding', FIELD_LITERAL],
    ['state binding', FIELD_STATE],
    ['collectionField binding', FIELD_COLLECTION],
  ] as [string, NumberFieldNode][])('%s renders without error', (_desc, node) => {
    const g = global as Record<string, unknown>
    const prevDEV = g.__DEV__
    g.__DEV__ = false
    try {
      const state = buildInitialRendererState(SPEC_WITH_SLOT)
      const {toJSON} = renderWithTheme(
        <NumberFieldRenderer node={node} />,
        {stance: 'productive', palette: 'focus', rendererState: state},
      )
      expect(toJSON()).not.toBeNull()
    } finally {
      g.__DEV__ = prevDEV
    }
  })
})

// ---------------------------------------------------------------------------
// T-0006-FP3 / T-0006-FP4: focus preservation + external sync (ref-guard pattern)
//
// Lock in the derived-state ref-guard pattern that replaced the stale-closure
// useEffect (ADR-0006 §K, Roz Finding 1 fix). Numeric variant.
// ---------------------------------------------------------------------------

const DEFAULT_HOST_FP: HostCallbacks = {
  onToast: jest.fn(),
  onAIError: jest.fn(),
  onUnknownNodeType: jest.fn(),
}

function makeSpecWithWeight(value: number): Spec {
  return {
    version: 1,
    archetype: 'ListCRUD',
    stance: 'productive',
    palette: 'focus',
    coverIcon: 'list',
    navigation: 'none',
    screens: [{id: 's1', root: {id: 'n1', type: 'Heading', text: 'T', level: 1}}],
    initialScreenId: 's1',
    collections: [],
    initialState: {weight: value},
  }
}

/**
 * Wraps NumberFieldRenderer with a controllable RendererStateContext so tests
 * can swap boundValue mid-render by updating the spec that seeds state.
 */
function NumberFieldStateHarness({
  initialValue,
  node,
  onStateChange,
}: {
  initialValue: number
  node: NumberFieldNode
  onStateChange?: (setter: (next: number) => void) => void
}) {
  const [spec, setSpec] = useState(() => makeSpecWithWeight(initialValue))
  const rendererState = buildInitialRendererState(spec)
  const dispatch = jest.fn()

  // Intentional: runs once on mount to expose the setter to the test.
  // onStateChange is a test callback — stable by construction.
  React.useEffect(() => {
    onStateChange?.(nextValue => setSpec(makeSpecWithWeight(nextValue)))
  }, [])

  return (
    <RendererThemeProvider stance="productive" palette="focus">
      <HostProvider value={DEFAULT_HOST_FP}>
        <RendererStateContext.Provider value={{state: rendererState, dispatch}}>
          <NumberFieldRenderer node={node} />
        </RendererStateContext.Provider>
      </HostProvider>
    </RendererThemeProvider>
  )
}

describe('NumberFieldRenderer focus preservation (T-0006-FP3, T-0006-FP4)', () => {
  it('T-0006-FP3: does not overwrite draft while focused when boundValue changes externally', () => {
    let triggerExternalUpdate: ((next: number) => void) | undefined

    const {getByDisplayValue, queryByDisplayValue} = render(
      <NumberFieldStateHarness
        initialValue={75}
        node={FIELD_STATE}
        onStateChange={setter => {
          triggerExternalUpdate = setter
        }}
      />,
    )

    const input = getByDisplayValue('75')

    // User focuses and starts typing a new value.
    fireEvent(input, 'focus')
    fireEvent.changeText(input, '82')

    // External update fires while user is still focused.
    act(() => {
      triggerExternalUpdate?.(999)
    })

    // Draft must still show the user's typed value.
    expect(getByDisplayValue('82')).toBeTruthy()
    expect(queryByDisplayValue('999')).toBeNull()
  })

  it('T-0006-FP4: syncs draft to boundValue when external change happens while not focused', () => {
    let triggerExternalUpdate: ((next: number) => void) | undefined

    const {getByDisplayValue} = render(
      <NumberFieldStateHarness
        initialValue={75}
        node={FIELD_STATE}
        onStateChange={setter => {
          triggerExternalUpdate = setter
        }}
      />,
    )

    // Field is not focused — external update should sync draft.
    act(() => {
      triggerExternalUpdate?.(200)
    })

    expect(getByDisplayValue('200')).toBeTruthy()
  })
})
