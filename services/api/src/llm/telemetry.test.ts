/**
 * T-0007-140..142, T-0007-145 — telemetry.ts unit tests post Step 6 deletion sweep.
 *
 * M1 plan.X/build.X/edit.X event types are removed. Only V0 event types remain.
 * Tests verify:
 *   T-0007-140 — whitelist does NOT contain M1 event type keys
 *   T-0007-141 — whitelist DOES contain all 4 V0 event types
 *   T-0007-142 — each V0 event type's whitelist rejects unknown keys
 *   T-0007-145 — EVAL_MODE='true' triggers telemetry short-circuit
 *
 * DB-dependent tests use mocked DB (no Docker required).
 */

// ---------------------------------------------------------------------------
// Module-level mocks — must precede any imports of the mocked modules
// ---------------------------------------------------------------------------

const mockInsertValues = jest.fn().mockResolvedValue(undefined)
const mockDbInsert = jest.fn().mockReturnValue({values: mockInsertValues})

jest.mock('../db/index.js', () => ({
  db: {
    insert: mockDbInsert,
  },
  schema: {
    events: 'events_table',
  },
  createDb: jest.fn(),
  createPool: jest.fn(),
}))

const mockLogError = jest.fn()
jest.mock('pino', () =>
  jest.fn(() => ({
    error: mockLogError,
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
  })),
)

// ---------------------------------------------------------------------------
// Environment mock — default to EVAL_MODE OFF.
// ---------------------------------------------------------------------------
const mockEnvValues: {LOG_LEVEL: string; EVAL_MODE: 'true' | 'false'} = {
  LOG_LEVEL: 'info',
  EVAL_MODE: 'false',
}

jest.mock('../lib/env.js', () => ({
  get env() {
    return mockEnvValues
  },
  loadEnv: jest.fn(),
}))

// ---------------------------------------------------------------------------
// Imports — after mocks
// ---------------------------------------------------------------------------
import {
  writeEvent,
  EventPayloadValidationError,
  EVENT_PAYLOAD_WHITELIST,
  type EventType,
} from './telemetry.js'

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks()
  mockEnvValues.EVAL_MODE = 'false'
  mockInsertValues.mockResolvedValue(undefined)
  mockDbInsert.mockReturnValue({values: mockInsertValues})
})

// ---------------------------------------------------------------------------
// T-0007-140: EVENT_PAYLOAD_WHITELIST does NOT contain M1 event type keys
// ---------------------------------------------------------------------------

describe('T-0007-140: whitelist does NOT contain M1 plan.*/build.*/edit.* keys', () => {
  const M1_EVENT_TYPES = [
    'plan.completed',
    'plan.timeout_fallback',
    'plan.invalid_fallback',
    'plan.unknown_fallback',
    'plan.transport_fallback',
    'build.completed',
    'build.conformance_fallback',
    'edit.completed',
    'edit.patch_out_of_scope_fallback',
  ]

  for (const eventType of M1_EVENT_TYPES) {
    it(`${eventType} is not a key in EVENT_PAYLOAD_WHITELIST`, () => {
      expect(Object.keys(EVENT_PAYLOAD_WHITELIST)).not.toContain(eventType)
    })
  }
})

// ---------------------------------------------------------------------------
// T-0007-141: EVENT_PAYLOAD_WHITELIST contains all 4 V0 event types
// ---------------------------------------------------------------------------

describe('T-0007-141: whitelist contains all 4 V0 event types', () => {
  const V0_EVENT_TYPES: EventType[] = [
    'generate.completed',
    'generate.invalid_spec',
    'generate.out_of_scope',
    'out_of_scope_intent_captured',
  ]

  it('EVENT_PAYLOAD_WHITELIST has exactly the 4 V0 event types', () => {
    const keys = Object.keys(EVENT_PAYLOAD_WHITELIST)
    for (const eventType of V0_EVENT_TYPES) {
      expect(keys).toContain(eventType)
    }
    // No extra keys
    expect(keys).toHaveLength(V0_EVENT_TYPES.length)
  })

  for (const eventType of V0_EVENT_TYPES) {
    it(`${eventType} whitelist is a non-empty array`, () => {
      expect(Array.isArray(EVENT_PAYLOAD_WHITELIST[eventType])).toBe(true)
      expect((EVENT_PAYLOAD_WHITELIST[eventType] as ReadonlyArray<string>).length).toBeGreaterThan(0)
    })
  }
})

// ---------------------------------------------------------------------------
// T-0007-142: each V0 event type rejects unknown keys (whitelist enforcement)
// ---------------------------------------------------------------------------

describe('T-0007-142: per-V0-event-type whitelist rejects unknown keys', () => {
  const BAD_KEY = '__not_allowed_key__'

  const V0_EVENT_TYPES: EventType[] = [
    'generate.completed',
    'generate.invalid_spec',
    'generate.out_of_scope',
    'out_of_scope_intent_captured',
  ]

  for (const eventType of V0_EVENT_TYPES) {
    it(`${eventType}: passing '${BAD_KEY}' throws EventPayloadValidationError before DB call`, async () => {
      await expect(
        writeEvent(eventType, {[BAD_KEY]: 'x'}),
      ).rejects.toThrow(EventPayloadValidationError)
      expect(mockDbInsert).not.toHaveBeenCalled()
    })
  }

  it('generate.completed: passing allowed keys succeeds', async () => {
    await writeEvent('generate.completed', {
      generationId: 'gen-uuid',
      archetype: 'Calculator',
      screens_count: 1,
      navigation: 'none',
      generation_duration_ms: 500,
    })
    expect(mockDbInsert).toHaveBeenCalled()
  })

  it('out_of_scope_intent_captured: passing prompt key throws EventPayloadValidationError', async () => {
    await expect(
      writeEvent('out_of_scope_intent_captured', {prompt: 'this should not be here'}),
    ).rejects.toThrow(EventPayloadValidationError)
    expect(mockDbInsert).not.toHaveBeenCalled()
  })

  it('each V0 event type whitelist is independent — a key in generate.completed is not auto-allowed in generate.invalid_spec', () => {
    const completedKeys = EVENT_PAYLOAD_WHITELIST['generate.completed'] as ReadonlyArray<string>
    const invalidSpecKeys = EVENT_PAYLOAD_WHITELIST['generate.invalid_spec'] as ReadonlyArray<string>
    expect(completedKeys).toContain('archetype')
    expect(invalidSpecKeys).not.toContain('archetype')
  })
})

// ---------------------------------------------------------------------------
// T-0007-145: EVAL_MODE='true' → DB insert skipped; whitelist still runs
// ---------------------------------------------------------------------------

describe('T-0007-145: EVAL_MODE=true triggers telemetry short-circuit', () => {
  beforeEach(() => {
    mockEnvValues.EVAL_MODE = 'true'
  })

  it('returns without inserting when EVAL_MODE is true', async () => {
    await writeEvent('generate.completed', {
      generationId: 'eval-gen-id',
      archetype: 'Calculator',
      screens_count: 1,
      navigation: 'none',
      generation_duration_ms: 50,
    })

    expect(mockDbInsert).not.toHaveBeenCalled()
  })

  it('still throws EventPayloadValidationError on whitelist violation even in eval mode', async () => {
    await expect(
      writeEvent('generate.completed', {prompt: 'should still be blocked in eval mode'}),
    ).rejects.toThrow(EventPayloadValidationError)

    expect(mockDbInsert).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Regression: DB errors are swallowed (generation never blocks on telemetry)
// ---------------------------------------------------------------------------

describe('Regression: DB insert throws → logged ERROR, not re-thrown', () => {
  it('swallows DB error and logs it via pino logger', async () => {
    const dbError = new Error('DB connection refused')
    mockDbInsert.mockReturnValue({
      values: jest.fn().mockRejectedValue(dbError),
    })

    await expect(
      writeEvent('generate.completed', {
        generationId: 'db-down-gen',
        archetype: 'Calculator',
        screens_count: 1,
        navigation: 'none',
        generation_duration_ms: 99,
      }),
    ).resolves.toBeUndefined()

    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({eventType: 'generate.completed'}),
      expect.stringContaining('writeEvent failed'),
    )
  })
})
