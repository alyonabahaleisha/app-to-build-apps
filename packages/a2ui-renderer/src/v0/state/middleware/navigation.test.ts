/**
 * navigation middleware tests — T-0006-022
 * Step 10 additions: back-on-empty-history (T-0006-172a getState integration)
 */
import {makeNavigationMiddleware} from './navigation'
import type {NavigationPrimitive} from './navigation'
import type {RendererState} from '../types'

// Minimal RendererState stub for getState tests.
function makeState(history: string[] = []): RendererState {
  return {
    spec: {} as never,
    slots: new Map(),
    collections: new Map(),
    currentScreenId: 's1',
    history,
    pendingUndo: null,
  }
}

describe('navigation middleware (T-0006-022)', () => {
  it('calls navigation.navigate and passes through to reducer on navigate action', () => {
    const nav: NavigationPrimitive = {
      navigate: jest.fn(),
      pop: jest.fn(),
    }
    const onNavigationError = jest.fn()
    const next = jest.fn()

    const mw = makeNavigationMiddleware(() => nav, {onNavigationError})
    mw({type: 'navigate', target: 's2'}, next)

    expect(nav.navigate).toHaveBeenCalledWith('s2')
    // PASS-THROUGH: reducer also needs to run
    expect(next).toHaveBeenCalled()
  })

  it('calls navigation.pop and passes through to reducer on back action', () => {
    const nav: NavigationPrimitive = {
      navigate: jest.fn(),
      pop: jest.fn(),
    }
    const onNavigationError = jest.fn()
    const next = jest.fn()
    // history has one entry so back is valid.
    const getState = () => makeState(['s1'])

    const mw = makeNavigationMiddleware(() => nav, {onNavigationError}, getState)
    mw({type: 'back'}, next)

    expect(nav.pop).toHaveBeenCalled()
    expect(next).toHaveBeenCalled()
  })

  it('calls onNavigationError when nav primitive is null', () => {
    const onNavigationError = jest.fn()
    const next = jest.fn()

    const mw = makeNavigationMiddleware(() => null, {onNavigationError})
    mw({type: 'navigate', target: 's2'}, next)

    expect(onNavigationError).toHaveBeenCalledWith('navigate-on-none-nav')
    // Still passes through to reducer
    expect(next).toHaveBeenCalled()
  })

  it('passes non-nav actions through unchanged', () => {
    const nav: NavigationPrimitive = {navigate: jest.fn(), pop: jest.fn()}
    const next = jest.fn()

    const mw = makeNavigationMiddleware(() => nav, {})
    mw({type: 'set', target: 'x', value: 1}, next)

    expect(nav.navigate).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledWith({type: 'set', target: 'x', value: 1})
  })

  // ---------------------------------------------------------------------------
  // Step 10 additions — back-on-empty-history (T-0006-172a)
  // ---------------------------------------------------------------------------

  it('back on empty history calls onNavigationError("back-on-empty-history") (T-0006-172a)', () => {
    const nav: NavigationPrimitive = {navigate: jest.fn(), pop: jest.fn()}
    const onNavigationError = jest.fn()
    const next = jest.fn()
    // history is empty — no screens to go back to.
    const getState = () => makeState([])

    const mw = makeNavigationMiddleware(() => nav, {onNavigationError}, getState)
    mw({type: 'back'}, next)

    expect(onNavigationError).toHaveBeenCalledWith('back-on-empty-history')
    // nav.pop must NOT be called — there's nowhere to go.
    expect(nav.pop).not.toHaveBeenCalled()
    // Still passes through so reducer can no-op gracefully.
    expect(next).toHaveBeenCalled()
  })

  it('back on non-empty history does NOT call onNavigationError', () => {
    const nav: NavigationPrimitive = {navigate: jest.fn(), pop: jest.fn()}
    const onNavigationError = jest.fn()
    const next = jest.fn()
    const getState = () => makeState(['s1'])

    const mw = makeNavigationMiddleware(() => nav, {onNavigationError}, getState)
    mw({type: 'back'}, next)

    expect(onNavigationError).not.toHaveBeenCalled()
    expect(nav.pop).toHaveBeenCalled()
    expect(next).toHaveBeenCalled()
  })

  it('back with null nav primitive calls navigate-on-none-nav (not back-on-empty-history)', () => {
    const onNavigationError = jest.fn()
    const next = jest.fn()
    const getState = () => makeState([])

    const mw = makeNavigationMiddleware(() => null, {onNavigationError}, getState)
    mw({type: 'back'}, next)

    // null nav → 'navigate-on-none-nav', not 'back-on-empty-history'
    expect(onNavigationError).toHaveBeenCalledWith('navigate-on-none-nav')
    expect(next).toHaveBeenCalled()
  })

  it('back without getState provided does not crash (no state access)', () => {
    const nav: NavigationPrimitive = {navigate: jest.fn(), pop: jest.fn()}
    const next = jest.fn()

    // No getState provided — falls back to popping without history check.
    const mw = makeNavigationMiddleware(() => nav, {})
    expect(() => mw({type: 'back'}, next)).not.toThrow()
    expect(next).toHaveBeenCalled()
  })
})
