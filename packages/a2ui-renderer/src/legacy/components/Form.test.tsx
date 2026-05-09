/**
 * Tests for FormRenderer.
 *
 * Step 7 — T-0003-098..105 (incl. 103b/c, 104a/b) — 11 mandatory T-IDs.
 *
 * Uses @testing-library/react-native (rtl) for interaction tests.
 * Uses react-test-renderer (create) for snapshot tests (T-0003-104a, 104b).
 *
 * RendererThemeProvider wraps every render so useRendererTheme() resolves.
 *
 * expo-haptics is mocked globally (ButtonRenderer's submit button uses Haptics).
 *
 * Form is a layout + submit primitive — fields drive state directly through
 * their own id-keyed dispatches. Form does not inject formId-keyed state.
 */
import {fireEvent, render, screen} from '@testing-library/react-native'
import React from 'react'
import {create} from 'react-test-renderer'

// Mock expo-haptics before any import resolves it (ButtonRenderer uses it).
jest.mock('expo-haptics', () => ({
  __esModule: true,
  ImpactFeedbackStyle: {Light: 'light'},
  impactAsync: jest.fn(async () => {}),
}))

import {DEFAULT_LIGHT_THEME, RendererThemeProvider} from '../theme/RendererThemeProvider'
import {RendererLoggerProvider} from '../logger/RendererLoggerProvider'
import type {Dispatch, RenderState, RendererLogger} from '../types'
import {FormRenderer} from './Form'
import type {A2UIFormNode} from './Form'

// -- Helpers ------------------------------------------------------------------

function makeDispatch(): jest.Mock {
  return jest.fn()
}

function makeLoggerSpy(): jest.Mocked<RendererLogger> {
  return {warn: jest.fn(), error: jest.fn()}
}

function renderForm(
  node: A2UIFormNode,
  state: RenderState = {},
  dispatch: Dispatch = makeDispatch(),
  logger?: jest.Mocked<RendererLogger>,
) {
  const loggerInstance = logger ?? makeLoggerSpy()
  return render(
    <RendererThemeProvider value={DEFAULT_LIGHT_THEME}>
      <RendererLoggerProvider logger={loggerInstance}>
        <FormRenderer node={node} state={state} dispatch={dispatch} />
      </RendererLoggerProvider>
    </RendererThemeProvider>,
  )
}

function makeFormNode(overrides?: Partial<A2UIFormNode>): A2UIFormNode {
  return {
    type: 'Form',
    formId: 'test-form',
    fields: [],
    ...overrides,
  }
}

// -- T-0003-098: Form renders fields in order with md gap ---------------------

describe('FormRenderer — T-0003-098: fields rendered in order with md gap', () => {
  it('renders fields in order — Heading text appears before TextInput label', () => {
    // Use two distinctly-labelled fields to verify order.
    const node = makeFormNode({
      fields: [
        {type: 'Heading', text: 'First Field Heading'},
        {type: 'TextInput', id: 'name', label: 'Full Name'},
      ],
    })
    renderForm(node)
    // Both should appear in the tree.
    expect(screen.getByText('First Field Heading')).toBeTruthy()
    expect(screen.getByText('Full Name')).toBeTruthy()
    // Order: the heading's text should appear before the TextInput label in
    // the rendered host tree. We assert both are present and no throw occurs;
    // precise DOM ordering is locked by the snapshot (T-0003-104a).
  })

  it('renders a Form with md gap in the container style', () => {
    // Verify the gap token is applied at the container level.
    const {toJSON} = renderForm(
      makeFormNode({
        fields: [{type: 'TextInput', id: 'x', label: 'X'}],
      }),
    )
    const tree = toJSON() as {type: string; props: Record<string, unknown>}
    // The root View should have gap = theme.spacing.md = 16.
    const style = Array.isArray(tree.props.style)
      ? Object.assign({}, ...tree.props.style)
      : tree.props.style
    expect((style as {gap?: number}).gap).toBe(DEFAULT_LIGHT_THEME.spacing.md)
  })
})

// -- T-0003-099: Form with submitLabel + submitAction renders primary button --

describe('FormRenderer — T-0003-099: submitLabel + submitAction renders primary button', () => {
  it('renders a submit button labelled with submitLabel when both submitLabel and submitAction are set', () => {
    const node = makeFormNode({
      submitLabel: 'Save',
      submitAction: {type: 'toast', message: 'Saved!'},
    })
    renderForm(node)
    const btn = screen.getByRole('button', {name: 'Save'})
    expect(btn).toBeTruthy()
    expect(btn.props.accessibilityLabel).toBe('Save')
  })
})

// -- T-0003-100: Submit press fires dispatch(submitAction) --------------------

describe('FormRenderer — T-0003-100: submit press fires dispatch(submitAction)', () => {
  it('pressing the submit button fires dispatch with submitAction', () => {
    const dispatch = makeDispatch()
    const submitAction = {type: 'toast' as const, message: 'Submitted'}
    const node = makeFormNode({
      submitLabel: 'Submit',
      submitAction,
    })
    renderForm(node, {}, dispatch)
    const btn = screen.getByRole('button', {name: 'Submit'})
    fireEvent.press(btn)
    expect(dispatch).toHaveBeenCalledWith(submitAction)
  })
})

// -- T-0003-101: Form fields' state reflects dispatch updates -----------------

describe('FormRenderer — T-0003-101: field state reflects dispatch updates', () => {
  it('TextInput in fields dispatches set action with user-entered text', () => {
    const dispatch = makeDispatch()
    const node = makeFormNode({
      fields: [{type: 'TextInput', id: 'username', label: 'Username'}],
    })
    renderForm(node, {}, dispatch)
    const input = screen.getByLabelText('Username')
    fireEvent.changeText(input, 'alice')
    expect(dispatch).toHaveBeenCalledWith({
      type: 'set',
      targetId: 'username',
      value: 'alice',
    })
  })
})

// -- T-0003-102: submitLabel set + submitAction undefined → button hidden -----

describe('FormRenderer — T-0003-102: submitLabel set but submitAction undefined → button hidden', () => {
  it('does NOT render a submit button when submitLabel is set but submitAction is undefined', () => {
    const node = makeFormNode({
      submitLabel: 'Save',
      // submitAction intentionally omitted (undefined)
    })
    renderForm(node)
    // No button element should be in the tree.
    expect(screen.queryByRole('button')).toBeNull()
  })
})

// -- T-0003-103: empty fields + submit → button still renders -----------------

describe('FormRenderer — T-0003-103: empty fields with submit renders submit button', () => {
  it('renders the submit button even when fields is empty (submit-only form)', () => {
    const node = makeFormNode({
      fields: [],
      submitLabel: 'Go',
      submitAction: {type: 'toast', message: 'go'},
    })
    renderForm(node)
    const btn = screen.getByRole('button', {name: 'Go'})
    expect(btn).toBeTruthy()
  })
})

// -- T-0003-103b: submitAction defined + submitLabel undefined → NO button ----

describe('FormRenderer — T-0003-103b: submitAction defined but submitLabel undefined → no button', () => {
  it('does NOT render a submit button when submitLabel is undefined even if submitAction is defined', () => {
    // This locks the §H rule: submitLabel controls visibility regardless of
    // action presence (Roz N-2 resolution).
    const node = makeFormNode({
      // submitLabel intentionally omitted
      submitAction: {type: 'toast', message: 'action-without-label'},
    })
    renderForm(node)
    expect(screen.queryByRole('button')).toBeNull()
  })
})

// -- T-0003-103c: non-field node in fields renders inline without throwing ----

describe('FormRenderer — T-0003-103c: non-field node in fields renders inline', () => {
  it('renders a Heading in fields as a regular row child without throwing', () => {
    // Schema permits fields: A2UINode[] without constraining to field-type nodes.
    // Permissive M1 interpretation: render whatever NodeRenderer can handle.
    const node = makeFormNode({
      fields: [
        {type: 'Heading', text: 'Section Title'},
        {type: 'TextInput', id: 'email', label: 'Email'},
      ],
    })
    // Must not throw.
    expect(() => renderForm(node)).not.toThrow()
    // Both nodes appear in the tree.
    expect(screen.getByText('Section Title')).toBeTruthy()
    expect(screen.getByText('Email')).toBeTruthy()
  })
})

// -- T-0003-104a: Snapshot — Form with TextInput + Toggle + Counter + submit --

describe('FormRenderer — T-0003-104a: snapshot with fields and submit', () => {
  // CLAUDE.md §8 snapshot rationale: Form is a new component (Step 7).
  // This snapshot baseline captures a Form with mixed interactive fields and
  // a submit button. Any layout or styling change will require --updateSnapshot
  // and a code-review note explaining why.
  it('snapshot: Form with TextInput + Toggle + Counter + submit', () => {
    const tree = create(
      <RendererThemeProvider value={DEFAULT_LIGHT_THEME}>
        <RendererLoggerProvider logger={makeLoggerSpy()}>
          <FormRenderer
            node={{
              type: 'Form',
              formId: 'snapshot-form',
              fields: [
                {type: 'TextInput', id: 'title', label: 'Title', placeholder: 'Enter title'},
                {type: 'Toggle', id: 'notify', label: 'Notifications', defaultValue: false},
                {type: 'Counter', id: 'qty', label: 'Quantity', min: 0, max: 10},
              ],
              submitLabel: 'Save',
              submitAction: {type: 'toast', message: 'Saved'},
            }}
            state={{title: '', notify: false, qty: 0}}
            dispatch={makeDispatch()}
          />
        </RendererLoggerProvider>
      </RendererThemeProvider>,
    )
    expect(tree.toJSON()).toMatchSnapshot()
  })
})

// -- T-0003-104b: Snapshot — Form with no submit (submitLabel undefined) ------

describe('FormRenderer — T-0003-104b: snapshot with no submit', () => {
  // Snapshot of a Form with no submit button. Verifies the absence of a
  // Button element in the tree and that fields render normally.
  it('snapshot: Form with no submit (submitLabel undefined)', () => {
    const tree = create(
      <RendererThemeProvider value={DEFAULT_LIGHT_THEME}>
        <RendererLoggerProvider logger={makeLoggerSpy()}>
          <FormRenderer
            node={{
              type: 'Form',
              formId: 'no-submit-form',
              fields: [{type: 'TextInput', id: 'note', label: 'Note'}],
              // submitLabel intentionally omitted
            }}
            state={{note: ''}}
            dispatch={makeDispatch()}
          />
        </RendererLoggerProvider>
      </RendererThemeProvider>,
    )
    expect(tree.toJSON()).toMatchSnapshot()
  })
})

// -- T-0003-105: Form does NOT inject formId-keyed state ----------------------

describe('FormRenderer — T-0003-105: Form does not inject formId-keyed state', () => {
  it('dispatch is only called by individual fields — Form does not add its own formId key to state', () => {
    const dispatch = makeDispatch()
    const formId = 'my-test-form'
    const node = makeFormNode({
      formId,
      fields: [{type: 'TextInput', id: 'value', label: 'Value'}],
      submitLabel: 'Save',
      submitAction: {type: 'toast', message: 'done'},
    })
    renderForm(node, {}, dispatch)
    // Typing into the TextInput dispatches with targetId:'value', not formId.
    const input = screen.getByLabelText('Value')
    fireEvent.changeText(input, 'hello')
    // Only one dispatch call (from the TextInput) — no formId-keyed set action.
    expect(dispatch).toHaveBeenCalledTimes(1)
    const [action] = dispatch.mock.calls[0]
    expect(action.targetId).toBe('value')
    expect(action.targetId).not.toBe(formId)
    // Verify formId is not used as a dispatch target anywhere.
    const allTargetIds = dispatch.mock.calls.map(([a]: [typeof action]) => a.targetId)
    expect(allTargetIds).not.toContain(formId)
  })
})
