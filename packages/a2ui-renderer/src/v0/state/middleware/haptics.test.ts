/**
 * haptics middleware tests — T-0006-019
 *
 * T-0006-155 (Button press fires Light haptic + dispatch): the haptic half is
 * asserted here because ButtonRenderer tests use an isolated mockDispatch — no
 * real middleware chain flows through the component render. Button.test.tsx
 * asserts the dispatch half; this file asserts the haptic fires for addItem
 * (the action used in T-0006-155's fixture). Option B cross-reference pattern.
 *
 * T-0006-159 (FAB reduced-motion: haptics still fire): same split. FAB.test.tsx
 * asserts reduced-motion dispatch; this file asserts the haptic fires for addItem
 * regardless of motion preference (haptics are middleware-level, not component-level).
 */
import * as Haptics from 'expo-haptics'
import {haptics as hapticsMiddleware} from './haptics'
import type {RendererAction} from '../types'

// expo-haptics is mocked in jestSetup.js (jest.mock) and also via moduleNameMapper
// (ExpoHapticsMock.js). The jestSetup mock provides jest.fn() implementations
// that respond to jest.clearAllMocks() between tests.

describe('haptics middleware (T-0006-019)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const next = jest.fn()

  it('fires Light haptic on addItem (also satisfies T-0006-155 haptic half, T-0006-159 haptic half)', () => {
    hapticsMiddleware({type: 'addItem', collection: 'c1', item: {}}, next)
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light)
    expect(next).toHaveBeenCalled()
  })

  it('fires Medium haptic on removeItem', () => {
    hapticsMiddleware({type: 'removeItem', collection: 'c1', itemId: 'r1'}, next)
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium)
    expect(next).toHaveBeenCalled()
  })

  it('fires Medium haptic on clearCollection', () => {
    hapticsMiddleware({type: 'clearCollection', collection: 'c1'}, next)
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium)
    expect(next).toHaveBeenCalled()
  })

  it('fires Light haptic on capture', () => {
    hapticsMiddleware({type: 'capture', target: 'photoSlot'}, next)
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light)
    expect(next).toHaveBeenCalled()
  })

  it('fires Light haptic on reset (UX doc line 1554)', () => {
    hapticsMiddleware({type: 'reset', target: 'x'}, next)
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light)
    expect(next).toHaveBeenCalled()
  })

  it('fires Light haptic on updateItem (UX doc line 1554)', () => {
    hapticsMiddleware({type: 'updateItem', collection: 'c1', itemId: 'r1', patch: {done: true}}, next)
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light)
    expect(next).toHaveBeenCalled()
  })

  it('does not fire haptic on set (silent slot write)', () => {
    jest.clearAllMocks()
    hapticsMiddleware({type: 'set', target: 'x', value: 1}, next)
    expect(Haptics.impactAsync).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalled()
  })

  it('does not fire haptic on toast', () => {
    jest.clearAllMocks()
    hapticsMiddleware({type: 'toast', message: 'hi'}, next)
    expect(Haptics.impactAsync).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalled()
  })

  it('always calls next regardless of verb (haptic or not)', () => {
    // Verbs that produce no haptic — next() still called.
    const noHapticVerbs: RendererAction[] = [
      {type: 'set', target: 'x', value: 1},
      {type: 'navigate', target: 's2'},
      {type: 'back'},
      {type: 'toast', message: 'hi'},
      {type: 'aiProcess', task: 'summarize', collection: 'c', prompt: 'p', target: 't'},
    ]
    for (const action of noHapticVerbs) {
      const n = jest.fn()
      hapticsMiddleware(action, n)
      expect(n).toHaveBeenCalledWith(action)
    }
  })
})
