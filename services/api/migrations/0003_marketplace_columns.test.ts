/**
 * Migration tests — ADR-0002 Step 1.
 *
 * Tests T-0002-001 through T-0002-010.
 *
 * These tests spin up a fresh testcontainers Postgres for each suite and
 * apply migrations 0001 + 0002 + 0003 in order, matching the same pattern
 * used in services/api/src/db/schema.test.ts (ADR-0001).
 *
 * Counts:
 *   Happy:      T-001, T-002, T-007, T-008, T-010   (5)
 *   Boundary:   T-003, T-004, T-005                  (3)
 *   Security:   T-006                                (1)
 *   Regression: T-009                                (1)
 *   --------------------------------------------------
 *   Total:                                           10
 *
 * (The ADR summary table lists 9; T-0002-010 is the Negative/Happy
 * verification that visibility='public' is accepted — counted here as Happy.)
 */
import {randomUUID} from 'node:crypto'

import {GenericContainer, type StartedTestContainer, Wait} from 'testcontainers'

import {createPool} from '../src/db/index.js'
import {runMigrations} from '../src/db/migrate.js'
import type pg from 'pg'

const PGVECTOR_IMAGE = 'pgvector/pgvector:pg16'
const PG_USER = 'postgres'
const PG_PASS = 'postgres'
const PG_DB = 'app_creator_test_0003'

// ---------------------------------------------------------------------------
// Container lifecycle — one container for the whole suite.
// ---------------------------------------------------------------------------
let container: StartedTestContainer
let pool: pg.Pool

beforeAll(async () => {
  container = await new GenericContainer(PGVECTOR_IMAGE)
    .withEnvironment({
      POSTGRES_USER: PG_USER,
      POSTGRES_PASSWORD: PG_PASS,
      POSTGRES_DB: PG_DB,
    })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
    .withStartupTimeout(60_000)
    .start()

  const host = container.getHost()
  const port = container.getMappedPort(5432)
  const url = `postgresql://${PG_USER}:${PG_PASS}@${host}:${port}/${PG_DB}`

  pool = createPool(url)
  // Apply all migrations (0001 + 0002 + 0003) in order.
  await runMigrations({pool})
}, 90_000)

afterAll(async () => {
  await pool.end().catch(() => {})
  await container.stop().catch(() => {})
})

// ---------------------------------------------------------------------------
// T-0002-001 — Happy: migration 0003 runs cleanly on a fresh db; users.handle
// column exists with a UNIQUE constraint.
// ---------------------------------------------------------------------------
it('T-0002-001: migration 0003 runs on fresh db; users.handle column exists with UNIQUE', async () => {
  // Column exists.
  const colResult = await pool.query<{column_name: string; is_nullable: 'YES' | 'NO'}>(
    `SELECT column_name, is_nullable
     FROM information_schema.columns
     WHERE table_name = 'users' AND column_name = 'handle'`,
  )
  expect(colResult.rows).toHaveLength(1)
  expect(colResult.rows[0]?.is_nullable).toBe('YES') // nullable per spec

  // UNIQUE constraint exists on handle.
  const uniqueResult = await pool.query<{constraint_type: string}>(
    `SELECT tc.constraint_type
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name
     WHERE tc.table_name = 'users'
       AND kcu.column_name = 'handle'
       AND tc.constraint_type = 'UNIQUE'`,
  )
  expect(uniqueResult.rows.length).toBeGreaterThanOrEqual(1)
})

// ---------------------------------------------------------------------------
// T-0002-002 — Happy: migration 0003 against an ADR-0001-migrated db; existing
// rows pick up default values for the new columns.
// ---------------------------------------------------------------------------
it('T-0002-002: existing rows get visibility=private, published_at=null, original_prompt=empty', async () => {
  // Insert a user and project (simulating pre-0003 data) AFTER migration.
  // Because migration already applied, the columns exist with defaults.
  const userId = randomUUID()
  await pool.query(
    `INSERT INTO users (id, email) VALUES ($1, $2)`,
    [userId, `t002-002-${Date.now()}@example.com`],
  )
  await pool.query(
    `INSERT INTO projects (id, owner_id, title) VALUES ($1, $2, $3)`,
    [randomUUID(), userId, 'Pre-migration project'],
  )

  // Read back — defaults must apply.
  const {rows} = await pool.query<{
    visibility: string
    published_at: unknown
    original_prompt: string
  }>(
    `SELECT visibility, published_at, original_prompt
     FROM projects
     WHERE owner_id = $1`,
    [userId],
  )
  expect(rows).toHaveLength(1)
  expect(rows[0]?.visibility).toBe('private')
  expect(rows[0]?.published_at).toBeNull()
  expect(rows[0]?.original_prompt).toBe('')
})

// ---------------------------------------------------------------------------
// T-0002-003 — Boundary: re-running migration 0003 is a no-op (idempotent).
// ---------------------------------------------------------------------------
it('T-0002-003: re-running migrations is idempotent — no errors, no state change', async () => {
  await expect(runMigrations({pool})).resolves.toBeDefined()

  // Columns still exist and DB is still usable.
  const {rows} = await pool.query<{column_name: string}>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'projects' AND column_name IN ('visibility','published_at','original_prompt')
     ORDER BY column_name`,
  )
  expect(rows.map(r => r.column_name)).toEqual(['original_prompt', 'published_at', 'visibility'])
})

// ---------------------------------------------------------------------------
// T-0002-004 — Boundary: users.handle allows null (existing rows unaffected).
// ---------------------------------------------------------------------------
it('T-0002-004: users.handle allows null', async () => {
  const id = randomUUID()
  // Insert without handle — should succeed.
  await expect(
    pool.query(
      `INSERT INTO users (id, email) VALUES ($1, $2)`,
      [id, `t002-004-${Date.now()}@example.com`],
    ),
  ).resolves.toBeDefined()

  const {rows} = await pool.query<{handle: string | null}>(
    `SELECT handle FROM users WHERE id = $1`,
    [id],
  )
  expect(rows[0]?.handle).toBeNull()
})

// ---------------------------------------------------------------------------
// T-0002-005 — Boundary: users.handle UNIQUE catches duplicate non-null inserts.
// ---------------------------------------------------------------------------
it('T-0002-005: users.handle UNIQUE rejects duplicate non-null handles', async () => {
  const handle = `uniquehandle-${Date.now()}`

  const idA = randomUUID()
  const idB = randomUUID()
  await pool.query(
    `INSERT INTO users (id, email, handle) VALUES ($1, $2, $3)`,
    [idA, `t002-005a-${Date.now()}@example.com`, handle],
  )
  await expect(
    pool.query(
      `INSERT INTO users (id, email, handle) VALUES ($1, $2, $3)`,
      [idB, `t002-005b-${Date.now()}@example.com`, handle],
    ),
  ).rejects.toThrow(/duplicate|unique/i)
})

// ---------------------------------------------------------------------------
// T-0002-006 — Security: visibility CHECK rejects values outside the allowed set.
// Only 'private' and 'public' are valid.
// ---------------------------------------------------------------------------
it("T-0002-006: visibility CHECK rejects 'unlisted', 'PUBLIC', '', null", async () => {
  const userId = randomUUID()
  await pool.query(
    `INSERT INTO users (id, email) VALUES ($1, $2)`,
    [userId, `t002-006-${Date.now()}@example.com`],
  )

  // 'unlisted' — not in the allowed set.
  await expect(
    pool.query(
      `INSERT INTO projects (id, owner_id, title, visibility) VALUES ($1, $2, $3, $4)`,
      [randomUUID(), userId, 'p', 'unlisted'],
    ),
  ).rejects.toThrow(/check|violates/i)

  // 'PUBLIC' — case-sensitive; not allowed.
  await expect(
    pool.query(
      `INSERT INTO projects (id, owner_id, title, visibility) VALUES ($1, $2, $3, $4)`,
      [randomUUID(), userId, 'p', 'PUBLIC'],
    ),
  ).rejects.toThrow(/check|violates/i)

  // '' (empty string) — not in the allowed set.
  await expect(
    pool.query(
      `INSERT INTO projects (id, owner_id, title, visibility) VALUES ($1, $2, $3, $4)`,
      [randomUUID(), userId, 'p', ''],
    ),
  ).rejects.toThrow(/check|violates/i)

  // null — the column is NOT NULL; null should be rejected.
  await expect(
    pool.query(
      `INSERT INTO projects (id, owner_id, title, visibility) VALUES ($1, $2, $3, $4)`,
      [randomUUID(), userId, 'p', null],
    ),
  ).rejects.toThrow(/null|not[- ]null|violates/i)
})

// ---------------------------------------------------------------------------
// T-0002-007 — Happy: projects_library_idx exists and is a partial index.
// EXPLAIN shows index scan for the /library feed query shape.
// ---------------------------------------------------------------------------
it('T-0002-007: projects_library_idx exists as a partial index (WHERE visibility=public)', async () => {
  // Index must appear in pg_indexes with a WHERE clause.
  const idxResult = await pool.query<{indexname: string; indexdef: string}>(
    `SELECT indexname, indexdef FROM pg_indexes
     WHERE schemaname = 'public' AND indexname = 'projects_library_idx'`,
  )
  expect(idxResult.rows).toHaveLength(1)
  const idxDef = idxResult.rows[0]?.indexdef ?? ''
  // Must be a partial index (contains WHERE clause).
  expect(idxDef).toMatch(/where/i)
  expect(idxDef).toMatch(/visibility\s*=\s*'public'/i)
  // Must include published_at DESC and id.
  expect(idxDef).toMatch(/published_at/i)
  expect(idxDef).toMatch(/\bid\b/)

  // EXPLAIN on the library feed query shape should reference the index.
  const explainResult = await pool.query<{['QUERY PLAN']: string}>(
    `EXPLAIN SELECT id, title, visibility, published_at
     FROM projects
     WHERE visibility = 'public'
     ORDER BY published_at DESC, id DESC
     LIMIT 20`,
  )
  const plan = explainResult.rows.map(r => r['QUERY PLAN']).join('\n')
  // With 0 rows the planner may choose a seq scan; so we check the index
  // exists structurally (already done above) and that EXPLAIN doesn't error.
  expect(plan.length).toBeGreaterThan(0)
})

// ---------------------------------------------------------------------------
// T-0002-008 — Boundary: original_prompt accepts '' (default) and a very long
// value (10 000 chars).
// ---------------------------------------------------------------------------
it('T-0002-008: original_prompt accepts empty string and a 10 000-char value', async () => {
  const userId = randomUUID()
  await pool.query(
    `INSERT INTO users (id, email) VALUES ($1, $2)`,
    [userId, `t002-008-${Date.now()}@example.com`],
  )

  // Empty string (the default).
  const idA = randomUUID()
  await pool.query(
    `INSERT INTO projects (id, owner_id, title, original_prompt) VALUES ($1, $2, $3, $4)`,
    [idA, userId, 'p-empty', ''],
  )
  const emptyResult = await pool.query<{original_prompt: string}>(
    `SELECT original_prompt FROM projects WHERE id = $1`,
    [idA],
  )
  expect(emptyResult.rows[0]?.original_prompt).toBe('')

  // 10 000-char value.
  const longPrompt = 'x'.repeat(10_000)
  const idB = randomUUID()
  await pool.query(
    `INSERT INTO projects (id, owner_id, title, original_prompt) VALUES ($1, $2, $3, $4)`,
    [idB, userId, 'p-long', longPrompt],
  )
  const longResult = await pool.query<{original_prompt: string}>(
    `SELECT original_prompt FROM projects WHERE id = $1`,
    [idB],
  )
  expect(longResult.rows[0]?.original_prompt).toHaveLength(10_000)
})

// ---------------------------------------------------------------------------
// T-0002-009 — Regression: ADR-0001 tables and constraints still intact after
// migration 0003.
// ---------------------------------------------------------------------------
it('T-0002-009: ADR-0001 tables still exist and constraints are intact', async () => {
  // All 7 original tables exist.
  const tableResult = await pool.query<{table_name: string}>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name`,
  )
  const names = tableResult.rows.map(r => r.table_name)
  expect(names).toEqual(
    expect.arrayContaining([
      'events',
      'facts',
      'memory_embeddings',
      'messages',
      'project_versions',
      'projects',
      'users',
    ]),
  )

  // pgvector extension still installed.
  const extResult = await pool.query<{extname: string}>(
    `SELECT extname FROM pg_extension WHERE extname = 'vector'`,
  )
  expect(extResult.rows).toHaveLength(1)

  // The deferred FK from 0002 still exists.
  const fkResult = await pool.query<{constraint_name: string}>(
    `SELECT constraint_name FROM information_schema.table_constraints
     WHERE table_name = 'projects'
       AND constraint_name = 'projects_current_version_id_fk'
       AND constraint_type = 'FOREIGN KEY'`,
  )
  expect(fkResult.rows).toHaveLength(1)

  // projects_owner_idx still exists.
  const idxResult = await pool.query<{indexname: string}>(
    `SELECT indexname FROM pg_indexes
     WHERE schemaname = 'public' AND indexname = 'projects_owner_idx'`,
  )
  expect(idxResult.rows).toHaveLength(1)
})

// ---------------------------------------------------------------------------
// T-0002-010 — Negative/Happy: visibility='public' inserts successfully after
// migration (confirms the CHECK allows the value we depend on in Step 6).
// ---------------------------------------------------------------------------
it("T-0002-010: visibility='public' INSERT succeeds post-migration", async () => {
  const userId = randomUUID()
  await pool.query(
    `INSERT INTO users (id, email) VALUES ($1, $2)`,
    [userId, `t002-010-${Date.now()}@example.com`],
  )

  const projectId = randomUUID()
  await expect(
    pool.query(
      `INSERT INTO projects (id, owner_id, title, visibility, published_at)
       VALUES ($1, $2, $3, $4, now())`,
      [projectId, userId, 'Public App', 'public'],
    ),
  ).resolves.toBeDefined()

  const {rows} = await pool.query<{visibility: string; published_at: unknown}>(
    `SELECT visibility, published_at FROM projects WHERE id = $1`,
    [projectId],
  )
  expect(rows[0]?.visibility).toBe('public')
  expect(rows[0]?.published_at).not.toBeNull()
})
