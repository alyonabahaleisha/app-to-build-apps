/**
 * Anthropic mock helpers for unit tests.
 *
 * Usage:
 *   jest.mock('@anthropic-ai/sdk')
 *   jest.mock('./anthropic.js', () => ({
 *     anthropic: {
 *       messages: {
 *         stream: jest.fn(),
 *       },
 *     },
 *   }))
 */

import type {Message, RawContentBlockStartEvent} from '@anthropic-ai/sdk/resources/messages'

// Re-export the stream event union narrowed to what our tests need.
export type MockStreamEvent =
  | {type: 'message_start'; message: Partial<Message>}
  | RawContentBlockStartEvent
  | {type: 'content_block_stop'; index: number}
  | {
      type: 'message_delta'
      delta: {stop_reason: string; stop_sequence: null}
      usage: {output_tokens: number}
    }
  | {type: 'message_stop'}

/**
 * Build a mock stream object compatible with PromptCachingBetaMessageStream.
 *
 * The stream is AsyncIterable<MockStreamEvent>; finalMessage() resolves
 * with the provided message after the iteration completes.
 */
export function mockAnthropicStream(events: MockStreamEvent[], final: Partial<Message>): jest.Mock {
  return jest.fn().mockReturnValue({
    [Symbol.asyncIterator]: async function* () {
      for (const event of events) {
        yield event
      }
    },
    finalMessage: jest.fn().mockResolvedValue(final),
  })
}

/**
 * Build a mock stream that throws an error with the given HTTP status.
 * Use to simulate 429 / 500 responses from Anthropic.
 */
export function mockAnthropicError(status: number, message = 'Anthropic API error'): jest.Mock {
  const err = Object.assign(new Error(message), {status})
  return jest.fn().mockReturnValue({
    [Symbol.asyncIterator]: async function* () {
      throw err
    },
    finalMessage: jest.fn().mockRejectedValue(err),
  })
}

/**
 * Minimal valid A2UI spec for use in happy-path tests.
 */
export const MINIMAL_VALID_SPEC = {
  version: 1 as const,
  views: [
    {
      id: 'main',
      root: {type: 'Heading' as const, text: 'Hello'},
    },
  ],
  initialViewId: 'main',
}

/**
 * A minimal valid finalMessage payload wrapping the given input as a tool_use block.
 *
 * Uses `as Partial<Message>` because newer SDK versions add additional required
 * fields (caller, cache_*, inference_geo) that aren't relevant to our tests; the
 * generator only reads `content[].type`, `id`, `name`, `input`.
 */
export function makeToolUseMessage(input: unknown): Partial<Message> {
  return {
    id: 'msg_test',
    role: 'assistant',
    stop_reason: 'tool_use',
    stop_sequence: null,
    type: 'message',
    model: 'claude-sonnet-4-6',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content: [{type: 'tool_use', id: 'tu_test', name: 'produce_app_spec', input}] as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    usage: {input_tokens: 100, output_tokens: 200} as any,
  }
}

/**
 * A tool_use content_block_start event (triggers building_started).
 */
export function makeToolUseStartEvent(index = 1): MockStreamEvent {
  return {
    type: 'content_block_start',
    index,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content_block: {type: 'tool_use', id: 'tu_test', name: 'produce_app_spec', input: {}} as any,
  }
}

/**
 * A minimal stream sequence for a successful generation:
 *   message_start → tool_use block start → message_stop
 */
export function makeSuccessEvents(): MockStreamEvent[] {
  return [
    {type: 'message_start', message: {id: 'msg_test', role: 'assistant'}},
    makeToolUseStartEvent(),
    {type: 'message_stop'},
  ]
}

// ---------------------------------------------------------------------------
// Planner mock helpers
// ---------------------------------------------------------------------------

import type {Plan} from '@app-creator/a2ui-schema'

/**
 * Build a mock messages.create() return value wrapping a Plan as a tool_use block.
 * Use as: jest.fn().mockResolvedValue(mockPlannerResponse(plan))
 */
export function mockPlannerResponse(plan: Plan): Partial<Message> {
  return {
    id: 'msg_planner_test',
    role: 'assistant',
    stop_reason: 'tool_use',
    stop_sequence: null,
    type: 'message',
    model: 'claude-haiku-4-5-20251001',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content: [{type: 'tool_use', id: 'tu_plan_test', name: 'produce_plan', input: plan}] as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    usage: {input_tokens: 50, output_tokens: 100} as any,
  }
}

/**
 * Build a mock messages.create() that rejects with an HTTP error.
 * Use as: jest.fn().mockRejectedValue(makePlannerError(429))
 */
export function makePlannerError(status: number, message = 'Anthropic API error'): Error {
  return Object.assign(new Error(message), {status})
}

/**
 * Build a mock messages.create() return value with a tool_use block containing
 * invalid plan data (will fail PlanSchema.parse).
 */
export function mockPlannerZodInvalid(): Partial<Message> {
  return {
    id: 'msg_planner_invalid',
    role: 'assistant',
    stop_reason: 'tool_use',
    stop_sequence: null,
    type: 'message',
    model: 'claude-haiku-4-5-20251001',
    content: [
      {
        type: 'tool_use',
        id: 'tu_plan_invalid',
        name: 'produce_plan',
        // Missing required fields: archetype enum is wrong, no screens
        input: {version: 1, archetype: 'NotAnArchetype', screens: [], navigation: 'none'},
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    ],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    usage: {input_tokens: 50, output_tokens: 80} as any,
  }
}

/** Minimal valid plan for use in planner tests. */
export const MINIMAL_VALID_PLAN: Plan = {
  version: 1,
  archetype: 'Calculator',
  screens: [
    {
      id: 'main',
      role: 'home',
      purpose: 'enter inputs and see result',
      key_components: ['Form', 'Button', 'Text'],
    },
  ],
  navigation: 'none',
}

// ---------------------------------------------------------------------------
// Builder conformance mock helpers (Step 3 / T-0004-039 through T-0004-053)
// ---------------------------------------------------------------------------

/**
 * A spec that does NOT conform to MINIMAL_VALID_PLAN — view id is 'wrong_id'
 * instead of 'main', which triggers view_id_mismatch.
 */
export const NON_CONFORMING_SPEC = {
  version: 1 as const,
  views: [
    {
      id: 'wrong_id',
      root: {type: 'Heading' as const, text: 'Wrong'},
    },
  ],
  initialViewId: 'wrong_id',
}

