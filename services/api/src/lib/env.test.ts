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

// =============================================================================
// ADR-0013 Step 1e — APPLE_SIWA_* config exhaustion (T-0013-071..078)
// =============================================================================

const BASE_PROD: NodeJS.ProcessEnv = {
  NODE_ENV: 'production',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  SUPABASE_JWT_SECRET: 'jwt-secret-prod',
  APPLE_SIWA_CLIENT_ID: 'com.appcreator.mvp.siwa',
  APPLE_SIWA_TEAM_ID: 'TEAMID12',
  APPLE_SIWA_KEY_ID: 'KID1234567',
  APPLE_SIWA_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----',
  // ADR-0008 Step 2: required in production — 10-char uppercase TEAMID + bundleID.
  APPLE_APP_ID_PREFIX: 'TEAMID12AB.com.appcreator.mvp',
}

describe('loadEnv — APPLE_SIWA_* config exhaustion (ADR-0013)', () => {
  // T-0013-071
  it('T-0013-071: APPLE_SIWA_CLIENT_ID unset in non-test env → throws', () => {
    const {APPLE_SIWA_CLIENT_ID: _, ...rest} = BASE_PROD
    expect(() => loadEnv({...rest})).toThrow(/APPLE_SIWA_CLIENT_ID/)
  })

  // T-0013-072
  it("T-0013-072: APPLE_SIWA_CLIENT_ID = '' → throws", () => {
    expect(() => loadEnv({...BASE_PROD, APPLE_SIWA_CLIENT_ID: ''})).toThrow(/APPLE_SIWA_CLIENT_ID/)
  })

  // T-0013-073
  it("T-0013-073: APPLE_SIWA_CLIENT_ID = '   ' (whitespace) → throws", () => {
    expect(() => loadEnv({...BASE_PROD, APPLE_SIWA_CLIENT_ID: '   '})).toThrow(
      /APPLE_SIWA_CLIENT_ID/,
    )
  })

  // T-0013-074
  it('T-0013-074: APPLE_SIWA_CLIENT_ID unset in test env → succeeds (test relaxation)', () => {
    // In test env, all APPLE_SIWA_* vars are optional.
    expect(() => loadEnv({NODE_ENV: 'test'})).not.toThrow()
  })

  // T-0013-075
  it('T-0013-075: all four APPLE_SIWA_* vars present and valid in non-test → succeeds with all four populated', () => {
    const env = loadEnv({...BASE_PROD})
    expect(env.APPLE_SIWA_CLIENT_ID).toBe('com.appcreator.mvp.siwa')
    expect(env.APPLE_SIWA_TEAM_ID).toBe('TEAMID12')
    expect(env.APPLE_SIWA_KEY_ID).toBe('KID1234567')
    expect(env.APPLE_SIWA_PRIVATE_KEY).toBe(
      '-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----',
    )
  })

  // T-0013-076
  it('T-0013-076: APPLE_SIWA_PRIVATE_KEY with \\n-escaped multiline content is parsed correctly', () => {
    const key = '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkq...\n-----END PRIVATE KEY-----'
    const env = loadEnv({...BASE_PROD, APPLE_SIWA_PRIVATE_KEY: key})
    expect(env.APPLE_SIWA_PRIVATE_KEY).toBe(key)
  })

  // T-0013-077
  it("T-0013-077: APPLE_SIWA_TEAM_ID = 'TEAMID12' (8 chars, Apple's actual format) → accepted", () => {
    const env = loadEnv({...BASE_PROD, APPLE_SIWA_TEAM_ID: 'TEAMID12'})
    expect(env.APPLE_SIWA_TEAM_ID).toBe('TEAMID12')
  })

  // T-0013-078
  it("T-0013-078: APPLE_SIWA_KEY_ID = 'KID1234567' (10 chars, Apple's actual format) → accepted", () => {
    const env = loadEnv({...BASE_PROD, APPLE_SIWA_KEY_ID: 'KID1234567'})
    expect(env.APPLE_SIWA_KEY_ID).toBe('KID1234567')
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
