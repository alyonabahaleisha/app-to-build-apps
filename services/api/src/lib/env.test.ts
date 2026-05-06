/**
 * Unit tests for loadEnv().
 *
 * Tests validate the environment variable parsing logic in isolation.
 * All tests call loadEnv() with a raw env object so no real process.env
 * mutation is needed. NODE_ENV is set to 'test' to relax SUPABASE_* requirements.
 *
 * T-0004-060 through T-0004-069, T-0004-123, T-0004-124
 * Tests for PLAN_BUILD_PIPELINE_PERCENT and PLAN_BUILD_PIPELINE_SHADOW.
 *
 * T-0004-EVAL-001 through T-0004-EVAL-006 (Step 8)
 * Tests for PLAN_BUILD_EVAL_MODE.
 */
import {loadEnv} from './env.js'

// Base env that satisfies all non-pipeline required fields in test mode.
const BASE_ENV: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
}

describe('loadEnv — PLAN_BUILD_PIPELINE_PERCENT', () => {
  // T-0004-060
  it('defaults to 0 when PLAN_BUILD_PIPELINE_PERCENT is not set', () => {
    const env = loadEnv({...BASE_ENV})
    expect(env.PLAN_BUILD_PIPELINE_PERCENT).toBe(0)
  })

  // T-0004-061
  // ADR-0004 rev-2 Cal decision: empty string is coerced to undefined by env.ts:69,
  // then z.coerce.number().default(0) applies. Boot succeeds with value 0.
  // The original ADR rev-1 expectation (boot rejects) was wrong per the repo
  // convention: empty strings → undefined → default. See task brief for rationale.
  it('T-0004-061: PLAN_BUILD_PIPELINE_PERCENT="" (empty) — coerced to undefined, defaults to 0; boot succeeds', () => {
    const env = loadEnv({...BASE_ENV, PLAN_BUILD_PIPELINE_PERCENT: ''})
    expect(env.PLAN_BUILD_PIPELINE_PERCENT).toBe(0)
  })

  // T-0004-062
  // z.coerce.number() trims and coerces whitespace-padded numeric strings to numbers.
  it('T-0004-062: PLAN_BUILD_PIPELINE_PERCENT=" 50 " (whitespace-padded) — coerced to 50', () => {
    const env = loadEnv({...BASE_ENV, PLAN_BUILD_PIPELINE_PERCENT: ' 50 '})
    expect(env.PLAN_BUILD_PIPELINE_PERCENT).toBe(50)
  })

  // T-0004-063
  it('T-0004-063: PLAN_BUILD_PIPELINE_PERCENT=101 — boot rejects (max 100)', () => {
    expect(() => loadEnv({...BASE_ENV, PLAN_BUILD_PIPELINE_PERCENT: '101'})).toThrow(
      /Invalid environment/,
    )
  })

  // T-0004-064
  it('T-0004-064: PLAN_BUILD_PIPELINE_PERCENT=-1 — boot rejects (min 0)', () => {
    expect(() => loadEnv({...BASE_ENV, PLAN_BUILD_PIPELINE_PERCENT: '-1'})).toThrow(
      /Invalid environment/,
    )
  })

  // T-0004-065
  it('T-0004-065: PLAN_BUILD_PIPELINE_PERCENT=abc — boot rejects (non-numeric)', () => {
    expect(() => loadEnv({...BASE_ENV, PLAN_BUILD_PIPELINE_PERCENT: 'abc'})).toThrow(
      /Invalid environment/,
    )
  })
})

describe('loadEnv — PLAN_BUILD_PIPELINE_SHADOW', () => {
  // T-0004-066
  it("T-0004-066: PLAN_BUILD_PIPELINE_SHADOW unset — defaults to 'false'", () => {
    const env = loadEnv({...BASE_ENV})
    expect(env.PLAN_BUILD_PIPELINE_SHADOW).toBe('false')
  })

  // T-0004-067
  // z.enum is exact-match and case-sensitive. 'True' (mixed case) does not match
  // 'true' or 'false', so boot rejects.
  it("T-0004-067: PLAN_BUILD_PIPELINE_SHADOW='True' (mixed case) — boot rejects (z.enum is case-sensitive)", () => {
    expect(() => loadEnv({...BASE_ENV, PLAN_BUILD_PIPELINE_SHADOW: 'True'})).toThrow(
      /Invalid environment/,
    )
  })

  // T-0004-068
  // Contradictory state: PERCENT=100 + SHADOW=true. Boot rejects via the post-parse
  // check in loadEnv (after safeParse succeeds). Shadow mode requires legacy traffic
  // to coexist with; 100% routing leaves nothing to shadow.
  it("T-0004-068: PLAN_BUILD_PIPELINE_SHADOW='true' + PERCENT=100 — boot rejects (contradictory state)", () => {
    expect(() =>
      loadEnv({
        ...BASE_ENV,
        PLAN_BUILD_PIPELINE_SHADOW: 'true',
        PLAN_BUILD_PIPELINE_PERCENT: '100',
      }),
    ).toThrow(/contradictory/)
  })

  // T-0004-069
  it("T-0004-069: PLAN_BUILD_PIPELINE_SHADOW='true' + PERCENT=0 — boots successfully (valid shadow Phase B config)", () => {
    const env = loadEnv({
      ...BASE_ENV,
      PLAN_BUILD_PIPELINE_SHADOW: 'true',
      PLAN_BUILD_PIPELINE_PERCENT: '0',
    })
    expect(env.PLAN_BUILD_PIPELINE_SHADOW).toBe('true')
    expect(env.PLAN_BUILD_PIPELINE_PERCENT).toBe(0)
  })

  // T-0004-123
  // Cal decision (rev-2): SHADOW='' is empty, coerced to undefined by env.ts:69,
  // then z.enum(['true','false']).default('false') applies → value is 'false'.
  // Boot succeeds. This is the asymmetry: empty → default, whitespace → reject.
  // The asymmetry is intentional and matches the established repo convention
  // (env.ts line 68-69 only coerces exact empty string '', not whitespace-only).
  it("T-0004-123: PLAN_BUILD_PIPELINE_SHADOW='' (empty string) — coerced to undefined, defaults to 'false'; boot succeeds", () => {
    const env = loadEnv({...BASE_ENV, PLAN_BUILD_PIPELINE_SHADOW: ''})
    expect(env.PLAN_BUILD_PIPELINE_SHADOW).toBe('false')
  })

  // T-0004-124
  // SHADOW=' true ' (whitespace-padded): NOT empty (coercion only handles ''),
  // so it is NOT coerced to undefined. The value ' true ' reaches z.enum which
  // requires exact-match 'true' or 'false'. ' true ' does not match either. Boot rejects.
  // Asymmetry vs T-0004-123 is intentional: only exact empty string '' is coerced.
  it("T-0004-124: PLAN_BUILD_PIPELINE_SHADOW=' true ' (whitespace-padded) — boot rejects (z.enum exact-match; not coerced)", () => {
    expect(() => loadEnv({...BASE_ENV, PLAN_BUILD_PIPELINE_SHADOW: ' true '})).toThrow(
      /Invalid environment/,
    )
  })
})

describe("loadEnv — PLAN_BUILD_EVAL_MODE (Step 8)", () => {
  // T-0004-EVAL-001
  // EVAL_MODE unset → z.enum(['true','false']).default('false') → 'false'.
  it("T-0004-EVAL-001: PLAN_BUILD_EVAL_MODE unset — defaults to 'false'", () => {
    const env = loadEnv({...BASE_ENV})
    expect(env.PLAN_BUILD_EVAL_MODE).toBe('false')
  })

  // T-0004-EVAL-002
  it("T-0004-EVAL-002: PLAN_BUILD_EVAL_MODE='true' — boots successfully with value 'true'", () => {
    const env = loadEnv({...BASE_ENV, PLAN_BUILD_EVAL_MODE: 'true'})
    expect(env.PLAN_BUILD_EVAL_MODE).toBe('true')
  })

  // T-0004-EVAL-003
  it("T-0004-EVAL-003: PLAN_BUILD_EVAL_MODE='false' — boots successfully with value 'false'", () => {
    const env = loadEnv({...BASE_ENV, PLAN_BUILD_EVAL_MODE: 'false'})
    expect(env.PLAN_BUILD_EVAL_MODE).toBe('false')
  })

  // T-0004-EVAL-004
  // Empty string '' is coerced to undefined by env.ts:75 (the empty-string cleanup loop),
  // then z.enum(['true','false']).default('false') applies → value is 'false'.
  // Mirrors the established convention for SHADOW (T-0004-123).
  it("T-0004-EVAL-004: PLAN_BUILD_EVAL_MODE='' (empty string) — coerced to undefined, defaults to 'false'; boot succeeds", () => {
    const env = loadEnv({...BASE_ENV, PLAN_BUILD_EVAL_MODE: ''})
    expect(env.PLAN_BUILD_EVAL_MODE).toBe('false')
  })

  // T-0004-EVAL-005
  // ' true ' (whitespace-padded): NOT coerced (only exact '' is coerced).
  // Reaches z.enum which requires exact 'true' or 'false'. Rejects.
  // Mirrors T-0004-124 for SHADOW.
  it("T-0004-EVAL-005: PLAN_BUILD_EVAL_MODE=' true ' (whitespace-padded) — boot rejects (z.enum exact-match)", () => {
    expect(() => loadEnv({...BASE_ENV, PLAN_BUILD_EVAL_MODE: ' true '})).toThrow(
      /Invalid environment/,
    )
  })

  // T-0004-EVAL-006
  // 'True' (mixed case): z.enum is case-sensitive. Does not match 'true' or 'false'. Rejects.
  // Mirrors T-0004-067 for SHADOW.
  it("T-0004-EVAL-006: PLAN_BUILD_EVAL_MODE='True' (mixed case) — boot rejects (z.enum is case-sensitive)", () => {
    expect(() => loadEnv({...BASE_ENV, PLAN_BUILD_EVAL_MODE: 'True'})).toThrow(
      /Invalid environment/,
    )
  })
})
