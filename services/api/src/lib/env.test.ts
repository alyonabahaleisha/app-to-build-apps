/**
 * Unit tests for loadEnv() — ADR-0007 Step 6.
 *
 * M1 PLAN_BUILD_* tests removed (Step 6 deletion sweep).
 * T-0007-143 (no PLAN_BUILD_* vars), T-0007-144 (EVAL_MODE present) are
 * covered in services/api/test/deletion-sweep.test.ts (grep + source checks).
 *
 * This file covers the remaining env.ts behavioral contracts at the unit level.
 *
 * T-0007-144a — EVAL_MODE unset → defaults to 'false'
 * T-0007-144b — EVAL_MODE='true' → boots successfully
 * T-0007-144c — EVAL_MODE='false' → boots successfully
 * T-0007-144d — EVAL_MODE='' → coerced to undefined → defaults to 'false'
 * T-0007-144e — EVAL_MODE=' true ' (whitespace) → boot rejects
 * T-0007-144f — EVAL_MODE='True' (mixed case) → boot rejects
 * T-0007-146  — no contradictory-state check exists (removed with PLAN_BUILD_*)
 */
import {loadEnv} from './env.js'

// Base env that satisfies all required fields in test mode.
const BASE_ENV: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
}

describe('loadEnv — EVAL_MODE (T-0007-144)', () => {
  // T-0007-144a
  it("T-0007-144a: EVAL_MODE unset — defaults to 'false'", () => {
    const env = loadEnv({...BASE_ENV})
    expect(env.EVAL_MODE).toBe('false')
  })

  // T-0007-144b
  it("T-0007-144b: EVAL_MODE='true' — boots successfully with value 'true'", () => {
    const env = loadEnv({...BASE_ENV, EVAL_MODE: 'true'})
    expect(env.EVAL_MODE).toBe('true')
  })

  // T-0007-144c
  it("T-0007-144c: EVAL_MODE='false' — boots successfully with value 'false'", () => {
    const env = loadEnv({...BASE_ENV, EVAL_MODE: 'false'})
    expect(env.EVAL_MODE).toBe('false')
  })

  // T-0007-144d
  // Empty string '' is coerced to undefined by the empty-string cleanup loop,
  // then z.enum(['true','false']).default('false') applies → value is 'false'.
  it("T-0007-144d: EVAL_MODE='' (empty string) — coerced to undefined, defaults to 'false'", () => {
    const env = loadEnv({...BASE_ENV, EVAL_MODE: ''})
    expect(env.EVAL_MODE).toBe('false')
  })

  // T-0007-144e
  it("T-0007-144e: EVAL_MODE=' true ' (whitespace-padded) — boot rejects (z.enum exact-match)", () => {
    expect(() => loadEnv({...BASE_ENV, EVAL_MODE: ' true '})).toThrow(/Invalid environment/)
  })

  // T-0007-144f
  it("T-0007-144f: EVAL_MODE='True' (mixed case) — boot rejects (z.enum is case-sensitive)", () => {
    expect(() => loadEnv({...BASE_ENV, EVAL_MODE: 'True'})).toThrow(/Invalid environment/)
  })
})

describe('loadEnv — T-0007-146: no contradictory-state check', () => {
  // T-0007-146: the PERCENT=100 + SHADOW=true check is gone with PLAN_BUILD_* removal.
  // Verifying env parses cleanly with no PLAN_BUILD_* vars and no post-parse guard.
  it('T-0007-146: loadEnv with minimal env does not throw a contradictory-state error', () => {
    // Before Step 6, PERCENT=100 + SHADOW=true would have thrown. Now there is
    // no such check. Verifying the overall parse does not error.
    expect(() => loadEnv({...BASE_ENV})).not.toThrow()
  })
})
