import 'dotenv/config'
import {z} from 'zod'

/**
 * Treat undefined / empty string / whitespace-only as "not set". Used by every
 * conditional-required field so missing/blank/whitespace cases all fail-fast.
 */
const requiredString = (label: string) =>
  z
    .string({required_error: `${label} is required`})
    .refine(v => v.trim().length > 0, {message: `${label} must not be empty or whitespace`})

const optionalNonEmpty = z
  .string()
  .refine(v => v === undefined || v.trim().length > 0, {message: 'must not be whitespace'})
  .optional()

/**
 * In non-test environments the three SUPABASE_* keys are required; in tests
 * they remain optional so unit tests can inject mocks. T-0001-029 covers this.
 */
function buildSchema(nodeEnv: string) {
  // SUPABASE_URL must be HTTPS in non-test envs (T-0001-048). HTTP is rejected
  // explicitly — Supabase only serves over TLS, and accepting HTTP would let
  // a misconfigured deploy leak the service-role key over plaintext. Tests
  // accept the relaxed shape so unit tests don't need a real Supabase URL.
  const supabaseUrl =
    nodeEnv === 'test'
      ? z.string().url().optional()
      : requiredString('SUPABASE_URL').refine(v => /^https:\/\//.test(v), {
          message: 'SUPABASE_URL must be an https:// URL',
        })

  const supabaseServiceRoleKey =
    nodeEnv === 'test' ? optionalNonEmpty : requiredString('SUPABASE_SERVICE_ROLE_KEY')

  const supabaseJwtSecret =
    nodeEnv === 'test' ? optionalNonEmpty : requiredString('SUPABASE_JWT_SECRET')

  return z.object({
    PORT: z.coerce.number().default(3000),
    NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

    ANTHROPIC_API_KEY: z.string().optional(),

    SUPABASE_URL: supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: supabaseServiceRoleKey,
    SUPABASE_JWT_SECRET: supabaseJwtSecret,

    DATABASE_URL: z.string().optional(),

    LANGFUSE_PUBLIC_KEY: z.string().optional(),
    LANGFUSE_SECRET_KEY: z.string().optional(),
    LANGFUSE_HOST: z.string().url().optional(),

    // ADR-0004 Step 5 — Plan → Build pipeline feature flags.
    // PERCENT: 0..100 integer; 0 = off, 100 = all users routed to new pipeline.
    // SHADOW: 'true' = planner runs but legacy result returned to client (Phase B).
    // Contradictory state: PERCENT=100 + SHADOW=true is rejected at boot —
    // shadow mode must coexist with legacy traffic, not replace it entirely.
    PLAN_BUILD_PIPELINE_PERCENT: z.coerce.number().int().min(0).max(100).default(0),
    PLAN_BUILD_PIPELINE_SHADOW: z.enum(['true', 'false']).default('false'),
    // ADR-0004 Step 8 — Eval mode short-circuit for telemetry.
    // 'true' = writeEvent validates payload whitelist but skips the DB insert.
    // Prevents eval runs from polluting the analytics events table.
    // Default 'false'. Orthogonal to SHADOW and PERCENT.
    PLAN_BUILD_EVAL_MODE: z.enum(['true', 'false']).default('false'),
  })
}

export type Env = z.infer<ReturnType<typeof buildSchema>>

/**
 * Pure: validate a raw environment object. Throws on invalid input. Used by
 * the module-level boot path and by env.test.ts (T-0001-029).
 */
export function loadEnv(rawEnv: NodeJS.ProcessEnv = process.env): Env {
  // Coerce empty-string env vars to undefined so .optional() works as expected.
  const cleaned: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(rawEnv)) {
    cleaned[key] = value === '' ? undefined : value
  }
  const nodeEnv = (cleaned.NODE_ENV ?? 'development') as string
  const schema = buildSchema(nodeEnv)
  const parsed = schema.safeParse(cleaned)
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors
    const summary = JSON.stringify(fieldErrors)
    throw new Error(`Invalid environment: ${summary}`)
  }
  // Post-parse contradictory-state check (T-0004-068): PERCENT=100 + SHADOW=true
  // is logically impossible — shadow mode requires a legacy path to coexist with;
  // routing 100% of traffic to the new pipeline leaves nothing to shadow.
  if (
    parsed.data.PLAN_BUILD_PIPELINE_PERCENT === 100 &&
    parsed.data.PLAN_BUILD_PIPELINE_SHADOW === 'true'
  ) {
    throw new Error(
      'Invalid environment: PLAN_BUILD_PIPELINE_PERCENT=100 with SHADOW=true is contradictory; shadow mode must run alongside legacy, not replace it',
    )
  }
  return parsed.data
}

let _env: Env | undefined
try {
  _env = loadEnv()
} catch (err) {
  // Module-level boot: fast-exit on bad config. Tests use loadEnv() directly
  // and never hit this branch (NODE_ENV=test relaxes the SUPABASE_* fields).
  console.error((err as Error).message)
  process.exit(1)
}

export const env: Env = _env as Env
