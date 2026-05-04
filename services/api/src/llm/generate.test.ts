/**
 * T-0002-028 through T-0002-039
 * Unit tests for generateAppSpec generator.
 * All Anthropic calls are mocked — no API key required.
 *
 * Error class checks use .name / .code instead of instanceof because
 * jest.mock + dynamic import creates multiple module registries; the error
 * class thrown inside the generator is a different copy than the one at the
 * top of this file. Checking constructor name is equivalent and immune to
 * the cross-registry class identity problem.
 */

import {
  mockAnthropicStream,
  mockAnthropicError,
  MINIMAL_VALID_SPEC,
  makeToolUseMessage,
  makeToolUseStartEvent,
  makeSuccessEvents,
} from '../../test/mocks/anthropic.js'

// ---------------------------------------------------------------------------
// Module-level mock — applied before any imports of the mocked modules
// ---------------------------------------------------------------------------

jest.mock('@anthropic-ai/sdk')

// Mock the singleton so it never tries to read ANTHROPIC_API_KEY.
jest.mock('./anthropic.js', () => ({
  anthropic: {
    beta: {
      promptCaching: {
        messages: {
          stream: jest.fn(),
        },
      },
    },
  },
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function collectEvents(gen: AsyncGenerator<unknown>): Promise<unknown[]> {
  const events: unknown[] = []
  for await (const event of gen) {
    events.push(event)
  }
  return events
}

function getStreamMock(): jest.Mock {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const {anthropic} = require('./anthropic.js')
  return anthropic.beta.promptCaching.messages.stream as jest.Mock
}

function capturedStreamCall(streamMock: jest.Mock): Record<string, unknown> {
  return streamMock.mock.calls[0]?.[0] as Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateAppSpec', () => {
  const OPTS = {userId: 'user-123', prompt: 'Build me a todo app'}

  beforeEach(() => {
    process.env['ANTHROPIC_API_KEY'] = 'sk-ant-test'
    getStreamMock().mockReset()
  })

  // T-0002-028
  it('yields thinking_started as the first event (synchronously before first await)', async () => {
    const streamMock = getStreamMock()
    streamMock.mockImplementation(
      mockAnthropicStream(makeSuccessEvents(), makeToolUseMessage(MINIMAL_VALID_SPEC)),
    )

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {generateAppSpec} = require('./generate.js')
    const gen = generateAppSpec(OPTS)

    const first = await gen.next()
    expect(first.value).toEqual({type: 'thinking_started'})
  })

  // T-0002-029
  it('yields building_started when stream emits content_block_start with type tool_use', async () => {
    const streamMock = getStreamMock()
    streamMock.mockImplementation(
      mockAnthropicStream(makeSuccessEvents(), makeToolUseMessage(MINIMAL_VALID_SPEC)),
    )

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {generateAppSpec} = require('./generate.js')
    const events = await collectEvents(generateAppSpec(OPTS))

    const types = events.map((e: unknown) => (e as {type: string}).type)
    expect(types).toContain('building_started')
  })

  // T-0002-030
  it('yields done with parsed spec from valid mocked tool input', async () => {
    const streamMock = getStreamMock()
    streamMock.mockImplementation(
      mockAnthropicStream(makeSuccessEvents(), makeToolUseMessage(MINIMAL_VALID_SPEC)),
    )

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {generateAppSpec} = require('./generate.js')
    const events = await collectEvents(generateAppSpec(OPTS))

    const done = events.find((e: unknown) => (e as {type: string}).type === 'done') as {
      type: 'done'
      spec: unknown
      thinking_duration_ms: number
      generation_duration_ms: number
    }
    expect(done).toBeDefined()
    expect(done.spec).toMatchObject(MINIMAL_VALID_SPEC)
    expect(typeof done.thinking_duration_ms).toBe('number')
    expect(typeof done.generation_duration_ms).toBe('number')
  })

  // T-0002-031
  it('throws InvalidSpecError(invalid_spec) when tool input fails A2UISpecSchema', async () => {
    const invalidInput = {version: 1, views: [], initialViewId: 'missing'} // views must have min(1)

    const streamMock = getStreamMock()
    streamMock.mockImplementation(
      mockAnthropicStream(makeSuccessEvents(), makeToolUseMessage(invalidInput)),
    )

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {generateAppSpec} = require('./generate.js')

    let caught: unknown
    try {
      await collectEvents(generateAppSpec(OPTS))
    } catch (err) {
      caught = err
    }

    expect(caught).toBeDefined()
    expect((caught as {name: string}).name).toBe('InvalidSpecError')
    expect((caught as {code: string}).code).toBe('invalid_spec')
  })

  // T-0002-032
  it('throws InvalidSpecError(no_tool_use) when finalMessage has no tool_use block', async () => {
    const finalMsg = {
      id: 'msg_test',
      role: 'assistant',
      stop_reason: 'end_turn',
      content: [{type: 'text', text: 'some plain text'}],
    }

    const streamMock = getStreamMock()
    streamMock.mockImplementation(
      mockAnthropicStream(
        [{type: 'message_start', message: {}}, {type: 'message_stop'}],
        finalMsg as never,
      ),
    )

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {generateAppSpec} = require('./generate.js')

    let caught: unknown
    try {
      await collectEvents(generateAppSpec(OPTS))
    } catch (err) {
      caught = err
    }

    expect(caught).toBeDefined()
    expect((caught as {name: string}).name).toBe('InvalidSpecError')
    expect((caught as {code: string}).code).toBe('no_tool_use')
  })

  // T-0002-033
  it('retries 2× with exponential backoff on 429, then throws RateLimitedError', async () => {
    jest.useFakeTimers()

    const streamMock = getStreamMock()
    streamMock.mockImplementation(mockAnthropicError(429))

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {generateAppSpec} = require('./generate.js')

    let caught: unknown
    const promise = collectEvents(generateAppSpec(OPTS)).catch((err: unknown) => {
      caught = err
    })

    // Advance through both retry sleeps (1000ms + 2000ms)
    await jest.advanceTimersByTimeAsync(4000)
    await promise

    expect(caught).toBeDefined()
    expect((caught as {name: string}).name).toBe('RateLimitedError')
    // stream() should have been called 3 times total (initial + 2 retries)
    expect(streamMock).toHaveBeenCalledTimes(3)

    jest.useRealTimers()
  })

  // T-0002-034
  it('throws AnthropicTransportError on a 500 response', async () => {
    const streamMock = getStreamMock()
    streamMock.mockImplementation(mockAnthropicError(500, 'Internal Server Error'))

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {generateAppSpec} = require('./generate.js')

    let caught: unknown
    try {
      await collectEvents(generateAppSpec(OPTS))
    } catch (err) {
      caught = err
    }

    expect(caught).toBeDefined()
    expect((caught as {name: string}).name).toBe('AnthropicTransportError')
    // Only one attempt for non-429 errors
    expect(streamMock).toHaveBeenCalledTimes(1)
  })

  // T-0002-035
  it('sends metadata.user_id as sha256(userId).slice(0,16), not raw userId', async () => {
    const streamMock = getStreamMock()
    streamMock.mockImplementation(
      mockAnthropicStream(makeSuccessEvents(), makeToolUseMessage(MINIMAL_VALID_SPEC)),
    )

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {generateAppSpec} = require('./generate.js')
    await collectEvents(generateAppSpec(OPTS))

    const call = capturedStreamCall(streamMock)
    const metadata = call['metadata'] as {user_id: string}

    expect(metadata.user_id).not.toBe(OPTS.userId)
    expect(metadata.user_id).toHaveLength(16)
    // Verify it's a hex string (sha256 output)
    expect(metadata.user_id).toMatch(/^[0-9a-f]{16}$/)
  })

  // T-0002-036
  it('system block array has cache_control on catalog block, absent on static block', async () => {
    const streamMock = getStreamMock()
    streamMock.mockImplementation(
      mockAnthropicStream(makeSuccessEvents(), makeToolUseMessage(MINIMAL_VALID_SPEC)),
    )

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {generateAppSpec} = require('./generate.js')
    await collectEvents(generateAppSpec(OPTS))

    const call = capturedStreamCall(streamMock)
    const system = call['system'] as Array<{type: string; text: string; cache_control?: unknown}>

    expect(system).toHaveLength(2)
    expect(system.at(0)?.cache_control).toBeUndefined()
    expect(system.at(1)?.cache_control).toEqual({type: 'ephemeral'})
  })

  // T-0002-037
  it('API key does not appear in AnthropicTransportError as an extra field (code stays transport_error)', async () => {
    const fakeKey = 'sk-ant-super-secret-key-should-not-leak'
    process.env['ANTHROPIC_API_KEY'] = fakeKey

    const sdkErr = Object.assign(new Error(`Auth failed: ${fakeKey}`), {status: 401})
    const streamMock = getStreamMock()
    streamMock.mockReturnValue({
      [Symbol.asyncIterator]: async function* () {
        throw sdkErr
      },
      finalMessage: jest.fn().mockRejectedValue(sdkErr),
    })

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {generateAppSpec} = require('./generate.js')

    let caught: unknown
    try {
      await collectEvents(generateAppSpec(OPTS))
    } catch (err) {
      caught = err
    }

    expect(caught).toBeDefined()
    expect((caught as {name: string}).name).toBe('AnthropicTransportError')
    expect((caught as {code: string}).code).toBe('transport_error')
    // No extra fields that could expose the key
    expect((caught as Record<string, unknown>)['apiKey']).toBeUndefined()
    expect((caught as Record<string, unknown>)['key']).toBeUndefined()
  })

  // T-0002-038
  it('sends exactly max_tokens=8000, thinking.budget_tokens=4000, tool_choice={type:tool,name:produce_app_spec}', async () => {
    const streamMock = getStreamMock()
    streamMock.mockImplementation(
      mockAnthropicStream(makeSuccessEvents(), makeToolUseMessage(MINIMAL_VALID_SPEC)),
    )

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {generateAppSpec} = require('./generate.js')
    await collectEvents(generateAppSpec(OPTS))

    const call = capturedStreamCall(streamMock)

    expect(call['max_tokens']).toBe(8000)
    expect(call['thinking']).toEqual({type: 'enabled', budget_tokens: 4000})
    expect(call['tool_choice']).toEqual({type: 'tool', name: 'produce_app_spec'})
  })

  // T-0002-039
  it('does NOT yield building_started more than once even if stream emits multiple tool_use blocks', async () => {
    const multiToolEvents = [
      {type: 'message_start' as const, message: {id: 'msg_test', role: 'assistant' as const}},
      makeToolUseStartEvent(0),
      makeToolUseStartEvent(1), // second tool_use start — should be silenced
      {type: 'message_stop' as const},
    ]

    const streamMock = getStreamMock()
    streamMock.mockImplementation(
      mockAnthropicStream(multiToolEvents, makeToolUseMessage(MINIMAL_VALID_SPEC)),
    )

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {generateAppSpec} = require('./generate.js')
    const events = await collectEvents(generateAppSpec(OPTS))

    const buildingEvents = events.filter(
      (e: unknown) => (e as {type: string}).type === 'building_started',
    )
    expect(buildingEvents).toHaveLength(1)
  })
})
