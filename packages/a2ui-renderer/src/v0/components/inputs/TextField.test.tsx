/**
 * TextFieldRenderer tests
 *
 * T-0006-087: snapshot at productive×focus
 * T-0006-088: snapshot at expressive×health
 * T-0006-097: commit-on-blur dispatches set with typed value
 * T-0006-102 (TextField): 3 binding kinds render without error
 * T-0006-103: collectionField binding outside ListItemContext renders (warning logged)
 * T-0006-104: maxLength enforced at TextInput level
 * T-0006-106 (TextField): escaped content (no XSS via label or value)
 * T-0006-FP1 (TextField): focus preservation — draft not overwritten while focused
 * T-0006-FP2 (TextField): external sync while unfocused — draft updates to new boundValue
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
import {TextFieldRenderer} from './TextField'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type TextFieldNode = Extract<Node, {type: 'TextField'}>

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
  initialState: {taskTitle: 'Buy groceries'},
}

const FIELD_STATE_BINDING: TextFieldNode = {
  id: 'tf1',
  type: 'TextField',
  label: 'Task title',
  valueBinding: {kind: 'state', slot: 'taskTitle'},
}

const FIELD_LITERAL_BINDING: TextFieldNode = {
  id: 'tf2',
  type: 'TextField',
  label: 'Fixed label',
  valueBinding: {kind: 'literal', value: 'Hello world'},
}

const FIELD_COLLECTION_BINDING: TextFieldNode = {
  id: 'tf3',
  type: 'TextField',
  label: 'Item name',
  valueBinding: {kind: 'collectionField', collectionId: 'items', field: 'name'},
}

const FIELD_MAX_LENGTH: TextFieldNode = {
  id: 'tf5',
  type: 'TextField',
  label: 'Short input',
  valueBinding: {kind: 'literal', value: ''},
  maxLength: 10,
}

const FIELD_EMAIL: TextFieldNode = {
  id: 'tf6',
  type: 'TextField',
  label: 'Email',
  valueBinding: {kind: 'literal', value: ''},
  keyboardType: 'email-address',
}

// ---------------------------------------------------------------------------
// T-0006-087: snapshot at productive×focus
// ---------------------------------------------------------------------------

describe('TextFieldRenderer snapshot (T-0006-087) — productive×focus', () => {
  it('matches snapshot at productive×focus', () => {
    const state = buildInitialRendererState(SPEC_WITH_SLOT)
    const {toJSON} = renderWithTheme(
      <TextFieldRenderer node={FIELD_STATE_BINDING} />,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0006-088: snapshot at expressive×health
// ---------------------------------------------------------------------------

describe('TextFieldRenderer snapshot (T-0006-088) — expressive×health', () => {
  it('matches snapshot at expressive×health', () => {
    const state = buildInitialRendererState(SPEC_WITH_SLOT)
    const {toJSON} = renderWithTheme(
      <TextFieldRenderer node={FIELD_STATE_BINDING} />,
      {stance: 'expressive', palette: 'health', rendererState: state},
    )
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0006-097: commit-on-blur dispatches set with typed value
// ---------------------------------------------------------------------------

describe('TextFieldRenderer dispatch (T-0006-097)', () => {
  it('commit-on-blur dispatches set with the current draft value', () => {
    const mockDispatch = jest.fn()
    const state = buildInitialRendererState(SPEC_WITH_SLOT)
    const {getByLabelText} = renderWithTheme(
      <TextFieldRenderer node={FIELD_STATE_BINDING} />,
      {stance: 'productive', palette: 'focus', rendererState: state, dispatch: mockDispatch},
    )

    const input = getByLabelText('Task title')
    fireEvent.changeText(input, 'Finish report')
    fireEvent(input, 'blur')

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'set',
      target: 'taskTitle',
      value: 'Finish report',
    })
  })

  it('literal binding does not dispatch on blur', () => {
    const mockDispatch = jest.fn()
    const {getByLabelText} = renderWithTheme(
      <TextFieldRenderer node={FIELD_LITERAL_BINDING} />,
      {stance: 'productive', palette: 'focus', dispatch: mockDispatch},
    )

    const input = getByLabelText('Fixed label')
    fireEvent.changeText(input, 'Changed')
    fireEvent(input, 'blur')

    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it('renders the bound state slot value', () => {
    const state = buildInitialRendererState(SPEC_WITH_SLOT)
    const {getByDisplayValue} = renderWithTheme(
      <TextFieldRenderer node={FIELD_STATE_BINDING} />,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )

    // 'Buy groceries' is the initialState value for 'taskTitle'
    expect(getByDisplayValue('Buy groceries')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// T-0006-102 (TextField): 3 binding kinds render without error
// ---------------------------------------------------------------------------

describe('TextFieldRenderer binding kinds (T-0006-102)', () => {
  it.each([
    ['literal binding', FIELD_LITERAL_BINDING],
    ['state binding', FIELD_STATE_BINDING],
    ['collectionField binding', FIELD_COLLECTION_BINDING],
  ] as [string, TextFieldNode][])('%s renders without error', (_desc, node) => {
    // collectionField outside ListItemContext logs warning in prod, returns undefined.
    // We suppress __DEV__ throws here by setting to production mode.
    const g = global as Record<string, unknown>
    const prevDEV = g.__DEV__
    g.__DEV__ = false
    try {
      const state = buildInitialRendererState(SPEC_WITH_SLOT)
      const {toJSON} = renderWithTheme(
        <TextFieldRenderer node={node} />,
        {stance: 'productive', palette: 'focus', rendererState: state},
      )
      expect(toJSON()).not.toBeNull()
    } finally {
      g.__DEV__ = prevDEV
    }
  })
})

// ---------------------------------------------------------------------------
// T-0006-103: collectionField binding outside ListItemContext
// ---------------------------------------------------------------------------

describe('TextFieldRenderer collectionField outside context (T-0006-103)', () => {
  it('renders empty (undefined value) without crash in prod mode', () => {
    const g = global as Record<string, unknown>
    const prevDEV = g.__DEV__
    g.__DEV__ = false
    try {
      const {toJSON} = renderWithTheme(
        <TextFieldRenderer node={FIELD_COLLECTION_BINDING} />,
        {stance: 'productive', palette: 'focus'},
      )
      expect(toJSON()).not.toBeNull()
    } finally {
      g.__DEV__ = prevDEV
    }
  })
})

// ---------------------------------------------------------------------------
// T-0006-104: maxLength enforced
// ---------------------------------------------------------------------------

describe('TextFieldRenderer maxLength (T-0006-104)', () => {
  it('passes maxLength prop to TextInput', () => {
    const {toJSON} = renderWithTheme(
      <TextFieldRenderer node={FIELD_MAX_LENGTH} />,
      {stance: 'productive', palette: 'focus'},
    )
    // Walk the rendered tree to find a TextInput-like element with maxLength
    const tree = JSON.stringify(toJSON())
    expect(tree).toContain('"maxLength":10')
  })
})

// ---------------------------------------------------------------------------
// T-0006-106 (TextField): content escaping — no XSS via label or value
// ---------------------------------------------------------------------------

describe('TextFieldRenderer security (T-0006-106)', () => {
  it('renders a label containing script tags as plain text, not executed', () => {
    const maliciousNode: TextFieldNode = {
      id: 'tf-xss',
      type: 'TextField',
      label: '<script>alert("xss")</script>',
      valueBinding: {kind: 'literal', value: '<img onerror="hack()" />'},
    }
    // React Native renders strings as Text; no HTML interpretation occurs.
    // This test confirms the component renders without throwing.
    expect(() =>
      renderWithTheme(<TextFieldRenderer node={maliciousNode} />, {
        stance: 'productive',
        palette: 'focus',
      }),
    ).not.toThrow()
  })

  it('renders email-address keyboard type without error', () => {
    const {toJSON} = renderWithTheme(
      <TextFieldRenderer node={FIELD_EMAIL} />,
      {stance: 'productive', palette: 'focus'},
    )
    expect(toJSON()).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// T-0006-FP1 / T-0006-FP2: focus preservation + external sync (ref-guard pattern)
//
// These tests lock in the derived-state ref-guard pattern that replaced the
// stale-closure useEffect (ADR-0006 §K, Roz Finding 1 fix).
//
// A StateHarness wrapper drives rendererState changes via React state so that
// rerender correctly swaps the RendererStateContext value — something that
// renderWithTheme's static wrapper cannot do.
// ---------------------------------------------------------------------------

const DEFAULT_HOST_FP: HostCallbacks = {
  onToast: jest.fn(),
  onAIError: jest.fn(),
  onUnknownNodeType: jest.fn(),
}

function makeSpecWithSlotValue(value: string): Spec {
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
    initialState: {taskTitle: value},
  }
}

/**
 * Wraps TextFieldRenderer with a controllable RendererStateContext so tests
 * can swap boundValue mid-render by updating the spec that seeds state.
 */
function TextFieldStateHarness({
  initialValue,
  node,
  onStateChange,
}: {
  initialValue: string
  node: TextFieldNode
  onStateChange?: (setter: (next: string) => void) => void
}) {
  const [spec, setSpec] = useState(() => makeSpecWithSlotValue(initialValue))
  const rendererState = buildInitialRendererState(spec)
  const dispatch = jest.fn()

  // Expose the setter so the test can trigger an external state change.
  // Intentional: runs once on mount to expose the setter to the test.
  // onStateChange is a test callback — stable by construction.
  React.useEffect(() => {
    onStateChange?.(nextValue => setSpec(makeSpecWithSlotValue(nextValue)))
  }, [])

  return (
    <RendererThemeProvider stance="productive" palette="focus">
      <HostProvider value={DEFAULT_HOST_FP}>
        <RendererStateContext.Provider value={{state: rendererState, dispatch}}>
          <TextFieldRenderer node={node} />
        </RendererStateContext.Provider>
      </HostProvider>
    </RendererThemeProvider>
  )
}

describe('TextFieldRenderer focus preservation (T-0006-FP1, T-0006-FP2)', () => {
  it('T-0006-FP1: does not overwrite draft while focused when boundValue changes externally', () => {
    let triggerExternalUpdate: ((next: string) => void) | undefined

    const {getByDisplayValue, queryByDisplayValue} = render(
      <TextFieldStateHarness
        initialValue="initial"
        node={FIELD_STATE_BINDING}
        onStateChange={setter => {
          triggerExternalUpdate = setter
        }}
      />,
    )

    const input = getByDisplayValue('initial')

    // User focuses and starts typing.
    fireEvent(input, 'focus')
    fireEvent.changeText(input, 'user is typing...')

    // External update fires while user is still focused.
    act(() => {
      triggerExternalUpdate?.('EXTERNAL OVERWRITE')
    })

    // Draft must still show the user's typed value.
    expect(getByDisplayValue('user is typing...')).toBeTruthy()
    expect(queryByDisplayValue('EXTERNAL OVERWRITE')).toBeNull()
  })

  it('T-0006-FP2: syncs draft to boundValue when external change happens while not focused', () => {
    let triggerExternalUpdate: ((next: string) => void) | undefined

    const {getByDisplayValue} = render(
      <TextFieldStateHarness
        initialValue="initial"
        node={FIELD_STATE_BINDING}
        onStateChange={setter => {
          triggerExternalUpdate = setter
        }}
      />,
    )

    // Field is not focused — external update should sync.
    act(() => {
      triggerExternalUpdate?.('EXTERNAL VALUE')
    })

    expect(getByDisplayValue('EXTERNAL VALUE')).toBeTruthy()
  })
})
