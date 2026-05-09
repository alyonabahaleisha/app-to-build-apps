/**
 * aiBridge middleware tests — T-0006-021
 */
import {makeAIBridgeMiddleware} from './aiBridge'
import type {AIDispatcher} from './aiBridge'

describe('aiBridge middleware (T-0006-021)', () => {
  it('calls aiDispatcher.summarize and dispatches set on completion', async () => {
    const dispatchedActions: unknown[] = []
    const dispatch = jest.fn((action) => dispatchedActions.push(action))

    const mockAI: AIDispatcher = {
      summarize: jest.fn().mockResolvedValue('Summary result'),
    }

    const onAIError = jest.fn()
    const next = jest.fn()

    const mw = makeAIBridgeMiddleware(
      () => mockAI,
      () => dispatch,
      {onAIError},
    )

    mw(
      {type: 'aiProcess', task: 'summarize', collection: 'workouts', prompt: 'Summarize', target: 'summarySlot'},
      next,
    )

    // Should NOT call next (short-circuit)
    expect(next).not.toHaveBeenCalled()
    expect(mockAI.summarize).toHaveBeenCalled()

    // Wait for the promise to resolve
    await Promise.resolve()

    expect(dispatch).toHaveBeenCalledWith({
      type: 'set',
      target: 'summarySlot',
      value: 'Summary result',
    })
  })

  it('calls host.onAIError on rejection', async () => {
    const dispatch = jest.fn()
    const error = new Error('AI failed')
    const mockAI: AIDispatcher = {
      summarize: jest.fn().mockRejectedValue(error),
    }
    const onAIError = jest.fn()
    const next = jest.fn()

    const mw = makeAIBridgeMiddleware(
      () => mockAI,
      () => dispatch,
      {onAIError},
    )

    mw(
      {type: 'aiProcess', task: 'summarize', collection: 'c', prompt: 'p', target: 't'},
      next,
    )

    // Flush all microtasks — rejection handler is in a .catch() which needs
    // the promise chain to settle (2 ticks: promise rejection + catch handler)
    await new Promise<void>(resolve => setTimeout(resolve, 0))

    expect(onAIError).toHaveBeenCalledWith(error)
  })

  it('short-circuits silently when AI dispatcher is null', () => {
    const dispatch = jest.fn()
    const onAIError = jest.fn()
    const next = jest.fn()

    const mw = makeAIBridgeMiddleware(
      () => null,
      () => dispatch,
      {onAIError},
    )

    mw(
      {type: 'aiProcess', task: 'summarize', collection: 'c', prompt: 'p', target: 't'},
      next,
    )

    expect(next).not.toHaveBeenCalled()
    expect(dispatch).not.toHaveBeenCalled()
    expect(onAIError).not.toHaveBeenCalled()
  })

  it('passes non-aiProcess actions through to next', () => {
    const dispatch = jest.fn()
    const onAIError = jest.fn()
    const next = jest.fn()

    const mw = makeAIBridgeMiddleware(
      () => null,
      () => dispatch,
      {onAIError},
    )

    mw({type: 'set', target: 'x', value: 1}, next)
    expect(next).toHaveBeenCalledWith({type: 'set', target: 'x', value: 1})
  })
})
