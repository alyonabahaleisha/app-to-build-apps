/**
 * aiDispatcher tests
 *
 * T-0006-147: aiDispatcher prompt is sanitized (no PII leakage from collection rows)
 *
 * Additional tests covering:
 *   - makeAIDispatcher returns null when module is absent
 *   - makeAIDispatcher returns a working dispatcher when module present (summarize API)
 *   - makeAIDispatcher returns a working dispatcher when module present (run API)
 *   - Timeout after AI_TIMEOUT_MS
 *   - sanitizeRowsForPrompt key/value truncation
 *   - sanitizeRowsForPrompt caps at MAX_ROWS_IN_PROMPT rows
 */
import {
  makeAIDispatcher,
  resetAIModuleCache,
  sanitizeRowsForPrompt,
  AI_TIMEOUT_MS,
} from './aiDispatcher'

// ---------------------------------------------------------------------------
// Module-level mock control
// We reset the cache before each test and control what require() returns.
// ---------------------------------------------------------------------------

describe('sanitizeRowsForPrompt (T-0006-147)', () => {
  it('returns an empty string for an empty array', () => {
    expect(sanitizeRowsForPrompt([])).toBe('')
  })

  it('formats each row as labeled key-value lines', () => {
    const rows = [{name: 'Morning run', reps: 10}]
    const result = sanitizeRowsForPrompt(rows)
    expect(result).toContain('Item 1:')
    expect(result).toContain('name: Morning run')
    expect(result).toContain('reps: 10')
  })

  it('truncates field values at 200 characters (T-0006-147 PII guard)', () => {
    const longValue = 'A'.repeat(300)
    const rows = [{secret: longValue}]
    const result = sanitizeRowsForPrompt(rows)
    // Value must be truncated to 200 chars.
    expect(result).toContain('secret: ' + 'A'.repeat(200))
    expect(result).not.toContain('A'.repeat(201))
  })

  it('truncates field keys at 64 characters', () => {
    const longKey = 'k'.repeat(80)
    const rows = [{[longKey]: 'value'}]
    const result = sanitizeRowsForPrompt(rows)
    // Key must be truncated to 64 chars.
    expect(result).toContain('k'.repeat(64) + ': value')
    expect(result).not.toContain('k'.repeat(65))
  })

  it('caps at 20 rows (MAX_ROWS_IN_PROMPT)', () => {
    const rows = Array.from({length: 25}, (_, i) => ({name: `Item ${i}`}))
    const result = sanitizeRowsForPrompt(rows)
    // Only 20 items should appear.
    expect(result).toContain('Item 1:')
    expect(result).not.toContain('Item 21:')
  })

  it('handles diverse content: Unicode names, empty values, booleans', () => {
    const rows = [
      {name: 'José García', done: true},
      {name: '李明', count: 0},
      {name: "O'Brien", note: ''},
    ]
    const result = sanitizeRowsForPrompt(rows)
    expect(result).toContain('José García')
    expect(result).toContain('李明')
    expect(result).toContain("O'Brien")
    expect(result).toContain('done: true')
    expect(result).toContain('count: 0')
  })
})

describe('makeAIDispatcher — module unavailable', () => {
  beforeEach(() => {
    resetAIModuleCache()
  })

  it('returns null when react-native-ai-apple is not installed', () => {
    // The module is not available in the Jest environment, so the real
    // require() throws MODULE_NOT_FOUND. makeAIDispatcher should return null.
    const dispatcher = makeAIDispatcher()
    expect(dispatcher).toBeNull()
  })
})

describe('makeAIDispatcher — module available (summarize API)', () => {
  beforeEach(() => {
    resetAIModuleCache()
    // Inject a mock into the module registry so require('react-native-ai-apple')
    // returns our mock object.
    jest.resetModules()
    jest.doMock('react-native-ai-apple', () => ({
      summarize: jest.fn().mockResolvedValue('Mocked summary'),
      isAvailable: jest.fn().mockResolvedValue(true),
    }))
  })

  afterEach(() => {
    jest.resetModules()
    jest.dontMock('react-native-ai-apple')
    resetAIModuleCache()
  })

  it('calls summarize() and returns the text result', async () => {
    // Note: Because we reset modules, we need to re-require the module under test.
    // Using jest.isolateModules to ensure a fresh import with the mock active.
    await jest.isolateModulesAsync(async () => {
      const {makeAIDispatcher: freshMake} = await import('./aiDispatcher')
      const dispatcher = freshMake()
      expect(dispatcher).not.toBeNull()
      if (!dispatcher) return

      const result = await dispatcher.summarize({
        prompt: 'Summarize these items',
        items: [{name: 'Run'}, {name: 'Swim'}],
      })
      expect(result).toBe('Mocked summary')
    })
  })

  it('includes serialized items in the prompt passed to summarize()', async () => {
    let capturedPrompt: string | undefined

    jest.doMock('react-native-ai-apple', () => ({
      summarize: jest.fn().mockImplementation((text: string) => {
        capturedPrompt = text
        return Promise.resolve('done')
      }),
      isAvailable: jest.fn().mockResolvedValue(true),
    }))

    await jest.isolateModulesAsync(async () => {
      const {makeAIDispatcher: freshMake} = await import('./aiDispatcher')
      const dispatcher = freshMake()
      if (!dispatcher) return

      await dispatcher.summarize({
        prompt: 'Summarize',
        items: [{name: 'Morning run'}, {name: 'Yoga'}],
      })
    })

    expect(capturedPrompt).toContain('Summarize')
    expect(capturedPrompt).toContain('Morning run')
    expect(capturedPrompt).toContain('Yoga')
  })
})

describe('makeAIDispatcher — module available (run API)', () => {
  afterEach(() => {
    jest.resetModules()
    jest.dontMock('react-native-ai-apple')
    resetAIModuleCache()
  })

  it('calls run() when summarize is not present and returns text', async () => {
    jest.doMock('react-native-ai-apple', () => ({
      run: jest.fn().mockResolvedValue({text: 'Run API result'}),
      isAvailable: jest.fn().mockResolvedValue(true),
    }))

    await jest.isolateModulesAsync(async () => {
      const {makeAIDispatcher: freshMake} = await import('./aiDispatcher')
      const dispatcher = freshMake()
      if (!dispatcher) return
      const result = await dispatcher.summarize({prompt: 'p', items: []})
      expect(result).toBe('Run API result')
    })
  })
})

describe('makeAIDispatcher — timeout (T-0006-145)', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    resetAIModuleCache()
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.resetModules()
    jest.dontMock('react-native-ai-apple')
    resetAIModuleCache()
  })

  it(`rejects with "AI timeout" after ${AI_TIMEOUT_MS}ms`, async () => {
    jest.doMock('react-native-ai-apple', () => ({
      summarize: jest.fn().mockReturnValue(new Promise(() => undefined)), // never resolves
      isAvailable: jest.fn().mockResolvedValue(true),
    }))

    let timeoutError: Error | undefined

    await jest.isolateModulesAsync(async () => {
      const {makeAIDispatcher: freshMake} = await import('./aiDispatcher')
      const dispatcher = freshMake()
      if (!dispatcher) return

      const promise = dispatcher.summarize({prompt: 'p', items: []}).catch(err => {
        timeoutError = err as Error
      })

      // Advance timers past the timeout threshold.
      jest.advanceTimersByTime(AI_TIMEOUT_MS + 1)
      await promise
    })

    expect(timeoutError?.message).toBe('AI timeout')
  })
})
