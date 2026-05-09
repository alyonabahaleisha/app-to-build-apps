/**
 * Tests for TextInputRenderer.
 *
 * Step 6 — T-0003-082..090b (11 T-IDs covering this component).
 *
 * Uses @testing-library/react-native (rtl) for interaction tests (focus,
 * changeText events).
 * Uses react-test-renderer (create) for snapshot tests.
 *
 * RendererThemeProvider wraps every render so useRendererTheme() resolves.
 * RendererLoggerProvider wraps renders that exercise the warn-log path.
 */
import {fireEvent, render, screen} from '@testing-library/react-native'
import React from 'react'
import {create} from 'react-test-renderer'

import {DEFAULT_LIGHT_THEME, RendererThemeProvider} from '../theme/RendererThemeProvider'
import {RendererLoggerProvider} from '../logger/RendererLoggerProvider'
import type {Dispatch, RenderState, RendererLogger} from '../types'
import {TextInputRenderer} from './TextInput'
import type {A2UITextInputNode} from './TextInput'

// -- Helpers ------------------------------------------------------------------

function makeDispatch(): jest.Mock {
  return jest.fn()
}

function makeLoggerSpy(): jest.Mocked<RendererLogger> {
  return {warn: jest.fn(), error: jest.fn()}
}

function renderTextInput(
  node: A2UITextInputNode,
  state: RenderState = {},
  dispatch: Dispatch = makeDispatch(),
  logger?: jest.Mocked<RendererLogger>,
) {
  const loggerInstance = logger ?? makeLoggerSpy()
  return render(
    <RendererThemeProvider value={DEFAULT_LIGHT_THEME}>
      <RendererLoggerProvider logger={loggerInstance}>
        <TextInputRenderer node={node} state={state} dispatch={dispatch} />
      </RendererLoggerProvider>
    </RendererThemeProvider>,
  )
}

function makeNode(overrides?: Partial<A2UITextInputNode>): A2UITextInputNode {
  return {
    type: 'TextInput',
    id: 'name',
    label: 'Full Name',
    ...overrides,
  }
}

// -- T-0003-082: label above input, both visible ------------------------------

describe('TextInputRenderer — T-0003-082: label above input', () => {
  it('renders label above the input, both visible', () => {
    renderTextInput(makeNode({label: 'Email Address'}))
    expect(screen.getByText('Email Address')).toBeTruthy()
    // Input is accessible via the label
    expect(screen.getByLabelText('Email Address')).toBeTruthy()
  })
})

// -- T-0003-083: placeholder shown when state[id] is empty --------------------

describe('TextInputRenderer — T-0003-083: placeholder shown when empty', () => {
  it('placeholder shown when state[id] is empty string', () => {
    renderTextInput(makeNode({placeholder: 'Enter your name'}), {name: ''})
    const input = screen.getByLabelText('Full Name')
    expect(input.props.placeholder).toBe('Enter your name')
  })

  it('placeholder shown when state has no entry for this id', () => {
    renderTextInput(makeNode({placeholder: 'Enter your name'}), {})
    const input = screen.getByLabelText('Full Name')
    expect(input.props.placeholder).toBe('Enter your name')
  })
})

// -- T-0003-084: multiline:true allows up to 5 lines before scroll ------------

describe('TextInputRenderer — T-0003-084: multiline 5-line max', () => {
  it('multiline:true sets numberOfLines=5 and scrollEnabled=true', () => {
    renderTextInput(makeNode({multiline: true}))
    const input = screen.getByLabelText('Full Name')
    expect(input.props.multiline).toBe(true)
    expect(input.props.numberOfLines).toBe(5)
    expect(input.props.scrollEnabled).toBe(true)
  })

  it('multiline:false (default) does not set numberOfLines', () => {
    renderTextInput(makeNode({multiline: false}))
    const input = screen.getByLabelText('Full Name')
    expect(input.props.numberOfLines).toBeUndefined()
  })
})

// -- T-0003-085: onChangeText dispatches set action --------------------------

describe('TextInputRenderer — T-0003-085: onChangeText dispatches set', () => {
  it('onChangeText("foo") dispatches {type:set, targetId:id, value:"foo"}', () => {
    const dispatch = makeDispatch()
    renderTextInput(makeNode({id: 'search'}), {search: ''}, dispatch)
    const input = screen.getByLabelText('Full Name')
    fireEvent.changeText(input, 'foo')
    expect(dispatch).toHaveBeenCalledWith({
      type: 'set',
      targetId: 'search',
      value: 'foo',
    })
  })
})

// -- T-0003-086: value reflects state[id] (controlled) -----------------------

describe('TextInputRenderer — T-0003-086: controlled value', () => {
  it('value reflects state[id]', () => {
    renderTextInput(makeNode({id: 'name'}), {name: 'Alice'})
    const input = screen.getByLabelText('Full Name')
    expect(input.props.value).toBe('Alice')
  })

  it('state update propagates back to the displayed value', () => {
    const {rerender} = renderTextInput(makeNode({id: 'name'}), {name: 'Alice'})
    // Re-render with updated state (simulates parent state update after dispatch)
    rerender(
      <RendererThemeProvider value={DEFAULT_LIGHT_THEME}>
        <RendererLoggerProvider logger={makeLoggerSpy()}>
          <TextInputRenderer
            node={makeNode({id: 'name'})}
            state={{name: 'Bob'}}
            dispatch={makeDispatch()}
          />
        </RendererLoggerProvider>
      </RendererThemeProvider>,
    )
    const input = screen.getByLabelText('Full Name')
    expect(input.props.value).toBe('Bob')
  })
})

// -- T-0003-087: accessibilityLabel === node.label ----------------------------

describe('TextInputRenderer — T-0003-087: accessibilityLabel', () => {
  it('accessibilityLabel equals node.label', () => {
    renderTextInput(makeNode({label: 'Billing Address'}))
    const input = screen.getByLabelText('Billing Address')
    expect(input.props.accessibilityLabel).toBe('Billing Address')
  })
})

// -- T-0003-088: state[id] of 0 (number) renders empty -----------------------

describe('TextInputRenderer — T-0003-088: number state renders empty', () => {
  it('state[id] of 0 (number) renders empty string without throwing', () => {
    // Number state → not a string → displayValue defaults to '' (defensive).
    renderTextInput(makeNode({id: 'name'}), {name: 0 as unknown as string})
    const input = screen.getByLabelText('Full Name')
    expect(input.props.value).toBe('')
  })
})

// -- T-0003-088b: state[id] of null renders empty without throwing ------------

describe('TextInputRenderer — T-0003-088b: null state renders empty', () => {
  it('state[id] of null renders empty string without throwing', () => {
    renderTextInput(makeNode({id: 'name'}), {name: null as unknown as string})
    const input = screen.getByLabelText('Full Name')
    expect(input.props.value).toBe('')
  })
})

// -- T-0003-088c: boolean state renders empty + warn-log (no actual value) ---

describe('TextInputRenderer — T-0003-088c: boolean state warn-log', () => {
  it('state[id] of boolean renders empty + warn-logs a2ui_textinput_type_mismatch', () => {
    const logger = makeLoggerSpy()
    const dispatch = makeDispatch()
    renderTextInput(makeNode({id: 'name'}), {name: true as unknown as string}, dispatch, logger)
    const input = screen.getByLabelText('Full Name')
    expect(input.props.value).toBe('')
    expect(logger.warn).toHaveBeenCalledTimes(1)
    const warnCall = logger.warn.mock.calls[0]!
    const [message, payload] = warnCall
    expect(message).toBe('a2ui_textinput_type_mismatch')
    expect(payload).toMatchObject({
      id: 'name',
      expectedType: 'string',
      actualType: 'boolean',
    })
    // PII rule §G-4: the actual value (true) MUST NOT appear in the log payload.
    const payloadStr = JSON.stringify(payload)
    expect(payloadStr).not.toContain('true')
    expect(payloadStr).not.toContain('"value"')
  })
})

// -- T-0003-088d: focus state border transitions to palette.primary ----------

describe('TextInputRenderer — T-0003-088d: focus state border', () => {
  it('on focus, border color transitions to palette.primary', () => {
    renderTextInput(makeNode({id: 'name'}))
    const input = screen.getByLabelText('Full Name')
    // Before focus: border is border.subtle
    const styleBefore = Array.isArray(input.props.style)
      ? Object.assign({}, ...input.props.style)
      : input.props.style
    expect(styleBefore.borderColor).toBe(DEFAULT_LIGHT_THEME.palette.border.subtle)

    // Fire focus event
    fireEvent(input, 'focus')
    // After focus: border should be palette.primary
    const styleAfter = Array.isArray(input.props.style)
      ? Object.assign({}, ...input.props.style)
      : input.props.style
    expect(styleAfter.borderColor).toBe(DEFAULT_LIGHT_THEME.palette.primary)
  })
})

// -- T-0003-089: Snapshot — labelled + placeholder ----------------------------

describe('TextInputRenderer — T-0003-089: snapshot labelled + placeholder', () => {
  // CLAUDE.md §8 snapshot rationale: TextInput is a new component (Step 6).
  // These snapshots are new baselines. No prior snapshot to compare against.
  it('snapshot: TextInput labelled + placeholder (unfocused)', () => {
    const tree = create(
      <RendererThemeProvider value={DEFAULT_LIGHT_THEME}>
        <RendererLoggerProvider logger={makeLoggerSpy()}>
          <TextInputRenderer
            node={makeNode({
              id: 'name',
              label: 'Full Name',
              placeholder: 'Enter your full name',
            })}
            state={{name: ''}}
            dispatch={makeDispatch()}
          />
        </RendererLoggerProvider>
      </RendererThemeProvider>,
    )
    expect(tree.toJSON()).toMatchSnapshot()
  })
})

// -- T-0003-090: Snapshot — multiline -----------------------------------------

describe('TextInputRenderer — T-0003-090: snapshot multiline', () => {
  it('snapshot: TextInput multiline=true with placeholder', () => {
    const tree = create(
      <RendererThemeProvider value={DEFAULT_LIGHT_THEME}>
        <RendererLoggerProvider logger={makeLoggerSpy()}>
          <TextInputRenderer
            node={makeNode({
              id: 'bio',
              label: 'Bio',
              placeholder: 'Tell us about yourself',
              multiline: true,
            })}
            state={{bio: ''}}
            dispatch={makeDispatch()}
          />
        </RendererLoggerProvider>
      </RendererThemeProvider>,
    )
    expect(tree.toJSON()).toMatchSnapshot()
  })
})

// -- T-0003-090b: Snapshot — focused state (border = primary) ----------------

describe('TextInputRenderer — T-0003-090b: snapshot focused state', () => {
  it('snapshot: TextInput in focused state (border = palette.primary)', () => {
    // We can't trigger React useState via react-test-renderer, but we can
    // verify the component renders differently based on focus by checking
    // the interaction test (T-0003-088d). For the snapshot, we instead
    // verify the focused branch by rendering via RTL and checking the style.
    renderTextInput(makeNode({id: 'name', label: 'Full Name', placeholder: 'Name'}))
    const input = screen.getByLabelText('Full Name')
    fireEvent(input, 'focus')
    // Capture the style snapshot via the element's props
    const focusedStyle = Array.isArray(input.props.style)
      ? Object.assign({}, ...input.props.style)
      : input.props.style
    expect(focusedStyle).toMatchSnapshot()
  })
})
