/**
 * navigation middleware tests — T-0006-022
 */
import {makeNavigationMiddleware} from './navigation'
import type {NavigationPrimitive} from './navigation'

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

    const mw = makeNavigationMiddleware(() => nav, {onNavigationError})
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
})
