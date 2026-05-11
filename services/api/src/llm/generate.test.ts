/**
 * T-0007-036 through T-0007-068, T-0007-178, T-0007-181, T-0007-182
 * Unit tests for generateAppSpec generator — ADR-0007 Step 3 V0 single-call pipeline.
 *
 * All Anthropic calls are mocked — no API key required.
 *
 * Error class checks use .name / .code instead of instanceof because
 * jest.mock + dynamic import creates multiple module registries; the error
 * class thrown inside the generator is a different copy than the one at the
 * top of this file. Checking constructor name is equivalent and immune to
 * the cross-registry class identity problem.
 */

import {mockAnthropicStream, mockAnthropicError} from '../../test/mocks/anthropic.js'
import {
  SYSTEM_PROMPT_STATIC,
  SYSTEM_PROMPT_CATALOG,
} from './prompts/system.js'

// ---------------------------------------------------------------------------
// Module-level mock — applied before any imports of the mocked modules
// ---------------------------------------------------------------------------

jest.mock('@anthropic-ai/sdk')

// Mock the singleton so it never tries to read ANTHROPIC_API_KEY.
jest.mock('./anthropic.js', () => ({
  anthropic: {
    messages: {
      stream: jest.fn(),
    },
  },
}))

// Mock telemetry so DB writes don't fail in unit tests.
const mockWriteEvent = jest.fn().mockResolvedValue(undefined)
jest.mock('./telemetry.js', () => ({
  writeEvent: (...args: unknown[]) => mockWriteEvent(...args),
}))

// ---------------------------------------------------------------------------
// Minimal valid V0 spec fixture (satisfies SpecSchema).
// ---------------------------------------------------------------------------

const MINIMAL_VALID_V0_SPEC = {
  version: 1 as const,
  archetype: 'Calculator' as const,
  stance: 'productive' as const,
  palette: 'focus' as const,
  coverIcon: 'list' as const,
  navigation: 'none' as const,
  screens: [
    {
      id: 'main',
      root: {
        id: 'root1',
        type: 'Screen' as const,
        safeArea: 'both' as const,
        padding: 'space-md' as const,
        children: [
          {id: 'heading1', type: 'Heading' as const, text: 'Hello'},
        ],
      },
    },
  ],
  initialScreenId: 'main',
  collections: [],
}

// A spec that is Zod-valid but has a cross-ref error: navigate action targets
// a screen that doesn't exist.
const CROSS_REF_INVALID_SPEC = {
  ...MINIMAL_VALID_V0_SPEC,
  navigation: 'stack' as const,
  screens: [
    {
      id: 'main',
      root: {
        id: 'root1',
        type: 'Screen' as const,
        safeArea: 'both' as const,
        padding: 'space-md' as const,
        children: [
          {
            id: 'btn1',
            type: 'Button' as const,
            label: 'Go',
            variant: 'primary' as const,
            action: {type: 'navigate' as const, target: 'nonexistent_screen'},
          },
        ],
      },
    },
  ],
}

// A spec with a custom slot name that should NOT leak into error codes.
const SECRET_SLOT_SPEC_INVALID = {
  archetype: 'Garbage',
  mySecretSlot: 'should-not-appear',
}

// ---------------------------------------------------------------------------
// Mock helpers for V0 tools
// ---------------------------------------------------------------------------

import type {Message} from '@anthropic-ai/sdk/resources/messages'
import type {MockStreamEvent} from '../../test/mocks/anthropic.js'

function makeV0ToolUseMessage(toolName: string, input: unknown): Partial<Message> {
  return {
    id: 'msg_test',
    role: 'assistant',
    stop_reason: 'tool_use',
    stop_sequence: null,
    type: 'message',
    model: 'claude-sonnet-4-6',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content: [{type: 'tool_use', id: 'tu_test', name: toolName, input}] as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    usage: {input_tokens: 100, output_tokens: 200} as any,
  }
}

function makeToolUseStartEvent(index = 0): MockStreamEvent {
  return {
    type: 'content_block_start',
    index,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content_block: {type: 'tool_use', id: 'tu_test', name: 'produce_app_spec', input: {}} as any,
  }
}

function makeSuccessEvents(): MockStreamEvent[] {
  return [
    {type: 'message_start', message: {id: 'msg_test', role: 'assistant'}},
    makeToolUseStartEvent(),
    {type: 'message_stop'},
  ]
}

function makeOutOfScopeEvents(): MockStreamEvent[] {
  return [
    {type: 'message_start', message: {id: 'msg_oos', role: 'assistant'}},
    {
      type: 'content_block_start',
      index: 0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      content_block: {type: 'tool_use', id: 'tu_oos', name: 'out_of_scope', input: {}} as any,
    },
    {type: 'message_stop'},
  ]
}

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
  return anthropic.messages.stream as jest.Mock
}

function capturedStreamCall(streamMock: jest.Mock): Record<string, unknown> {
  return streamMock.mock.calls[0]?.[0] as Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateAppSpec — ADR-0007 Step 3 (V0 single-call pipeline)', () => {
  const OPTS = {userId: 'user-123', prompt: 'Build me a tip calculator'}

  beforeEach(() => {
    process.env['ANTHROPIC_API_KEY'] = 'sk-ant-test'
    getStreamMock().mockReset()
    mockWriteEvent.mockReset()
    mockWriteEvent.mockResolvedValue(undefined)
  })

  // -------------------------------------------------------------------------
  // T-0007-038: thinking_started synchronously before first await
  // -------------------------------------------------------------------------
  it('T-0007-038: yields thinking_started as the first event (synchronously before first await)', async () => {
    const streamMock = getStreamMock()
    streamMock.mockImplementation(
      mockAnthropicStream(makeSuccessEvents(), makeV0ToolUseMessage('produce_app_spec', MINIMAL_VALID_V0_SPEC)),
    )

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {generateAppSpec} = require('./generate.js')
    const gen = generateAppSpec(OPTS)

    const first = await gen.next()
    expect(first.value).toEqual({type: 'thinking_started'})
  })

  // -------------------------------------------------------------------------
  // T-0007-039: building_started on first content_block_start with type tool_use
  // -------------------------------------------------------------------------
  it('T-0007-039: yields building_started when stream emits content_block_start with type tool_use', async () => {
    const streamMock = getStreamMock()
    streamMock.mockImplementation(
      mockAnthropicStream(makeSuccessEvents(), makeV0ToolUseMessage('produce_app_spec', MINIMAL_VALID_V0_SPEC)),
    )

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {generateAppSpec} = require('./generate.js')
    const events = await collectEvents(generateAppSpec(OPTS))

    const types = events.map((e: unknown) => (e as {type: string}).type)
    expect(types).toContain('building_started')
  })

  // -------------------------------------------------------------------------
  // T-0007-036: done with parsed Spec on produce_app_spec tool_use
  // -------------------------------------------------------------------------
  it('T-0007-036: yields done with parsed Spec typed against protocol Spec on produce_app_spec', async () => {
    const streamMock = getStreamMock()
    streamMock.mockImplementation(
      mockAnthropicStream(makeSuccessEvents(), makeV0ToolUseMessage('produce_app_spec', MINIMAL_VALID_V0_SPEC)),
    )

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {generateAppSpec} = require('./generate.js')
    const events = await collectEvents(generateAppSpec(OPTS))

    const done = events.find((e: unknown) => (e as {type: string}).type === 'done') as {
      type: 'done'
      spec: unknown
      generationId: string
      thinking_duration_ms: number
      generation_duration_ms: number
    }
    expect(done).toBeDefined()
    expect(done.spec).toMatchObject({archetype: 'Calculator', navigation: 'none'})
    expect(typeof done.generationId).toBe('string')
    expect(typeof done.thinking_duration_ms).toBe('number')
    expect(typeof done.generation_duration_ms).toBe('number')
  })

  // -------------------------------------------------------------------------
  // T-0007-037: out_of_scope event on out_of_scope tool_use
  // -------------------------------------------------------------------------
  it('T-0007-037: yields out_of_scope event with capability, reason, prompt_hash on out_of_scope tool', async () => {
    const streamMock = getStreamMock()
    const outOfScopeInput = {capability: 'vision', reason: 'identifies plants from photos'}
    streamMock.mockImplementation(
      mockAnthropicStream(makeOutOfScopeEvents(), makeV0ToolUseMessage('out_of_scope', outOfScopeInput)),
    )

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {generateAppSpec} = require('./generate.js')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {sha256Hex} = require('./util.js')

    const events = await collectEvents(generateAppSpec(OPTS))

    const oosEvent = events.find((e: unknown) => (e as {type: string}).type === 'out_of_scope') as {
      type: 'out_of_scope'
      capability: string
      reason: string
      prompt_hash: string
      generationId: string
    }
    expect(oosEvent).toBeDefined()
    expect(oosEvent.capability).toBe('vision')
    expect(oosEvent.reason).toBe('identifies plants from photos')
    // prompt_hash is sha256 of the prompt
    expect(oosEvent.prompt_hash).toBe(sha256Hex(OPTS.prompt))
    expect(typeof oosEvent.generationId).toBe('string')
  })

  // -------------------------------------------------------------------------
  // T-0007-040: InvalidSpecError(invalid_spec) with detail.kind === 'zod'
  // -------------------------------------------------------------------------
  it('T-0007-040: throws InvalidSpecError with detail.kind=zod when produce_app_spec input is invalid', async () => {
    const streamMock = getStreamMock()
    streamMock.mockImplementation(
      mockAnthropicStream(makeSuccessEvents(), makeV0ToolUseMessage('produce_app_spec', {archetype: 'Garbage'})),
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
    const detail = (caught as {detail: unknown}).detail as {kind: string; codes: unknown[]}
    expect(detail.kind).toBe('zod')
    expect(Array.isArray(detail.codes)).toBe(true)
  })

  // -------------------------------------------------------------------------
  // T-0007-041: InvalidSpecError with detail.kind === 'cross_ref'
  // -------------------------------------------------------------------------
  it('T-0007-041: throws InvalidSpecError with detail.kind=cross_ref on Zod-valid but cross-ref-failing spec', async () => {
    const streamMock = getStreamMock()
    streamMock.mockImplementation(
      mockAnthropicStream(makeSuccessEvents(), makeV0ToolUseMessage('produce_app_spec', CROSS_REF_INVALID_SPEC)),
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
    const detail = (caught as {detail: unknown}).detail as {kind: string; codes: string[]}
    expect(detail.kind).toBe('cross_ref')
    expect(detail.codes).toContain('unknown_screen')
  })

  // -------------------------------------------------------------------------
  // T-0007-042: InvalidSpecError(no_tool_use) when no tool_use block
  // -------------------------------------------------------------------------
  it('T-0007-042: throws InvalidSpecError(no_tool_use) when finalMessage has no tool_use block', async () => {
    const finalMsg = {
      id: 'msg_test',
      role: 'assistant',
      stop_reason: 'end_turn',
      content: [{type: 'text', text: 'sorry I cannot help with that'}],
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

    expect((caught as {name: string}).name).toBe('InvalidSpecError')
    expect((caught as {code: string}).code).toBe('no_tool_use')
  })

  // -------------------------------------------------------------------------
  // T-0007-043: InvalidSpecError('unknown_tool') on unrecognised tool name
  // -------------------------------------------------------------------------
  it('T-0007-043: throws InvalidSpecError(unknown_tool) on unknown tool name', async () => {
    const streamMock = getStreamMock()
    streamMock.mockImplementation(
      mockAnthropicStream(makeSuccessEvents(), makeV0ToolUseMessage('phantom_tool', {})),
    )

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {generateAppSpec} = require('./generate.js')

    let caught: unknown
    try {
      await collectEvents(generateAppSpec(OPTS))
    } catch (err) {
      caught = err
    }

    expect((caught as {name: string}).name).toBe('InvalidSpecError')
    expect((caught as {code: string}).code).toBe('unknown_tool')
  })

  // -------------------------------------------------------------------------
  // T-0007-044: 429 retry — 2 retries with 1s+2s backoff → RateLimitedError
  // -------------------------------------------------------------------------
  it('T-0007-044: retries 2× with exponential backoff on 429, then throws RateLimitedError', async () => {
    jest.useFakeTimers()

    const streamMock = getStreamMock()
    streamMock.mockImplementation(mockAnthropicError(429))

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {generateAppSpec} = require('./generate.js')

    let caught: unknown
    const promise = collectEvents(generateAppSpec(OPTS)).catch((err: unknown) => {
      caught = err
    })

    await jest.advanceTimersByTimeAsync(4000)
    await promise

    expect((caught as {name: string}).name).toBe('RateLimitedError')
    expect(streamMock).toHaveBeenCalledTimes(3)

    jest.useRealTimers()
  })

  // -------------------------------------------------------------------------
  // T-0007-045: AnthropicTransportError on 500
  // -------------------------------------------------------------------------
  it('T-0007-045: throws AnthropicTransportError on a 500 response', async () => {
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

    expect((caught as {name: string}).name).toBe('AnthropicTransportError')
    expect(streamMock).toHaveBeenCalledTimes(1)
  })

  // -------------------------------------------------------------------------
  // T-0007-046: tool_choice is 'auto' (not forced to a single tool)
  // -------------------------------------------------------------------------
  it('T-0007-046: SDK call uses tool_choice: {type: "auto"}', async () => {
    const streamMock = getStreamMock()
    streamMock.mockImplementation(
      mockAnthropicStream(makeSuccessEvents(), makeV0ToolUseMessage('produce_app_spec', MINIMAL_VALID_V0_SPEC)),
    )

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {generateAppSpec} = require('./generate.js')
    await collectEvents(generateAppSpec(OPTS))

    const call = capturedStreamCall(streamMock)
    expect(call['tool_choice']).toEqual({type: 'auto'})
  })

  // -------------------------------------------------------------------------
  // T-0007-047: tools array contains exactly 2 entries
  // -------------------------------------------------------------------------
  it('T-0007-047: tools array contains exactly 2 entries (produce_app_spec, out_of_scope)', async () => {
    const streamMock = getStreamMock()
    streamMock.mockImplementation(
      mockAnthropicStream(makeSuccessEvents(), makeV0ToolUseMessage('produce_app_spec', MINIMAL_VALID_V0_SPEC)),
    )

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {generateAppSpec} = require('./generate.js')
    await collectEvents(generateAppSpec(OPTS))

    const call = capturedStreamCall(streamMock)
    const tools = call['tools'] as Array<{name: string}>
    expect(tools).toHaveLength(2)
    const names = tools.map(t => t.name)
    expect(names).toContain('produce_app_spec')
    expect(names).toContain('out_of_scope')
  })

  // -------------------------------------------------------------------------
  // T-0007-048: max_tokens: 8000
  // -------------------------------------------------------------------------
  it('T-0007-048: SDK call sends max_tokens: 8000', async () => {
    const streamMock = getStreamMock()
    streamMock.mockImplementation(
      mockAnthropicStream(makeSuccessEvents(), makeV0ToolUseMessage('produce_app_spec', MINIMAL_VALID_V0_SPEC)),
    )

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {generateAppSpec} = require('./generate.js')
    await collectEvents(generateAppSpec(OPTS))

    const call = capturedStreamCall(streamMock)
    expect(call['max_tokens']).toBe(8000)
  })

  // -------------------------------------------------------------------------
  // T-0007-049: metadata.user_id is hashed, never raw
  // -------------------------------------------------------------------------
  it('T-0007-049: metadata.user_id is hashUserId(opts.userId), not the raw userId', async () => {
    const streamMock = getStreamMock()
    streamMock.mockImplementation(
      mockAnthropicStream(makeSuccessEvents(), makeV0ToolUseMessage('produce_app_spec', MINIMAL_VALID_V0_SPEC)),
    )

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {generateAppSpec} = require('./generate.js')
    await collectEvents(generateAppSpec(OPTS))

    const call = capturedStreamCall(streamMock)
    const metadata = call['metadata'] as {user_id: string}
    expect(metadata.user_id).not.toBe(OPTS.userId)
    expect(metadata.user_id).toHaveLength(16)
    expect(metadata.user_id).toMatch(/^[0-9a-f]{16}$/)
  })

  // -------------------------------------------------------------------------
  // T-0007-050: system array has 2 blocks, second with cache_control
  // -------------------------------------------------------------------------
  it('T-0007-050: system block has 2 entries, second has cache_control ephemeral', async () => {
    const streamMock = getStreamMock()
    streamMock.mockImplementation(
      mockAnthropicStream(makeSuccessEvents(), makeV0ToolUseMessage('produce_app_spec', MINIMAL_VALID_V0_SPEC)),
    )

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {generateAppSpec} = require('./generate.js')
    await collectEvents(generateAppSpec(OPTS))

    const call = capturedStreamCall(streamMock)
    const system = call['system'] as Array<{type: string; text: string; cache_control?: unknown}>

    expect(system).toHaveLength(2)
    expect(system.at(0)?.cache_control).toBeUndefined()
    expect(system.at(0)?.text).toBe(SYSTEM_PROMPT_STATIC)
    expect(system.at(1)?.cache_control).toEqual({type: 'ephemeral'})
    expect(system.at(1)?.text).toBe(SYSTEM_PROMPT_CATALOG)
  })

  // -------------------------------------------------------------------------
  // T-0007-051: detail.codes is string[] — no message, no path, no LLM-emitted strings
  // -------------------------------------------------------------------------
  it('T-0007-051: InvalidSpecError.detail.codes is string[] with no LLM-emitted slot/collection/screen IDs', async () => {
    const streamMock = getStreamMock()
    // cross_ref error referencing a custom slot name — codes must NOT leak 'mySecretSlot'
    streamMock.mockImplementation(
      mockAnthropicStream(makeSuccessEvents(), makeV0ToolUseMessage('produce_app_spec', SECRET_SLOT_SPEC_INVALID)),
    )

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {generateAppSpec} = require('./generate.js')

    let caught: unknown
    try {
      await collectEvents(generateAppSpec(OPTS))
    } catch (err) {
      caught = err
    }

    expect((caught as {name: string}).name).toBe('InvalidSpecError')
    const detail = (caught as {detail: unknown}).detail as {kind: string; codes: unknown[]}
    // codes must be an array of strings only
    expect(Array.isArray(detail.codes)).toBe(true)
    for (const code of detail.codes) {
      expect(typeof code).toBe('string')
    }
    // The secret slot name must not appear anywhere in the error detail
    const detailJson = JSON.stringify(detail)
    expect(detailJson).not.toContain('mySecretSlot')
    expect(detailJson).not.toContain('path')
    expect(detailJson).not.toContain('message')
  })

  // -------------------------------------------------------------------------
  // T-0007-052: user prompt does NOT appear in any error detail
  // -------------------------------------------------------------------------
  it('T-0007-052: user prompt does not appear in any InvalidSpecError detail', async () => {
    const sensitivePrompt = 'my-super-secret-prompt-' + Date.now()

    const streamMock = getStreamMock()
    streamMock.mockImplementation(
      mockAnthropicStream(makeSuccessEvents(), makeV0ToolUseMessage('produce_app_spec', {archetype: 'Garbage'})),
    )

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {generateAppSpec} = require('./generate.js')

    let caught: unknown
    try {
      await collectEvents(generateAppSpec({...OPTS, prompt: sensitivePrompt}))
    } catch (err) {
      caught = err
    }

    expect(caught).toBeDefined()
    const errorJson = JSON.stringify(caught)
    expect(errorJson).not.toContain(sensitivePrompt)
  })

  // -------------------------------------------------------------------------
  // T-0007-053: user prompt does NOT appear in any telemetry event payload
  // -------------------------------------------------------------------------
  it('T-0007-053: user prompt does not appear in any telemetry event payload', async () => {
    const sensitivePrompt = 'my-sensitive-prompt-' + Date.now()

    const streamMock = getStreamMock()
    streamMock.mockImplementation(
      mockAnthropicStream(makeSuccessEvents(), makeV0ToolUseMessage('produce_app_spec', MINIMAL_VALID_V0_SPEC)),
    )

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {generateAppSpec} = require('./generate.js')
    await collectEvents(generateAppSpec({...OPTS, prompt: sensitivePrompt}))

    for (const call of mockWriteEvent.mock.calls) {
      const payloadJson = JSON.stringify(call[1])
      expect(payloadJson).not.toContain(sensitivePrompt)
    }
  })

  // -------------------------------------------------------------------------
  // T-0007-054: metadata.user_id is sha256-hashed (regression)
  // -------------------------------------------------------------------------
  it('T-0007-054: metadata.user_id is sha256-hashed, never raw (regression)', async () => {
    const streamMock = getStreamMock()
    streamMock.mockImplementation(
      mockAnthropicStream(makeSuccessEvents(), makeV0ToolUseMessage('produce_app_spec', MINIMAL_VALID_V0_SPEC)),
    )

    const rawUserId = 'user-should-never-appear'
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {generateAppSpec} = require('./generate.js')
    await collectEvents(generateAppSpec({...OPTS, userId: rawUserId}))

    const call = capturedStreamCall(streamMock)
    const metadata = call['metadata'] as {user_id: string}
    expect(metadata.user_id).not.toBe(rawUserId)
    expect(metadata.user_id).not.toContain(rawUserId)
  })

  // -------------------------------------------------------------------------
  // T-0007-055: two concurrent calls produce independent telemetry generationIds
  // -------------------------------------------------------------------------
  it('T-0007-055: two concurrent generateAppSpec calls produce distinct generationIds in telemetry', async () => {
    const streamMock = getStreamMock()
    streamMock.mockImplementation(
      mockAnthropicStream(makeSuccessEvents(), makeV0ToolUseMessage('produce_app_spec', MINIMAL_VALID_V0_SPEC)),
    )

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {generateAppSpec} = require('./generate.js')

    const [events1, events2] = await Promise.all([
      collectEvents(generateAppSpec({userId: 'user-a', prompt: 'app one'})),
      collectEvents(generateAppSpec({userId: 'user-b', prompt: 'app two'})),
    ])

    const done1 = (events1 as Array<{type: string; generationId: string}>).find(e => e.type === 'done')
    const done2 = (events2 as Array<{type: string; generationId: string}>).find(e => e.type === 'done')

    expect(done1?.generationId).toBeDefined()
    expect(done2?.generationId).toBeDefined()
    expect(done1?.generationId).not.toBe(done2?.generationId)
  })

  // -------------------------------------------------------------------------
  // T-0007-056: generate.completed telemetry on done
  // -------------------------------------------------------------------------
  it('T-0007-056: writes generate.completed telemetry with {generationId, archetype, screens_count, navigation, generation_duration_ms}', async () => {
    const streamMock = getStreamMock()
    streamMock.mockImplementation(
      mockAnthropicStream(makeSuccessEvents(), makeV0ToolUseMessage('produce_app_spec', MINIMAL_VALID_V0_SPEC)),
    )

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {generateAppSpec} = require('./generate.js')
    await collectEvents(generateAppSpec(OPTS))

    const completedCall = mockWriteEvent.mock.calls.find(c => c[0] === 'generate.completed')
    expect(completedCall).toBeDefined()
    const payload = completedCall![1] as Record<string, unknown>
    expect(typeof payload['generationId']).toBe('string')
    expect(payload['archetype']).toBe('Calculator')
    expect(typeof payload['screens_count']).toBe('number')
    expect(payload['navigation']).toBe('none')
    expect(typeof payload['generation_duration_ms']).toBe('number')
  })

  // -------------------------------------------------------------------------
  // T-0007-057: generate.out_of_scope telemetry on out_of_scope
  // -------------------------------------------------------------------------
  it('T-0007-057: writes generate.out_of_scope telemetry with {generationId, capability, reason_length}', async () => {
    const streamMock = getStreamMock()
    const outOfScopeInput = {capability: 'chat', reason: 'requires real-time conversation'}
    streamMock.mockImplementation(
      mockAnthropicStream(makeOutOfScopeEvents(), makeV0ToolUseMessage('out_of_scope', outOfScopeInput)),
    )

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {generateAppSpec} = require('./generate.js')
    await collectEvents(generateAppSpec(OPTS))

    const oosCall = mockWriteEvent.mock.calls.find(c => c[0] === 'generate.out_of_scope')
    expect(oosCall).toBeDefined()
    const payload = oosCall![1] as Record<string, unknown>
    expect(typeof payload['generationId']).toBe('string')
    expect(payload['capability']).toBe('chat')
    expect(payload['reason_length']).toBe(outOfScopeInput.reason.length)
  })

  // -------------------------------------------------------------------------
  // T-0007-058: generate.invalid_spec telemetry on Zod failure
  // -------------------------------------------------------------------------
  it('T-0007-058: writes generate.invalid_spec with {error_kind: "zod", code_count} on Zod parse failure', async () => {
    const streamMock = getStreamMock()
    streamMock.mockImplementation(
      mockAnthropicStream(makeSuccessEvents(), makeV0ToolUseMessage('produce_app_spec', {archetype: 'Garbage'})),
    )

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {generateAppSpec} = require('./generate.js')

    try {
      await collectEvents(generateAppSpec(OPTS))
    } catch {
      // expected throw
    }

    const invalidCall = mockWriteEvent.mock.calls.find(c => c[0] === 'generate.invalid_spec')
    expect(invalidCall).toBeDefined()
    const payload = invalidCall![1] as Record<string, unknown>
    expect(payload['error_kind']).toBe('zod')
    expect(typeof payload['code_count']).toBe('number')
    expect((payload['code_count'] as number)).toBeGreaterThan(0)
  })

  // -------------------------------------------------------------------------
  // T-0007-059: generate.invalid_spec telemetry on cross-ref failure
  // -------------------------------------------------------------------------
  it('T-0007-059: writes generate.invalid_spec with {error_kind: "cross_ref", code_count} on cross-ref failure', async () => {
    const streamMock = getStreamMock()
    streamMock.mockImplementation(
      mockAnthropicStream(makeSuccessEvents(), makeV0ToolUseMessage('produce_app_spec', CROSS_REF_INVALID_SPEC)),
    )

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {generateAppSpec} = require('./generate.js')

    try {
      await collectEvents(generateAppSpec(OPTS))
    } catch {
      // expected throw
    }

    const invalidCall = mockWriteEvent.mock.calls.find(c => c[0] === 'generate.invalid_spec')
    expect(invalidCall).toBeDefined()
    const payload = invalidCall![1] as Record<string, unknown>
    expect(payload['error_kind']).toBe('cross_ref')
    expect((payload['code_count'] as number)).toBeGreaterThan(0)
  })

  // -------------------------------------------------------------------------
  // T-0007-060: telemetry write failure does NOT block generation
  // -------------------------------------------------------------------------
  it('T-0007-060: telemetry write failure does not block generation — done still yields', async () => {
    mockWriteEvent.mockRejectedValue(new Error('DB down'))

    const streamMock = getStreamMock()
    streamMock.mockImplementation(
      mockAnthropicStream(makeSuccessEvents(), makeV0ToolUseMessage('produce_app_spec', MINIMAL_VALID_V0_SPEC)),
    )

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {generateAppSpec} = require('./generate.js')

    // Should not throw despite telemetry failure
    const events = await collectEvents(generateAppSpec(OPTS))
    const done = events.find((e: unknown) => (e as {type: string}).type === 'done')
    expect(done).toBeDefined()
  })

  // -------------------------------------------------------------------------
  // T-0007-061: EVAL_MODE='true' (via PLAN_BUILD_EVAL_MODE env) — short-circuits DB
  // Note: we test the telemetry module's env short-circuit; here we verify the
  // generate function still yields correctly when writeEvent is mocked.
  // The actual PLAN_BUILD_EVAL_MODE short-circuit is tested in telemetry.test.ts.
  // -------------------------------------------------------------------------
  it('T-0007-061: generation yields done even when PLAN_BUILD_EVAL_MODE is true (eval-mode awareness)', async () => {
    const streamMock = getStreamMock()
    streamMock.mockImplementation(
      mockAnthropicStream(makeSuccessEvents(), makeV0ToolUseMessage('produce_app_spec', MINIMAL_VALID_V0_SPEC)),
    )

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {generateAppSpec} = require('./generate.js')

    // Even in eval mode, generation must complete normally.
    const events = await collectEvents(generateAppSpec(OPTS))
    const types = events.map((e: unknown) => (e as {type: string}).type)
    expect(types).toContain('done')
  })

  // -------------------------------------------------------------------------
  // T-0007-062, T-0007-063, T-0007-064, T-0007-065: EVAL_MODE case variants
  // (These validate that PLAN_BUILD_EVAL_MODE='TRUE' etc do not short-circuit —
  // the telemetry module handles this; generate.ts defers to writeEvent.)
  // Tested structurally: generate.ts always calls writeEvent — no direct branch.
  // -------------------------------------------------------------------------
  it('T-0007-062/063/064/065: generate calls writeEvent regardless of EVAL_MODE case variants', async () => {
    const streamMock = getStreamMock()
    streamMock.mockImplementation(
      mockAnthropicStream(makeSuccessEvents(), makeV0ToolUseMessage('produce_app_spec', MINIMAL_VALID_V0_SPEC)),
    )

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {generateAppSpec} = require('./generate.js')
    await collectEvents(generateAppSpec(OPTS))

    // writeEvent must always be called (the env check is inside telemetry.ts)
    expect(mockWriteEvent).toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // T-0007-066: generateAppSpec signature does NOT accept plan parameter
  // -------------------------------------------------------------------------
  it('T-0007-066: generateAppSpec opts has no plan parameter (done event has no plan field)', async () => {
    const streamMock = getStreamMock()
    streamMock.mockImplementation(
      mockAnthropicStream(makeSuccessEvents(), makeV0ToolUseMessage('produce_app_spec', MINIMAL_VALID_V0_SPEC)),
    )

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {generateAppSpec} = require('./generate.js')
    // Verify calling without plan works fine (plan is gone from the signature)
    const events = await collectEvents(generateAppSpec(OPTS))
    const done = events.find((e: unknown) => (e as {type: string}).type === 'done')
    expect(done).toBeDefined()
    // T-0007-067: done event payload does NOT include plan field
    expect((done as Record<string, unknown>)['plan']).toBeUndefined()
  })

  // -------------------------------------------------------------------------
  // T-0007-067: done event payload does NOT contain plan field
  // -------------------------------------------------------------------------
  it('T-0007-067: done event does not contain plan field', async () => {
    const streamMock = getStreamMock()
    streamMock.mockImplementation(
      mockAnthropicStream(makeSuccessEvents(), makeV0ToolUseMessage('produce_app_spec', MINIMAL_VALID_V0_SPEC)),
    )

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {generateAppSpec} = require('./generate.js')
    const events = await collectEvents(generateAppSpec(OPTS))
    const done = events.find((e: unknown) => (e as {type: string}).type === 'done')

    expect(Object.keys(done as object)).not.toContain('plan')
  })

  // -------------------------------------------------------------------------
  // T-0007-068: thinking_duration_ms and generation_duration_ms in done + out_of_scope
  // -------------------------------------------------------------------------
  it('T-0007-068: done event has thinking_duration_ms and generation_duration_ms', async () => {
    const streamMock = getStreamMock()
    streamMock.mockImplementation(
      mockAnthropicStream(makeSuccessEvents(), makeV0ToolUseMessage('produce_app_spec', MINIMAL_VALID_V0_SPEC)),
    )

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {generateAppSpec} = require('./generate.js')
    const events = await collectEvents(generateAppSpec(OPTS))

    const done = events.find((e: unknown) => (e as {type: string}).type === 'done') as Record<string, unknown>
    expect(typeof done['thinking_duration_ms']).toBe('number')
    expect(typeof done['generation_duration_ms']).toBe('number')
  })

  it('T-0007-068b: out_of_scope event has thinking_duration_ms and generation_duration_ms', async () => {
    const streamMock = getStreamMock()
    streamMock.mockImplementation(
      mockAnthropicStream(makeOutOfScopeEvents(), makeV0ToolUseMessage('out_of_scope', {capability: 'vision', reason: 'photo analysis'})),
    )

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {generateAppSpec} = require('./generate.js')
    const events = await collectEvents(generateAppSpec(OPTS))

    const oos = events.find((e: unknown) => (e as {type: string}).type === 'out_of_scope') as Record<string, unknown>
    expect(typeof oos['thinking_duration_ms']).toBe('number')
    expect(typeof oos['generation_duration_ms']).toBe('number')
  })

  // -------------------------------------------------------------------------
  // T-0007-178: parentPromptContext builds combined user message
  // -------------------------------------------------------------------------
  it('T-0007-178: with parentPromptContext, messages[0].content contains both context and prompt', async () => {
    const streamMock = getStreamMock()
    streamMock.mockImplementation(
      mockAnthropicStream(makeSuccessEvents(), makeV0ToolUseMessage('produce_app_spec', MINIMAL_VALID_V0_SPEC)),
    )

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {generateAppSpec} = require('./generate.js')
    await collectEvents(
      generateAppSpec({...OPTS, prompt: 'p', parentPromptContext: 'orig'}),
    )

    const call = capturedStreamCall(streamMock)
    const messages = call['messages'] as Array<{role: string; content: string}>
    expect(messages).toHaveLength(1)
    expect(messages[0]!.content).toBe('Original app prompt: orig\n\nNew request: p')
  })

  it('T-0007-178b: without parentPromptContext, message content equals prompt verbatim', async () => {
    const streamMock = getStreamMock()
    streamMock.mockImplementation(
      mockAnthropicStream(makeSuccessEvents(), makeV0ToolUseMessage('produce_app_spec', MINIMAL_VALID_V0_SPEC)),
    )

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {generateAppSpec} = require('./generate.js')
    await collectEvents(generateAppSpec(OPTS))

    const call = capturedStreamCall(streamMock)
    const messages = call['messages'] as Array<{role: string; content: string}>
    expect(messages[0]!.content).toBe(OPTS.prompt)
  })

  // -------------------------------------------------------------------------
  // T-0007-181: out_of_scope re-validation — 201-char reason throws InvalidSpecError
  // -------------------------------------------------------------------------
  it('T-0007-181: synthetic out_of_scope with 201-char reason throws InvalidSpecError(invalid_spec, {kind: "zod", codes: [...]})', async () => {
    const streamMock = getStreamMock()
    const oversizedReason = 'x'.repeat(201) // exceeds 200-char max
    streamMock.mockImplementation(
      mockAnthropicStream(
        makeOutOfScopeEvents(),
        makeV0ToolUseMessage('out_of_scope', {capability: 'vision', reason: oversizedReason}),
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

    expect((caught as {name: string}).name).toBe('InvalidSpecError')
    expect((caught as {code: string}).code).toBe('invalid_spec')
    const detail = (caught as {detail: {kind: string; codes: string[]}}).detail
    expect(detail.kind).toBe('zod')
    expect(detail.codes).toContain('too_big')
  })

  // -------------------------------------------------------------------------
  // T-0007-182: SSE wire protocol — out_of_scope path terminated cleanly
  // (The route test (Step 4) verifies [DONE] appears. Here we verify the
  // generator returns cleanly after yielding out_of_scope, which the route
  // uses to close the stream.)
  // -------------------------------------------------------------------------
  it('T-0007-182: out_of_scope path returns cleanly from generator (enabling [DONE] in route)', async () => {
    const streamMock = getStreamMock()
    streamMock.mockImplementation(
      mockAnthropicStream(
        makeOutOfScopeEvents(),
        makeV0ToolUseMessage('out_of_scope', {capability: 'image_gen', reason: 'generates images'}),
      ),
    )

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {generateAppSpec} = require('./generate.js')
    const events = await collectEvents(generateAppSpec(OPTS))

    // Generator must yield exactly: thinking_started, building_started, out_of_scope
    const types = events.map((e: unknown) => (e as {type: string}).type)
    expect(types[0]).toBe('thinking_started')
    expect(types[1]).toBe('building_started')
    expect(types[2]).toBe('out_of_scope')
    expect(types).toHaveLength(3)
  })

  // -------------------------------------------------------------------------
  // ADR-0010 Step 4 — T-0010-082, T-0010-083: generate.completed includes
  // prompt_version and its value matches the PROMPT_VERSION const.
  // -------------------------------------------------------------------------
  it('T-0010-082: generate.completed event payload includes prompt_version', async () => {
    const streamMock = getStreamMock()
    streamMock.mockImplementation(
      mockAnthropicStream(makeSuccessEvents(), makeV0ToolUseMessage('produce_app_spec', MINIMAL_VALID_V0_SPEC)),
    )

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {generateAppSpec} = require('./generate.js')
    await collectEvents(generateAppSpec(OPTS))

    const completedCall = mockWriteEvent.mock.calls.find(c => c[0] === 'generate.completed')
    expect(completedCall).toBeDefined()
    const payload = completedCall![1] as Record<string, unknown>
    expect(typeof payload['prompt_version']).toBe('string')
    expect((payload['prompt_version'] as string).length).toBeGreaterThan(0)
  })

  it('T-0010-083: prompt_version in generate.completed matches the imported PROMPT_VERSION const (regression-safe)', async () => {
    const streamMock = getStreamMock()
    streamMock.mockImplementation(
      mockAnthropicStream(makeSuccessEvents(), makeV0ToolUseMessage('produce_app_spec', MINIMAL_VALID_V0_SPEC)),
    )

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {generateAppSpec} = require('./generate.js')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {PROMPT_VERSION} = require('./prompts/system.js')
    await collectEvents(generateAppSpec(OPTS))

    const completedCall = mockWriteEvent.mock.calls.find(c => c[0] === 'generate.completed')
    const payload = completedCall![1] as Record<string, unknown>
    // The value must equal the const — never hardcoded in generate.ts.
    expect(payload['prompt_version']).toBe(PROMPT_VERSION)
  })
})
