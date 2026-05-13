/**
 * feedback middleware tests
 *
 * T-0006-158: All 13 verbs trigger correct feedback per Sable's contract (13 tests)
 * T-0006-160: Action with no handler in feedback middleware logs warning, dispatches anyway
 * T-0006-161: Toast message content escapes (no rendered HTML/JSX from user input)
 * T-0006-161a: clearCollection raises Alert.alert BEFORE reducer runs
 * T-0006-161b: User confirms clearCollection alert → reducer runs
 * T-0006-161c: User cancels clearCollection alert → reducer does NOT run
 */
import {Alert} from 'react-native'
import type {AlertButton} from 'react-native'
import type {RendererAction} from '../types'
import {feedback} from './feedback'

// ---------------------------------------------------------------------------
// Spy on Alert.alert — avoid jest.mock('react-native') which triggers Flow
// parsing of react-native internals in the jest.requireActual path.
// jest.spyOn modifies the already-transformed module object in place.
// ---------------------------------------------------------------------------

let mockAlertAlert: jest.SpyInstance

beforeEach(() => {
  mockAlertAlert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
})

afterEach(() => {
  mockAlertAlert.mockRestore()
})

// ---------------------------------------------------------------------------
// T-0006-158: All 13 verbs trigger correct feedback per Sable's contract
//
// The feedback middleware's role:
//   - clearCollection → intercepts (Alert.alert called, next NOT called yet)
//   - all other verbs → passes through to next() unchanged
//
// Haptic feedback is owned by the haptics middleware (earlier in the chain).
// Undo buffer is owned by makeUndoBufferMiddleware.
// Toast short-circuit is owned by makeToastMiddleware.
//
// So "correct feedback" from the feedback middleware's perspective means:
//   - 12 non-clearCollection verbs: next() is called, Alert NOT called
//   - clearCollection: Alert called, next NOT called synchronously
// ---------------------------------------------------------------------------

describe('feedback middleware (T-0006-158) — 13 verb pass-through contract', () => {

  const PASS_THROUGH_VERBS: RendererAction[] = [
    {type: 'set', target: 'x', value: 'hello'},
    {type: 'update', collection: 'c', itemId: 'r1', patch: {name: 'updated'}},
    {type: 'reset', target: 'x'},
    {type: 'increment', target: 'count', by: 1},
    {type: 'addItem', collection: 'c', item: {name: 'New'}},
    {type: 'removeItem', collection: 'c', itemId: 'r1'},
    {type: 'updateItem', collection: 'c', itemId: 'r1', patch: {done: true}},
    {type: 'navigate', target: 's2'},
    {type: 'back'},
    {type: 'capture', target: 'photoSlot'},
    {type: 'toast', message: 'Saved!'},
    {type: 'aiProcess', task: 'summarize', collection: 'c', prompt: 'Summarize', target: 'summary'},
  ]

  it.each(PASS_THROUGH_VERBS.map(a => [a.type, a]))(
    '%s verb passes through to next (no Alert)',
    (_type, action) => {
      const next = jest.fn()
      feedback(action as RendererAction, next)
      expect(next).toHaveBeenCalledWith(action)
      expect(mockAlertAlert).not.toHaveBeenCalled()
    },
  )
})

// ---------------------------------------------------------------------------
// T-0006-161a: clearCollection raises Alert.alert BEFORE the reducer runs;
// reducer is not invoked while alert is open.
// ---------------------------------------------------------------------------

describe('feedback middleware clearCollection (T-0006-161a)', () => {

  it('calls Alert.alert when clearCollection is dispatched', () => {
    const next = jest.fn()
    const action: RendererAction = {type: 'clearCollection', collection: 'tasks'}

    feedback(action, next)

    expect(mockAlertAlert).toHaveBeenCalledTimes(1)
    // Alert title
    expect(mockAlertAlert.mock.calls[0]![0]).toBe('Clear all items')
  })

  it('does NOT call next() synchronously when clearCollection is dispatched', () => {
    const next = jest.fn()
    const action: RendererAction = {type: 'clearCollection', collection: 'tasks'}

    feedback(action, next)

    // next must not have been called — the alert is pending user response.
    expect(next).not.toHaveBeenCalled()
  })

  it('shows confirmText from action if provided, else default message', () => {
    const next = jest.fn()
    const customText = 'Clear all workouts? This is permanent.'
    const action: RendererAction = {
      type: 'clearCollection',
      collection: 'workouts',
      confirmText: customText,
    }

    feedback(action, next)

    expect(mockAlertAlert.mock.calls[0]![1]).toBe(customText)
  })

  it('shows default confirm text when confirmText is absent', () => {
    const next = jest.fn()
    feedback({type: 'clearCollection', collection: 'tasks'}, next)
    const message = mockAlertAlert.mock.calls[0]![1]
    expect(typeof message).toBe('string')
    expect(message!.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// T-0006-161b: User confirms clearCollection alert → reducer runs
// (next() is called via the confirm button's onPress callback)
// ---------------------------------------------------------------------------

describe('feedback middleware clearCollection confirm (T-0006-161b)', () => {

  it('calls next with the action when user presses Confirm/Clear', () => {
    const next = jest.fn()
    const action: RendererAction = {type: 'clearCollection', collection: 'tasks'}

    feedback(action, next)

    // Simulate user tapping "Clear" (destructive button = index 1).
    const buttons: AlertButton[] = mockAlertAlert.mock.calls[0]![2] ?? []
    const clearButton = buttons.find((b: AlertButton) => b.style === 'destructive')
    expect(clearButton).toBeDefined()
    clearButton!.onPress?.()

    expect(next).toHaveBeenCalledWith(action)
    expect(next).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// T-0006-161c: User cancels clearCollection alert → reducer does NOT run
// ---------------------------------------------------------------------------

describe('feedback middleware clearCollection cancel (T-0006-161c)', () => {

  it('does NOT call next when user presses Cancel', () => {
    const next = jest.fn()
    const action: RendererAction = {type: 'clearCollection', collection: 'tasks'}

    feedback(action, next)

    // Simulate user tapping "Cancel" (cancel button).
    const buttons: AlertButton[] = mockAlertAlert.mock.calls[0]![2] ?? []
    const cancelButton = buttons.find((b: AlertButton) => b.style === 'cancel')
    expect(cancelButton).toBeDefined()
    cancelButton!.onPress?.()

    expect(next).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// T-0006-160: Unrecognized action (future-compat) — feedback middleware logs
// a console.warn for unknown verbs, then dispatches anyway.
// ADR spec: "Action with no handler in feedback middleware logs warning, dispatches anyway."
// ---------------------------------------------------------------------------

describe('feedback middleware pass-through for unknown/future verbs (T-0006-160)', () => {
  it('logs a warning and calls next for an unknown verb type', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    const next = jest.fn()
    // Simulate a future verb not yet in the ActionSchema (defensive).
    // Cast through unknown to avoid type errors.
    const unknownAction = {type: 'futureVerb', target: 'x'} as unknown as RendererAction

    feedback(unknownAction, next)

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('futureVerb'))
    expect(next).toHaveBeenCalledWith(unknownAction)

    warnSpy.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// T-0006-161: Toast message content — security test.
// The feedback middleware passes toast actions through unchanged.
// The message content is not interpreted as HTML/JSX.
// ---------------------------------------------------------------------------

describe('feedback middleware security (T-0006-161)', () => {
  it('passes toast action with scripted message content through unchanged', () => {
    const next = jest.fn()
    const xssMessage = '<script>alert("xss")</script>'
    const action: RendererAction = {type: 'toast', message: xssMessage}

    feedback(action, next)

    // The middleware passes it through as-is — no parsing, no evaluation.
    expect(next).toHaveBeenCalledWith(action)
    // The message is not modified.
    expect((next.mock.calls[0]![0] as {type: 'toast'; message: string}).message).toBe(xssMessage)
  })

  it('clearCollection confirmText with scripted content does not execute', () => {
    const next = jest.fn()
    const xssText = '<script>alert("xss")</script>'
    const action: RendererAction = {
      type: 'clearCollection',
      collection: 'items',
      confirmText: xssText,
    }

    feedback(action, next)

    // Alert receives the raw string — it renders as text, not HTML.
    // Middleware does not evaluate or transform it.
    expect(mockAlertAlert.mock.calls[0]![1]).toBe(xssText)
    // next is NOT called (confirm pending)
    expect(next).not.toHaveBeenCalled()
  })
})
