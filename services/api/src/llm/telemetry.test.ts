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
import * as fs from 'node:fs'
import * as path from 'node:path'

import {
  writeEvent,
  EventPayloadValidationError,
  EVENT_PAYLOAD_WHITELIST,
  type EventType,
} from './telemetry.js'

// ---------------------------------------------------------------------------
// ADR-0013 Step 5 — SIWA telemetry event tests
// T-0013-122..129, T-0013-141
// ---------------------------------------------------------------------------

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
// (ADR-0008 adds 3 more: share_link.created, share_link.clone_accepted,
//  share_link.reserved_mode_viewed — total is now 7)
// ---------------------------------------------------------------------------

describe('T-0007-141: whitelist contains all 4 original V0 event types + 3 ADR-0008 + 3 ADR-0013 additions', () => {
  const V0_EVENT_TYPES: EventType[] = [
    'generate.completed',
    'generate.invalid_spec',
    'generate.out_of_scope',
    'out_of_scope_intent_captured',
  ]

  const ADR_0008_EVENT_TYPES: EventType[] = [
    'share_link.created',
    'share_link.clone_accepted',
    'share_link.reserved_mode_viewed',
  ]

  const ADR_0013_EVENT_TYPES: EventType[] = [
    'auth.siwa_sign_in_succeeded',
    'auth.siwa_sign_in_failed',
    'auth.siwa_token_validation_failed',
  ]

  const ALL_EVENT_TYPES = [...V0_EVENT_TYPES, ...ADR_0008_EVENT_TYPES, ...ADR_0013_EVENT_TYPES]

  it('EVENT_PAYLOAD_WHITELIST has exactly the 10 event types (4 V0 + 3 ADR-0008 + 3 ADR-0013)', () => {
    const keys = Object.keys(EVENT_PAYLOAD_WHITELIST)
    for (const eventType of ALL_EVENT_TYPES) {
      expect(keys).toContain(eventType)
    }
    // No extra keys
    expect(keys).toHaveLength(ALL_EVENT_TYPES.length)
  })

  for (const eventType of ALL_EVENT_TYPES) {
    it(`${eventType} whitelist is a non-empty array`, () => {
      expect(Array.isArray(EVENT_PAYLOAD_WHITELIST[eventType])).toBe(true)
      expect((EVENT_PAYLOAD_WHITELIST[eventType] as ReadonlyArray<string>).length).toBeGreaterThan(0)
    })
  }
})

// ---------------------------------------------------------------------------
// T-0007-142: each V0 event type rejects unknown keys (whitelist enforcement)
// ---------------------------------------------------------------------------

describe('T-0007-142: per-event-type whitelist rejects unknown keys (V0 + ADR-0008)', () => {
  const BAD_KEY = '__not_allowed_key__'

  const ALL_EVENT_TYPES: EventType[] = [
    'generate.completed',
    'generate.invalid_spec',
    'generate.out_of_scope',
    'out_of_scope_intent_captured',
    'share_link.created',
    'share_link.clone_accepted',
    'share_link.reserved_mode_viewed',
    'auth.siwa_sign_in_succeeded',
    'auth.siwa_sign_in_failed',
    'auth.siwa_token_validation_failed',
  ]

  for (const eventType of ALL_EVENT_TYPES) {
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
// ADR-0010 Step 4: T-0010-081 through T-0010-088 — prompt_version whitelist
// ---------------------------------------------------------------------------

describe("T-0010-081: EVENT_PAYLOAD_WHITELIST['generate.completed'] includes 'prompt_version'", () => {
  it("generate.completed whitelist contains 'prompt_version'", () => {
    const allowed = EVENT_PAYLOAD_WHITELIST['generate.completed'] as ReadonlyArray<string>
    expect(allowed).toContain('prompt_version')
  })
})

describe("T-0010-084: writeEvent('generate.completed', {prompt_version: 'unknown', ...validKeys}) succeeds", () => {
  it("prompt_version: 'unknown' is accepted — whitelist is key-based, not value-based", async () => {
    await expect(
      writeEvent('generate.completed', {
        generationId: 'test-gen',
        archetype: 'Calculator',
        screens_count: 1,
        navigation: 'none',
        generation_duration_ms: 100,
        prompt_version: 'unknown',
      }),
    ).resolves.toBeUndefined()
  })
})

describe("T-0010-085: EVENT_PAYLOAD_WHITELIST['generate.out_of_scope'] does NOT include 'prompt_version'", () => {
  it("generate.out_of_scope whitelist intentionally excludes prompt_version (V0 scope tightness)", () => {
    const allowed = EVENT_PAYLOAD_WHITELIST['generate.out_of_scope'] as ReadonlyArray<string>
    expect(allowed).not.toContain('prompt_version')
  })
})

describe("T-0010-086: EVENT_PAYLOAD_WHITELIST['generate.invalid_spec'] does NOT include 'prompt_version'", () => {
  it("generate.invalid_spec whitelist intentionally excludes prompt_version (V0 scope tightness)", () => {
    const allowed = EVENT_PAYLOAD_WHITELIST['generate.invalid_spec'] as ReadonlyArray<string>
    expect(allowed).not.toContain('prompt_version')
  })
})

describe("T-0010-087: EVENT_PAYLOAD_WHITELIST['out_of_scope_intent_captured'] does NOT include 'prompt_version'", () => {
  it("out_of_scope_intent_captured whitelist intentionally excludes prompt_version (V0 scope tightness)", () => {
    const allowed = EVENT_PAYLOAD_WHITELIST['out_of_scope_intent_captured'] as ReadonlyArray<string>
    expect(allowed).not.toContain('prompt_version')
  })
})

describe('T-0010-088: generate.completed whitelist retains its original 5 keys unchanged', () => {
  const EXPECTED_ORIGINAL_KEYS = [
    'generationId',
    'archetype',
    'screens_count',
    'navigation',
    'generation_duration_ms',
  ]

  for (const key of EXPECTED_ORIGINAL_KEYS) {
    it(`generate.completed whitelist still contains '${key}'`, () => {
      const allowed = EVENT_PAYLOAD_WHITELIST['generate.completed'] as ReadonlyArray<string>
      expect(allowed).toContain(key)
    })
  }
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

// ---------------------------------------------------------------------------
// ADR-0013 Step 5 — SIWA telemetry event tests (T-0013-122..129, T-0013-141)
// ---------------------------------------------------------------------------

// T-0013-122: Happy — auth.siwa_sign_in_succeeded with {provider: 'apple'} accepted
describe('T-0013-122: auth.siwa_sign_in_succeeded — happy path accepted', () => {
  it("writeEvent('auth.siwa_sign_in_succeeded', {provider: 'apple'}) resolves without throwing", async () => {
    await expect(
      writeEvent('auth.siwa_sign_in_succeeded', {provider: 'apple'}),
    ).resolves.toBeUndefined()
    expect(mockDbInsert).toHaveBeenCalled()
  })
})

// T-0013-123: Happy — auth.siwa_sign_in_failed with provider + valid failure_code accepted
describe('T-0013-123: auth.siwa_sign_in_failed — happy path with failure_code accepted', () => {
  it("writeEvent('auth.siwa_sign_in_failed', {provider: 'apple', failure_code: 'audience_mismatch'}) resolves", async () => {
    await expect(
      writeEvent('auth.siwa_sign_in_failed', {provider: 'apple', failure_code: 'audience_mismatch'}),
    ).resolves.toBeUndefined()
    expect(mockDbInsert).toHaveBeenCalled()
  })
})

// T-0013-124: Happy — auth.siwa_token_validation_failed with provider + valid failure_code accepted
describe('T-0013-124: auth.siwa_token_validation_failed — happy path with failure_code accepted', () => {
  it("writeEvent('auth.siwa_token_validation_failed', {provider: 'apple', failure_code: 'kid_unknown'}) resolves", async () => {
    await expect(
      writeEvent('auth.siwa_token_validation_failed', {provider: 'apple', failure_code: 'kid_unknown'}),
    ).resolves.toBeUndefined()
    expect(mockDbInsert).toHaveBeenCalled()
  })
})

// T-0013-125: Negative — email key rejected on auth.siwa_sign_in_succeeded
describe('T-0013-125: auth.siwa_sign_in_succeeded — email key REJECTED (leak vector)', () => {
  it('payload with email key throws EventPayloadValidationError; DB not called', async () => {
    await expect(
      writeEvent('auth.siwa_sign_in_succeeded', {provider: 'apple', email: 'leak@example.com'}),
    ).rejects.toThrow(EventPayloadValidationError)
    expect(mockDbInsert).not.toHaveBeenCalled()
  })
})

// T-0013-126: Negative — sub key rejected on auth.siwa_sign_in_succeeded
describe('T-0013-126: auth.siwa_sign_in_succeeded — sub key REJECTED (leak vector)', () => {
  it('payload with sub key throws EventPayloadValidationError; DB not called', async () => {
    await expect(
      writeEvent('auth.siwa_sign_in_succeeded', {provider: 'apple', sub: 'apple-sub'}),
    ).rejects.toThrow(EventPayloadValidationError)
    expect(mockDbInsert).not.toHaveBeenCalled()
  })
})

// T-0013-127: Negative — identity_token key rejected on auth.siwa_sign_in_succeeded
describe('T-0013-127: auth.siwa_sign_in_succeeded — identity_token key REJECTED (leak vector)', () => {
  it('payload with identity_token key throws EventPayloadValidationError; DB not called', async () => {
    await expect(
      writeEvent('auth.siwa_sign_in_succeeded', {provider: 'apple', identity_token: 'eyJ...'}),
    ).rejects.toThrow(EventPayloadValidationError)
    expect(mockDbInsert).not.toHaveBeenCalled()
  })
})

// T-0013-128: Regression — EVAL_MODE=true: validation runs, DB insert skipped for SIWA events
describe('T-0013-128: EVAL_MODE=true — SIWA events validate but skip DB insert', () => {
  beforeEach(() => {
    mockEnvValues.EVAL_MODE = 'true'
  })

  it('auth.siwa_sign_in_succeeded: resolves without DB insert in eval mode', async () => {
    await expect(
      writeEvent('auth.siwa_sign_in_succeeded', {provider: 'apple'}),
    ).resolves.toBeUndefined()
    expect(mockDbInsert).not.toHaveBeenCalled()
  })

  it('auth.siwa_sign_in_failed: resolves without DB insert in eval mode', async () => {
    await expect(
      writeEvent('auth.siwa_sign_in_failed', {provider: 'apple', failure_code: 'expired'}),
    ).resolves.toBeUndefined()
    expect(mockDbInsert).not.toHaveBeenCalled()
  })

  it('auth.siwa_token_validation_failed: resolves without DB insert in eval mode', async () => {
    await expect(
      writeEvent('auth.siwa_token_validation_failed', {provider: 'apple'}),
    ).resolves.toBeUndefined()
    expect(mockDbInsert).not.toHaveBeenCalled()
  })

  it('auth.siwa_sign_in_succeeded: email key still throws EventPayloadValidationError in eval mode', async () => {
    await expect(
      writeEvent('auth.siwa_sign_in_succeeded', {provider: 'apple', email: 'leak@example.com'}),
    ).rejects.toThrow(EventPayloadValidationError)
    expect(mockDbInsert).not.toHaveBeenCalled()
  })
})

// T-0013-129: Docs-lint — reviewer notes contain 'Sign in with Apple' substring
describe('T-0013-129: docs-lint — canvas-v0-reviewer-notes.md contains "Sign in with Apple"', () => {
  it('canvas-v0-reviewer-notes.md exists and contains the required auth model substring', () => {
    // ts-jest runs in CJS mode — __dirname is the compiled output directory,
    // which mirrors src/ under services/api. Navigate up 4 levels to repo root.
    const notesPath = path.resolve(__dirname, '../../../../docs/product/canvas-v0-reviewer-notes.md')
    const content = fs.readFileSync(notesPath, 'utf-8')
    expect(content).toContain('Sign in with Apple')
  })
})

// T-0013-141: failure_code is optional; when present, must be in AppleIdentityErrorCode union
describe('T-0013-141: failure_code — optional field, union-constrained when present', () => {
  describe('auth.siwa_sign_in_failed', () => {
    it('Sub-case A: no failure_code (omitted) → accepted (optional field)', async () => {
      await expect(
        writeEvent('auth.siwa_sign_in_failed', {provider: 'apple'}),
      ).resolves.toBeUndefined()
    })

    it('Sub-case B: failure_code: "made_up_code" → REJECTED (not in union)', async () => {
      await expect(
        writeEvent('auth.siwa_sign_in_failed', {provider: 'apple', failure_code: 'made_up_code'}),
      ).rejects.toThrow(EventPayloadValidationError)
      expect(mockDbInsert).not.toHaveBeenCalled()
    })

    it('all 8 AppleIdentityErrorCode union values are accepted', async () => {
      const validCodes = [
        'malformed',
        'signature_invalid',
        'kid_unknown',
        'expired',
        'issuer_mismatch',
        'audience_mismatch',
        'jwks_unreachable',
        'missing_claim',
      ]
      for (const code of validCodes) {
        jest.clearAllMocks()
        mockDbInsert.mockReturnValue({values: mockInsertValues})
        mockInsertValues.mockResolvedValue(undefined)
        await expect(
          writeEvent('auth.siwa_sign_in_failed', {provider: 'apple', failure_code: code}),
        ).resolves.toBeUndefined()
      }
    })
  })

  describe('auth.siwa_token_validation_failed', () => {
    it('Sub-case A: no failure_code (omitted) → accepted (optional field)', async () => {
      await expect(
        writeEvent('auth.siwa_token_validation_failed', {provider: 'apple'}),
      ).resolves.toBeUndefined()
    })

    it('Sub-case B: failure_code: "made_up_code" → REJECTED (not in union)', async () => {
      await expect(
        writeEvent('auth.siwa_token_validation_failed', {provider: 'apple', failure_code: 'made_up_code'}),
      ).rejects.toThrow(EventPayloadValidationError)
      expect(mockDbInsert).not.toHaveBeenCalled()
    })
  })
})
