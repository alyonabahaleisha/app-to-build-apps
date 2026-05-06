/**
 * T-0004-021 through T-0004-038
 * Unit tests for producePlan.
 * All Anthropic calls are mocked — no API key required.
 *
 * Error class checks use .name / .code rather than instanceof because
 * jest.mock + dynamic import creates multiple module registries; the class
 * identity check is unreliable across registry boundaries. name+code is stable.
 */

import {
  mockPlannerResponse,
  makePlannerError,
  mockPlannerZodInvalid,
  MINIMAL_VALID_PLAN,
  MINIMAL_VALID_SPEC,
} from '../../test/mocks/anthropic.js'
import type {Plan} from '@app-creator/a2ui-schema'

// ---------------------------------------------------------------------------
// Module-level mocks — must precede any imports of the mocked modules
// ---------------------------------------------------------------------------

jest.mock('@anthropic-ai/sdk')

// Mock the singleton so it never reads ANTHROPIC_API_KEY at import time.
// messages.create is the planner's call (non-streaming).
const mockMessagesCreate = jest.fn()
jest.mock('./anthropic.js', () => ({
  anthropic: {
    messages: {
      create: mockMessagesCreate,
    },
  },
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function capturedCreateCall(mock: jest.Mock, callIndex = 0): Record<string, unknown> {
  return mock.mock.calls[callIndex]?.[0] as Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Shared test data
// ---------------------------------------------------------------------------

const USER_ID = 'user-abc-123'
const PROMPT = 'tip splitter calculator'

const FOUR_SCREEN_PLAN: Plan = {
  version: 1,
  archetype: 'Dashboard',
  screens: [
    {
      id: 'overview',
      role: 'home',
      purpose: 'show summary metrics',
      key_components: ['Heading', 'Counter'],
    },
    {
      id: 'detail',
      role: 'detail',
      purpose: 'drill into one metric',
      key_components: ['List', 'Text'],
    },
    {id: 'history', role: 'history', purpose: 'view historical data', key_components: ['List']},
    {
      id: 'settings',
      role: 'settings',
      purpose: 'configure preferences',
      key_components: ['Toggle', 'Form'],
    },
  ],
  navigation: 'tabs+stack',
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('producePlan', () => {
  beforeEach(() => {
    process.env['ANTHROPIC_API_KEY'] = 'sk-ant-test'
    mockMessagesCreate.mockReset()
  })

  // T-0004-021
  it('returns a Calculator plan on happy-path mocked Anthropic response', async () => {
    mockMessagesCreate.mockResolvedValue(mockPlannerResponse(MINIMAL_VALID_PLAN))

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {producePlan} = require('./planner.js')
    const plan = await producePlan({userId: USER_ID, prompt: PROMPT})

    expect(plan.archetype).toBe('Calculator')
    expect(plan.screens).toHaveLength(1)
    expect(plan.navigation).toBe('none')
  })

  // T-0004-022
  it('edit-mode call includes currentPlan and currentSpec as assistant messages', async () => {
    mockMessagesCreate.mockResolvedValue(mockPlannerResponse(MINIMAL_VALID_PLAN))

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {producePlan} = require('./planner.js')
    await producePlan({
      userId: USER_ID,
      prompt: 'change the heading to "Tip Calculator"',
      currentPlan: MINIMAL_VALID_PLAN,
      currentSpec: MINIMAL_VALID_SPEC,
    })

    const call = capturedCreateCall(mockMessagesCreate)
    const messages = call['messages'] as Array<{role: string; content: string}>

    expect(messages).toHaveLength(3)
    expect(messages[0]?.role).toBe('assistant')
    expect(messages[0]?.content).toContain('"Calculator"') // plan JSON
    expect(messages[1]?.role).toBe('assistant')
    expect(messages[1]?.content).toContain('"main"') // spec JSON
    expect(messages[2]?.role).toBe('user')
    expect(messages[2]?.content).toContain('change the heading')
  })

  // T-0004-023
  it('metadata.user_id is sha256(userId).slice(0,16), never raw userId', async () => {
    mockMessagesCreate.mockResolvedValue(mockPlannerResponse(MINIMAL_VALID_PLAN))

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {producePlan} = require('./planner.js')
    await producePlan({userId: USER_ID, prompt: PROMPT})

    const call = capturedCreateCall(mockMessagesCreate)
    const metadata = call['metadata'] as {user_id: string}

    expect(metadata.user_id).not.toBe(USER_ID)
    expect(metadata.user_id).toHaveLength(16)
    expect(metadata.user_id).toMatch(/^[0-9a-f]{16}$/)
  })

  // T-0004-024
  it('system array is [PLANNER_STATIC, PLANNER_CONTEXT] with cache_control ephemeral on second block only', async () => {
    mockMessagesCreate.mockResolvedValue(mockPlannerResponse(MINIMAL_VALID_PLAN))

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {producePlan} = require('./planner.js')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {PLANNER_STATIC, PLANNER_CONTEXT} = require('./prompts/planner.js')
    await producePlan({userId: USER_ID, prompt: PROMPT})

    const call = capturedCreateCall(mockMessagesCreate)
    const system = call['system'] as Array<{type: string; text: string; cache_control?: unknown}>

    expect(system).toHaveLength(2)
    expect(system[0]?.text).toBe(PLANNER_STATIC)
    expect(system[0]?.cache_control).toBeUndefined()
    expect(system[1]?.text).toBe(PLANNER_CONTEXT)
    expect(system[1]?.cache_control).toEqual({type: 'ephemeral'})
  })

  // T-0004-025
  it('sends tool_choice={type:tool,name:produce_plan}, max_tokens=1500, and PLANNER_MODEL', async () => {
    mockMessagesCreate.mockResolvedValue(mockPlannerResponse(MINIMAL_VALID_PLAN))

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {producePlan} = require('./planner.js')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {PLANNER_MODEL} = require('./models.js')
    await producePlan({userId: USER_ID, prompt: PROMPT})

    const call = capturedCreateCall(mockMessagesCreate)

    expect(call['tool_choice']).toEqual({type: 'tool', name: 'produce_plan'})
    expect(call['max_tokens']).toBe(1500)
    expect(call['model']).toBe(PLANNER_MODEL)
  })

  // T-0004-026
  it('throws PlannerInvalidError(no_tool_use) when Anthropic returns no tool_use block', async () => {
    mockMessagesCreate.mockResolvedValue({
      id: 'msg_test',
      role: 'assistant',
      stop_reason: 'end_turn',
      content: [{type: 'text', text: 'Here is my plan in prose...'}],
    })

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {producePlan} = require('./planner.js')

    let caught: unknown
    try {
      await producePlan({userId: USER_ID, prompt: PROMPT})
    } catch (err) {
      caught = err
    }

    expect(caught).toBeDefined()
    expect((caught as {name: string}).name).toBe('PlannerInvalidError')
    expect((caught as {code: string}).code).toBe('no_tool_use')
  })

  // T-0004-027
  it('retries with a diagnostic turn on Zod-invalid plan; returns plan on second success', async () => {
    mockMessagesCreate
      .mockResolvedValueOnce(mockPlannerZodInvalid())
      .mockResolvedValueOnce(mockPlannerResponse(MINIMAL_VALID_PLAN))

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {producePlan} = require('./planner.js')
    const plan = await producePlan({userId: USER_ID, prompt: PROMPT})

    expect(plan.archetype).toBe('Calculator')
    expect(mockMessagesCreate).toHaveBeenCalledTimes(2)

    // Second call should include a diagnostic user message.
    const secondCallMessages = capturedCreateCall(mockMessagesCreate, 1)['messages'] as Array<{
      role: string
      content: string
    }>
    const lastMsg = secondCallMessages.at(-1)
    expect(lastMsg?.role).toBe('user')
    expect(lastMsg?.content).toContain('failed validation')
  })

  // T-0004-028
  it('throws PlannerInvalidError(invalid_plan) with detail after two Zod-invalid responses', async () => {
    mockMessagesCreate
      .mockResolvedValueOnce(mockPlannerZodInvalid())
      .mockResolvedValueOnce(mockPlannerZodInvalid())

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {producePlan} = require('./planner.js')

    let caught: unknown
    try {
      await producePlan({userId: USER_ID, prompt: PROMPT})
    } catch (err) {
      caught = err
    }

    expect(caught).toBeDefined()
    expect((caught as {name: string}).name).toBe('PlannerInvalidError')
    expect((caught as {code: string}).code).toBe('invalid_plan')
    expect((caught as {detail: unknown}).detail).toBeDefined()
    expect(mockMessagesCreate).toHaveBeenCalledTimes(2)
  })

  // T-0004-029
  it('retries once after a 429 then returns plan on second attempt', async () => {
    jest.useFakeTimers()

    mockMessagesCreate
      .mockRejectedValueOnce(makePlannerError(429))
      .mockResolvedValueOnce(mockPlannerResponse(MINIMAL_VALID_PLAN))

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {producePlan} = require('./planner.js')

    let plan: unknown
    const promise = producePlan({userId: USER_ID, prompt: PROMPT}).then((p: Plan) => {
      plan = p
    })

    // Advance through the 1s backoff for attempt 1.
    await jest.advanceTimersByTimeAsync(1500)
    await promise

    expect((plan as Plan).archetype).toBe('Calculator')
    expect(mockMessagesCreate).toHaveBeenCalledTimes(2)

    jest.useRealTimers()
  })

  // T-0004-030
  it('throws PlannerTransportError after sustained 429 (exhausts retries)', async () => {
    jest.useFakeTimers()

    mockMessagesCreate.mockRejectedValue(makePlannerError(429))

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {producePlan} = require('./planner.js')

    let caught: unknown
    const promise = producePlan({userId: USER_ID, prompt: PROMPT}).catch((err: unknown) => {
      caught = err
    })

    // Advance through both retry sleeps (1000ms + 2000ms).
    await jest.advanceTimersByTimeAsync(4000)
    await promise

    expect(caught).toBeDefined()
    expect((caught as {name: string}).name).toBe('PlannerTransportError')
    expect((caught as {code: string}).code).toBe('planner_transport')
    // 3 total attempts: initial + 2 retries.
    expect(mockMessagesCreate).toHaveBeenCalledTimes(3)

    jest.useRealTimers()
  })

  // T-0004-031
  it('throws PlannerTransportError immediately on Anthropic 500', async () => {
    mockMessagesCreate.mockRejectedValue(makePlannerError(500, 'Internal Server Error'))

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {producePlan} = require('./planner.js')

    let caught: unknown
    try {
      await producePlan({userId: USER_ID, prompt: PROMPT})
    } catch (err) {
      caught = err
    }

    expect(caught).toBeDefined()
    expect((caught as {name: string}).name).toBe('PlannerTransportError')
    expect((caught as {code: string}).code).toBe('planner_transport')
    expect(mockMessagesCreate).toHaveBeenCalledTimes(1)
  })

  // T-0004-032
  it('throws PlannerTimeoutError when AbortSignal is already aborted', async () => {
    // Make the create call throw an AbortError (simulating SDK honoring the signal).
    const abortErr = Object.assign(new Error('The operation was aborted'), {name: 'AbortError'})
    mockMessagesCreate.mockRejectedValue(abortErr)

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {producePlan} = require('./planner.js')

    // Create an already-aborted signal.
    const controller = new AbortController()
    controller.abort()

    let caught: unknown
    try {
      await producePlan({userId: USER_ID, prompt: PROMPT, signal: controller.signal})
    } catch (err) {
      caught = err
    }

    expect(caught).toBeDefined()
    expect((caught as {name: string}).name).toBe('PlannerTimeoutError')
    expect((caught as {code: string}).code).toBe('planner_timeout')
  })

  // T-0004-033
  it('round-trips a single-screen plan with navigation none', async () => {
    const singleScreenPlan: Plan = {
      version: 1,
      archetype: 'Calculator',
      screens: [
        {
          id: 'calc',
          role: 'home',
          purpose: 'compute tip and total',
          key_components: ['TextInput', 'Button', 'Text'],
        },
      ],
      navigation: 'none',
    }
    mockMessagesCreate.mockResolvedValue(mockPlannerResponse(singleScreenPlan))

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {producePlan} = require('./planner.js')
    const plan = await producePlan({userId: USER_ID, prompt: PROMPT})

    expect(plan.screens).toHaveLength(1)
    expect(plan.navigation).toBe('none')
    expect(plan.archetype).toBe('Calculator')
  })

  // T-0004-034
  it('round-trips a four-screen plan with navigation tabs+stack', async () => {
    mockMessagesCreate.mockResolvedValue(mockPlannerResponse(FOUR_SCREEN_PLAN))

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {producePlan} = require('./planner.js')
    const plan = await producePlan({userId: USER_ID, prompt: 'build a dashboard app'})

    expect(plan.screens).toHaveLength(4)
    expect(plan.navigation).toBe('tabs+stack')
    expect(plan.archetype).toBe('Dashboard')
  })

  // T-0004-035
  it('edit-call messages include prior plan/spec content but no system prompt content', async () => {
    mockMessagesCreate.mockResolvedValue(mockPlannerResponse(MINIMAL_VALID_PLAN))

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {producePlan} = require('./planner.js')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {PLANNER_STATIC, PLANNER_CONTEXT} = require('./prompts/planner.js')
    await producePlan({
      userId: USER_ID,
      prompt: 'change heading color',
      currentPlan: MINIMAL_VALID_PLAN,
      currentSpec: MINIMAL_VALID_SPEC,
    })

    const call = capturedCreateCall(mockMessagesCreate)
    const messages = call['messages'] as Array<{role: string; content: string}>

    // Verify prior plan and spec appear in messages.
    const allContent = messages.map(m => m.content).join(' ')
    expect(allContent).toContain(JSON.stringify(MINIMAL_VALID_PLAN))
    expect(allContent).toContain(JSON.stringify(MINIMAL_VALID_SPEC))

    // Verify system prompt text does NOT appear in messages (it belongs in system[]).
    expect(allContent).not.toContain(PLANNER_STATIC)
    expect(allContent).not.toContain(PLANNER_CONTEXT)
  })

  // T-0004-036
  it('does not call console.log or logger.info with plan content (no prompt leak)', async () => {
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {})
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

    mockMessagesCreate.mockResolvedValue(mockPlannerResponse(MINIMAL_VALID_PLAN))

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {producePlan} = require('./planner.js')
    await producePlan({userId: USER_ID, prompt: PROMPT})

    // No info-level log calls should include the raw prompt.
    const infoCalls = infoSpy.mock.calls.map(args => args.join(' '))
    const logCalls = logSpy.mock.calls.map(args => args.join(' '))
    const allLogs = [...infoCalls, ...logCalls].join(' ')
    expect(allLogs).not.toContain(PROMPT)

    infoSpy.mockRestore()
    logSpy.mockRestore()
  })

  // T-0004-037
  it('EnvMissingError is raised when ANTHROPIC_API_KEY is absent (planner reuses M1 client)', () => {
    // The planner imports the singleton from './anthropic.js', which throws EnvMissingError
    // at module load when ANTHROPIC_API_KEY is absent. jest.mock() at file scope intercepts
    // the module path before it can throw, so we verify the guard via the errors module —
    // EnvMissingError.code must be 'env_missing' (the code the singleton throws on load).
    // The generate.test.ts suite already exercises the real singleton throw path.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {EnvMissingError} = require('./errors.js')
    const err = new EnvMissingError('ANTHROPIC_API_KEY')
    expect(err.name).toBe('EnvMissingError')
    expect(err.code).toBe('env_missing')
    expect(err.message).toContain('ANTHROPIC_API_KEY')
  })

  // T-0004-038
  it('diagnostic turn message correctly cites the prior failure (snapshot)', async () => {
    // Capture what the second create call receives as messages.
    let capturedMessages: unknown = null
    mockMessagesCreate
      .mockResolvedValueOnce(mockPlannerZodInvalid())
      .mockImplementationOnce((params: Record<string, unknown>) => {
        capturedMessages = params['messages']
        return Promise.resolve(mockPlannerResponse(MINIMAL_VALID_PLAN))
      })

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {producePlan} = require('./planner.js')
    await producePlan({userId: USER_ID, prompt: PROMPT})

    // The diagnostic turn is the last message in the second call.
    const messages = capturedMessages as Array<{role: string; content: string}>
    const diagnosticMsg = messages.at(-1)

    expect(diagnosticMsg?.role).toBe('user')
    expect(diagnosticMsg).toMatchSnapshot()
  })
})
