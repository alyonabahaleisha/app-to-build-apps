/**
 * haptics middleware tests — T-0006-019
 */
import * as Haptics from 'expo-haptics'
import {haptics as hapticsMiddleware} from './haptics'
import type {RendererAction} from '../types'

// expo-haptics is mapped by jest.config.js moduleNameMapper to ExpoHapticsMock.js
// which provides jest.fn() implementations. We can spy on them directly.

describe('haptics middleware (T-0006-019)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const next = jest.fn()

  it('fires Light haptic on addItem', () => {
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

  it('always calls next regardless of verb', () => {
    const verbs: RendererAction[] = [
      {type: 'set', target: 'x', value: 1},
      {type: 'reset', target: 'x'},
      {type: 'navigate', target: 's2'},
      {type: 'back'},
      {type: 'toast', message: 'hi'},
      {type: 'aiProcess', task: 'summarize', collection: 'c', prompt: 'p', target: 't'},
    ]
    for (const action of verbs) {
      const n = jest.fn()
      hapticsMiddleware(action, n)
      expect(n).toHaveBeenCalledWith(action)
    }
  })
})
