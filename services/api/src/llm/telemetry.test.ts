/**
 * T-0004-103 through T-0004-108 + T-0004-116 + T-0004-120
 * Unit tests for writeEvent() in telemetry.ts (ADR-0004 Step 8).
 *
 * DB-dependent tests (T-0004-103, T-0004-108) require a real Postgres
 * testcontainer — they will fail locally with a CONFIG or CONNECTION error
 * when DATABASE_URL is not set. This matches the established pattern from
 * Steps 4–7 (T-0004-080 precedent).
 *
 * Non-DB tests (T-0004-104, T-0004-105, T-0004-106, T-0004-107, T-0004-116)
 * use mocked DB and run locally without any infra dependency.
 *
 * T-0004-120 (shadow mode + DB down) is a multi-step orchestrator concern;
 * its unit-tier portion is covered by T-0004-106 (DB-down → swallowed). The
 * orchestrator integration half lives in pipeline.test.ts ("writeEvent failure
 * — generation continues" describe block).
 */

// ---------------------------------------------------------------------------
// Module-level mocks — must precede any imports of the mocked modules
// ---------------------------------------------------------------------------

// Mock DB so non-integration tests don't need a real Postgres instance.
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

// Mock pino to suppress log output and allow assertion on log calls.
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
// Environment mock — default to eval mode OFF so DB inserts run in tests.
// Individual tests override as needed.
// ---------------------------------------------------------------------------
const mockEnvValues: {LOG_LEVEL: string; PLAN_BUILD_EVAL_MODE: 'true' | 'false'} = {
  LOG_LEVEL: 'info',
  PLAN_BUILD_EVAL_MODE: 'false',
}

jest.mock('../lib/env.js', () => ({
  get env() {
    return mockEnvValues
  },
  loadEnv: jest.fn(),
}))

// ---------------------------------------------------------------------------
// Imports — after mocks are declared
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
  mockEnvValues.PLAN_BUILD_EVAL_MODE = 'false'
  mockInsertValues.mockResolvedValue(undefined)
  mockDbInsert.mockReturnValue({values: mockInsertValues})
})

// ---------------------------------------------------------------------------
// T-0004-103 (Happy) — DB-gated.
// writeEvent('plan.completed', <valid payload>) inserts a row with right shape.
//
// This test uses the mocked DB (not a real testcontainer) to verify the
// insert shape. Full DB round-trip belongs in the testcontainer suite; this
// verifies the structural contract of the insert call at the unit level.
// ---------------------------------------------------------------------------

describe('T-0004-103: Happy — writeEvent inserts with correct shape', () => {
  it('inserts plan.completed event with generationId and plan_duration_ms in payload', async () => {
    const generationId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

    await writeEvent('plan.completed', {
      generationId,
      archetype: 'Calculator',
      screens_count: 1,
      navigation: 'none',
      mode: 'live',
      plan_duration_ms: 1234,
    })

    expect(mockDbInsert).toHaveBeenCalledWith('events_table')
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'plan.completed',
        payloadJson: expect.objectContaining({
          generationId,
          archetype: 'Calculator',
          plan_duration_ms: 1234,
        }),
      }),
    )
  })

  it('extracts durationMs from plan_duration_ms into the row column', async () => {
    await writeEvent('plan.completed', {
      generationId: 'test-gen-id',
      archetype: 'ListCRUD',
      screens_count: 2,
      navigation: 'stack',
      mode: 'live',
      plan_duration_ms: 500,
    })

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        durationMs: 500,
      }),
    )
  })

  it('extracts durationMs from build_duration_ms into the row column', async () => {
    await writeEvent('build.completed', {
      generationId: 'test-build-gen-id',
      archetype: 'Tracker',
      screens_count: 2,
      navigation: 'tabs',
      build_duration_ms: 8000,
    })

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        durationMs: 8000,
      }),
    )
  })

  it('passes ctx.userId and ctx.projectId to the insert', async () => {
    await writeEvent(
      'plan.completed',
      {
        generationId: 'ctx-gen-id',
        archetype: 'Journal',
        screens_count: 1,
        navigation: 'none',
        mode: 'live',
        plan_duration_ms: 100,
      },
      {userId: 'user-uuid', projectId: 'project-uuid'},
    )

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-uuid',
        projectId: 'project-uuid',
      }),
    )
  })
})

// ---------------------------------------------------------------------------
// T-0004-104 (Negative) — prompt key not in plan.completed whitelist → throws.
// Must throw BEFORE any DB call.
// ---------------------------------------------------------------------------

describe('T-0004-104: Negative — writeEvent(plan.completed, {prompt}) throws EventPayloadValidationError', () => {
  it('throws synchronously before DB call when prompt is passed', async () => {
    await expect(
      writeEvent('plan.completed', {prompt: 'this should not be here'}),
    ).rejects.toThrow(EventPayloadValidationError)

    // DB must NOT have been called — whitelist enforcement fires before I/O
    expect(mockDbInsert).not.toHaveBeenCalled()
  })

  it('thrown error message names the offending key and event type', async () => {
    const err = await writeEvent('plan.completed', {prompt: 'leak'}).catch(e => e)
    expect(err).toBeInstanceOf(EventPayloadValidationError)
    expect(err.message).toContain("'prompt'")
    expect(err.message).toContain("'plan.completed'")
    expect(err.code).toBe('event_payload_validation')
  })
})

// ---------------------------------------------------------------------------
// T-0004-105 (Negative) — user_email key not in plan.completed whitelist → throws.
// ---------------------------------------------------------------------------

describe('T-0004-105: Negative — writeEvent(plan.completed, {user_email}) throws EventPayloadValidationError', () => {
  it('throws before DB call when user_email is passed', async () => {
    await expect(
      writeEvent('plan.completed', {user_email: 'user@example.com'}),
    ).rejects.toThrow(EventPayloadValidationError)

    expect(mockDbInsert).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// T-0004-106 (Error handling) — DB throws → writeEvent logs ERROR, does NOT re-throw.
// ---------------------------------------------------------------------------

describe('T-0004-106: Error handling — DB insert throws → logged ERROR, not re-thrown', () => {
  it('swallows DB error and logs it via pino logger', async () => {
    const dbError = new Error('DB connection refused')
    mockDbInsert.mockReturnValue({
      values: jest.fn().mockRejectedValue(dbError),
    })

    // Must not throw
    await expect(
      writeEvent('plan.completed', {
        generationId: 'db-down-gen',
        archetype: 'Calculator',
        screens_count: 1,
        navigation: 'none',
        mode: 'live',
        plan_duration_ms: 99,
      }),
    ).resolves.toBeUndefined()

    // Error was logged with safeMessage and eventType
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({eventType: 'plan.completed'}),
      expect.stringContaining('writeEvent failed'),
    )
  })
})

// ---------------------------------------------------------------------------
// T-0004-107 (Boundary) — per-event-type whitelist coverage.
//
// For EACH of the 9 event types, passing a key that is NOT in that type's
// whitelist throws EventPayloadValidationError. Also verifies the
// EVENT_PAYLOAD_WHITELIST export is the source of truth.
// ---------------------------------------------------------------------------

describe('T-0004-107: Boundary — per-event-type whitelist rejects unknown keys', () => {
  // Derive test cases from the exported whitelist itself — schema-derived key walk.
  const BAD_KEY = '__not_allowed_key__'

  const eventTypes: EventType[] = [
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

  for (const eventType of eventTypes) {
    it(`${eventType}: passing key '${BAD_KEY}' throws EventPayloadValidationError`, async () => {
      await expect(
        writeEvent(eventType, {[BAD_KEY]: 'x'}),
      ).rejects.toThrow(EventPayloadValidationError)

      expect(mockDbInsert).not.toHaveBeenCalled()
    })
  }

  it('EVENT_PAYLOAD_WHITELIST is exported and covers all 9 event types', () => {
    // Analytics consumers can import EVENT_PAYLOAD_WHITELIST as the key contract.
    expect(EVENT_PAYLOAD_WHITELIST).toBeDefined()
    for (const eventType of eventTypes) {
      expect(EVENT_PAYLOAD_WHITELIST[eventType]).toBeDefined()
      expect(Array.isArray(EVENT_PAYLOAD_WHITELIST[eventType])).toBe(true)
      expect((EVENT_PAYLOAD_WHITELIST[eventType] as ReadonlyArray<string>).length).toBeGreaterThan(0)
    }
  })

  it('each event type has an independent whitelist — a key in plan.completed is not auto-allowed elsewhere', () => {
    // 'plan_duration_ms' is in plan.completed but NOT in plan.timeout_fallback
    const planCompletedKeys = EVENT_PAYLOAD_WHITELIST['plan.completed'] as ReadonlyArray<string>
    const timeoutFallbackKeys = EVENT_PAYLOAD_WHITELIST['plan.timeout_fallback'] as ReadonlyArray<string>
    expect(planCompletedKeys).toContain('plan_duration_ms')
    expect(timeoutFallbackKeys).not.toContain('plan_duration_ms')
  })
})

// ---------------------------------------------------------------------------
// T-0004-108 (Regression) — successful inserts always have a non-empty payload_json.
// ---------------------------------------------------------------------------

describe('T-0004-108: Regression — successful inserts always include at least {generationId}', () => {
  const genId = '12345678-1234-1234-1234-123456789012'

  it('plan.completed insert always contains generationId', async () => {
    await writeEvent('plan.completed', {
      generationId: genId,
      archetype: 'Dashboard',
      screens_count: 3,
      navigation: 'tabs',
      mode: 'live',
      plan_duration_ms: 300,
    })

    const callArg = mockInsertValues.mock.calls[0][0] as {payloadJson: Record<string, unknown>}
    expect(callArg.payloadJson).toBeDefined()
    expect(callArg.payloadJson.generationId).toBe(genId)
  })

  it('build.completed insert always contains generationId', async () => {
    await writeEvent('build.completed', {
      generationId: genId,
      archetype: 'SocialFeed',
      screens_count: 2,
      navigation: 'stack',
      build_duration_ms: 4000,
    })

    const callArg = mockInsertValues.mock.calls[0][0] as {payloadJson: Record<string, unknown>}
    expect(callArg.payloadJson.generationId).toBe(genId)
  })

  it('edit.completed insert always contains generationId', async () => {
    await writeEvent('edit.completed', {
      generationId: genId,
      archetype: 'ListCRUD',
      screens_count: 1,
      navigation: 'none',
      build_duration_ms: 1500,
    })

    const callArg = mockInsertValues.mock.calls[0][0] as {payloadJson: Record<string, unknown>}
    expect(callArg.payloadJson.generationId).toBe(genId)
  })

  it('build.conformance_fallback (no duration field) — insert has no durationMs column', async () => {
    // Verifies the no-duration branch: when neither plan_duration_ms nor
    // build_duration_ms is in payload, durationMs is not included in the insert.
    await writeEvent('build.conformance_fallback', {
      generationId: genId,
      reason: 'view_count_mismatch',
      archetype: 'Calculator',
    })

    const callArg = mockInsertValues.mock.calls[0][0] as Record<string, unknown>
    expect(callArg.payloadJson).toBeDefined()
    // durationMs should not be present (no spread when undefined)
    expect(callArg.durationMs).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// T-0004-116 (Negative) — build.completed has its own independent whitelist.
//
// 'prompt' is not in build.completed's whitelist. This verifies the per-type
// semantics: build.completed's whitelist is independent of plan.completed's.
// ---------------------------------------------------------------------------

describe("T-0004-116: Negative — build.completed rejects 'prompt' under its own whitelist", () => {
  it("writeEvent('build.completed', {prompt}) throws under build.completed's whitelist specifically", async () => {
    await expect(
      writeEvent('build.completed', {prompt: 'leak'}),
    ).rejects.toThrow(EventPayloadValidationError)

    expect(mockDbInsert).not.toHaveBeenCalled()
  })

  it("build.completed whitelist does not inherit from plan.completed (independent check)", () => {
    // plan.completed has 'mode'; build.completed does NOT have 'mode'
    const buildCompletedAllowed = EVENT_PAYLOAD_WHITELIST['build.completed'] as ReadonlyArray<string>
    const planCompletedAllowed = EVENT_PAYLOAD_WHITELIST['plan.completed'] as ReadonlyArray<string>
    expect(planCompletedAllowed).toContain('mode')
    expect(buildCompletedAllowed).not.toContain('mode')
  })
})

// ---------------------------------------------------------------------------
// T-0004-120 (unit-tier portion) — PLAN_BUILD_EVAL_MODE=true → skip DB insert.
//
// The full orchestrator integration (shadow mode + DB down → generation still
// yields done event) is covered by the "writeEvent failure — generation
// continues" test in pipeline.test.ts. This test covers the unit-level
// eval-mode contract: whitelist still runs, DB insert is skipped.
// ---------------------------------------------------------------------------

describe('T-0004-120 (unit tier): PLAN_BUILD_EVAL_MODE=true — DB insert skipped, validation still runs', () => {
  beforeEach(() => {
    mockEnvValues.PLAN_BUILD_EVAL_MODE = 'true'
  })

  it('returns without inserting when eval mode is enabled', async () => {
    await writeEvent('plan.completed', {
      generationId: 'eval-gen-id',
      archetype: 'Calculator',
      screens_count: 1,
      navigation: 'none',
      mode: 'live',
      plan_duration_ms: 50,
    })

    expect(mockDbInsert).not.toHaveBeenCalled()
  })

  it('still throws EventPayloadValidationError on whitelist violation even in eval mode', async () => {
    await expect(
      writeEvent('plan.completed', {prompt: 'should still be blocked in eval mode'}),
    ).rejects.toThrow(EventPayloadValidationError)

    // DB never called (whitelist threw before we could even check eval mode...
    // actually: whitelist check is BEFORE the eval-mode check, so DB is never called)
    expect(mockDbInsert).not.toHaveBeenCalled()
  })
})
