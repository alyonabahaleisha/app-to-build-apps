/**
 * outOfScope.service.ts tests — ADR-0007 Step 5.
 *
 * Tests T-0007-102 (DB migration smoke), T-0007-103..104 (happy inserts),
 * T-0007-117..119 (security + concurrency), T-0007-122 (EVAL_MODE),
 * T-0007-123 (capability enum matches tool definition).
 *
 * Note: T-0007-105..116 (route-level validation) and T-0007-120 (rate limit)
 * live in routes/outOfScope.test.ts. T-0007-121 (telemetry) is tested there too
 * since it requires the full request context.
 *
 * DB-required tests: uses testcontainers (pgvector/pgvector:pg16). Migration
 * 0006 must apply cleanly for T-0007-102.
 */

import {createHash} from 'node:crypto'

import type {NodePgDatabase} from 'drizzle-orm/node-postgres'

import {outOfScopeIntent, users} from '../db/schema.js'
import * as schema from '../db/schema.js'
import {userRow} from '../../test/factories.js'
import {
  closeTestPool,
  getTestDb,
  getTestPool,
  truncateAll,
} from '../../test/setup.js'
import {createOutOfScopeService} from './outOfScope.service.js'
import {OutOfScopeInputSchema} from '../llm/tools/outOfScope.js'
import {outOfScopeTool} from '../llm/tools/outOfScope.js'

type Db = NodePgDatabase<typeof schema>

// Sha256 helper for T-0007-183 style tests
function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex')
}

// Mock writeEvent so telemetry never hits DB in service tests
jest.mock('../llm/telemetry.js', () => ({
  writeEvent: jest.fn().mockResolvedValue(undefined),
}))

describe('out_of_scope_intent — DB migration smoke (T-0007-102)', () => {
  let pool: Awaited<ReturnType<typeof getTestPool>>

  beforeAll(async () => {
    pool = await getTestPool()
  })

  afterAll(async () => {
    await closeTestPool()
  })

  // T-0007-102: migration creates the table with CHECK constraints active
  it('T-0007-102: out_of_scope_intent table exists after migration', async () => {
    const result = await pool.query<{table_name: string}>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'out_of_scope_intent'`,
    )
    expect(result.rows).toHaveLength(1)
  })

  it('T-0007-102: capability CHECK rejects invalid value', async () => {
    await expect(
      pool.query(
        `INSERT INTO out_of_scope_intent (user_id, capability, prompt_hash, reason)
         VALUES ($1, $2, $3, $4)`,
        [null, 'unicorn', 'a'.repeat(64), 'some reason'],
      ),
    ).rejects.toThrow(/check|violates/i)
  })

  it('T-0007-102: prompt_hash CHECK rejects non-64-char value', async () => {
    await expect(
      pool.query(
        `INSERT INTO out_of_scope_intent (user_id, capability, prompt_hash, reason)
         VALUES ($1, $2, $3, $4)`,
        [null, 'vision', 'a'.repeat(63), 'some reason'],
      ),
    ).rejects.toThrow(/check|violates/i)
  })

  it('T-0007-102: reason CHECK rejects >200 char value', async () => {
    await expect(
      pool.query(
        `INSERT INTO out_of_scope_intent (user_id, capability, prompt_hash, reason)
         VALUES ($1, $2, $3, $4)`,
        [null, 'vision', 'a'.repeat(64), 'x'.repeat(201)],
      ),
    ).rejects.toThrow(/check|violates/i)
  })

  it('T-0007-102: email CHECK rejects >320 char email', async () => {
    await expect(
      pool.query(
        `INSERT INTO out_of_scope_intent (user_id, capability, prompt_hash, reason, email)
         VALUES ($1, $2, $3, $4, $5)`,
        [null, 'vision', 'a'.repeat(64), 'some reason', 'x'.repeat(321)],
      ),
    ).rejects.toThrow(/check|violates/i)
  })
})

describe('outOfScopeService.captureIntent', () => {
  let db: Db

  beforeAll(async () => {
    db = await getTestDb()
  })

  afterEach(async () => {
    await truncateAll()
  })

  afterAll(async () => {
    await closeTestPool()
  })

  const validHash = sha256Hex('test prompt')

  // T-0007-103: valid body inserts one row
  it('T-0007-103: captureIntent with valid input inserts one row', async () => {
    const u = userRow()
    await db.insert(users).values(u)
    const service = createOutOfScopeService(db)

    await service.captureIntent({
      userId: u.id!,
      capability: 'vision',
      promptHash: validHash,
      reason: 'identifies plants from photos',
    })

    const rows = await db.select().from(outOfScopeIntent)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.capability).toBe('vision')
    expect(rows[0]?.promptHash).toBe(validHash)
    expect(rows[0]?.reason).toBe('identifies plants from photos')
    expect(rows[0]?.email).toBeNull()
    expect(rows[0]?.userId).toBe(u.id)
  })

  // T-0007-104: email null accepted
  it('T-0007-104: captureIntent with omitted email inserts row with NULL email', async () => {
    const u = userRow()
    await db.insert(users).values(u)
    const service = createOutOfScopeService(db)

    await service.captureIntent({
      userId: u.id!,
      capability: 'chat',
      promptHash: validHash,
      reason: 'wants conversational AI',
      email: null,
    })

    const rows = await db.select().from(outOfScopeIntent)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.email).toBeNull()
  })

  // T-0007-117: user_id is the authenticated user — from auth, never from input
  // (this is enforced at the route layer; service simply receives the correct userId)
  it('T-0007-117: inserted row user_id matches the userId passed to captureIntent', async () => {
    const u = userRow()
    await db.insert(users).values(u)
    const service = createOutOfScopeService(db)

    await service.captureIntent({
      userId: u.id!,
      capability: 'image_gen',
      promptHash: validHash,
      reason: 'generate art',
    })

    const rows = await db.select().from(outOfScopeIntent)
    expect(rows[0]?.userId).toBe(u.id)
  })

  // T-0007-118: server-managed columns (id, created_at) cannot be specified by client
  it('T-0007-118: id and created_at are server-managed — not exposed in captureIntent input', async () => {
    const u = userRow()
    await db.insert(users).values(u)
    const service = createOutOfScopeService(db)

    await service.captureIntent({
      userId: u.id!,
      capability: 'vision',
      promptHash: validHash,
      reason: 'test',
    })

    const rows = await db.select().from(outOfScopeIntent)
    // id is a UUID, createdAt is a Date — both auto-generated
    expect(rows[0]?.id).toBeDefined()
    expect(rows[0]?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
    expect(rows[0]?.createdAt).toBeInstanceOf(Date)
  })

  // T-0007-119: concurrent inserts produce distinct rows
  it('T-0007-119: two concurrent captureIntent calls produce distinct rows', async () => {
    const u = userRow()
    await db.insert(users).values(u)
    const service = createOutOfScopeService(db)

    const hashA = sha256Hex('prompt A')
    const hashB = sha256Hex('prompt B')

    await Promise.all([
      service.captureIntent({
        userId: u.id!,
        capability: 'vision',
        promptHash: hashA,
        reason: 'first request',
      }),
      service.captureIntent({
        userId: u.id!,
        capability: 'chat',
        promptHash: hashB,
        reason: 'second request',
      }),
    ])

    const rows = await db.select().from(outOfScopeIntent)
    expect(rows).toHaveLength(2)
    const ids = rows.map(r => r.id)
    expect(new Set(ids).size).toBe(2) // distinct IDs
  })

  // T-0007-122: EVAL_MODE='true' — telemetry validation runs, DB insert still happens
  it("T-0007-122: EVAL_MODE='true' does not prevent row insertion (eval mode only skips telemetry DB insert)", async () => {
    const original = process.env.PLAN_BUILD_EVAL_MODE
    process.env.PLAN_BUILD_EVAL_MODE = 'true'

    const u = userRow()
    await db.insert(users).values(u)
    const service = createOutOfScopeService(db)

    try {
      await service.captureIntent({
        userId: u.id!,
        capability: 'transcription',
        promptHash: validHash,
        reason: 'voice notes',
      })
    } finally {
      if (original === undefined) delete process.env.PLAN_BUILD_EVAL_MODE
      else process.env.PLAN_BUILD_EVAL_MODE = original
    }

    // Row was still inserted even in eval mode
    const rows = await db.select().from(outOfScopeIntent)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.capability).toBe('transcription')
  })

})

// ---------------------------------------------------------------------------
// T-0007-123: pure-logic test — no DB required.
// Verifies that the capability enum in outOfScopeTool.input_schema and the
// OutOfScopeInputSchema Zod schema are consistent with each other (and both
// include 'unknown', which DB CHECK also covers).
// ---------------------------------------------------------------------------

describe('outOfScope capability enum consistency (T-0007-123)', () => {
  // T-0007-123: capability enum in DB CHECK matches the closed enum in outOfScopeTool
  it('T-0007-123: capability enum in outOfScopeTool matches OutOfScopeInputSchema', () => {
    // Extract the capability enum from outOfScopeTool.input_schema
    const toolInputSchema = outOfScopeTool.input_schema as unknown as {
      properties: {
        capability: {enum: string[]}
      }
    }
    const toolCapabilities = toolInputSchema.properties.capability.enum

    // The service uses the same set; verify against OutOfScopeInputSchema
    const zodCapabilities = OutOfScopeInputSchema.shape.capability.options

    expect(toolCapabilities).toEqual(expect.arrayContaining(zodCapabilities))
    expect(zodCapabilities).toEqual(expect.arrayContaining(toolCapabilities))

    // And verify 'unknown' is present (DB CHECK includes it)
    expect(toolCapabilities).toContain('unknown')
    expect(zodCapabilities).toContain('unknown')
  })
})
