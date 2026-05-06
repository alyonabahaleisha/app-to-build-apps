/**
 * Migration tests — ADR-0004 Step 4.
 *
 * Tests T-0004-054 through T-0004-056.
 *
 * These tests spin up a fresh testcontainers Postgres for each suite and
 * apply migrations in order, matching the same pattern used in
 * services/api/migrations/0003_marketplace_columns.test.ts.
 *
 * NOTE: Docker is required to run these tests. In environments without a
 * container runtime (e.g., this dev machine), the tests will fail with
 * "Could not find a working container runtime strategy". This is expected.
 * CI runs these in a Docker-capable environment. Do NOT skip or mark pending.
 *
 * Counts:
 *   Happy:    T-0004-054, T-0004-055   (2)
 *   Boundary: T-0004-056               (1)
 *   ------------------------------------------
 *   Total:                             3
 */
import {randomUUID} from 'node:crypto'

import {GenericContainer, type StartedTestContainer, Wait} from 'testcontainers'

import {createPool} from '../src/db/index.js'
import {runMigrations} from '../src/db/migrate.js'
import type pg from 'pg'

const PGVECTOR_IMAGE = 'pgvector/pgvector:pg16'
const PG_USER = 'postgres'
const PG_PASS = 'postgres'
const PG_DB = 'app_creator_test_0005'

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
  // Apply all migrations (0001 through 0005) in order.
  await runMigrations({pool})
}, 90_000)

afterAll(async () => {
  await pool.end().catch(() => {})
  await container.stop().catch(() => {})
})

// ---------------------------------------------------------------------------
// T-0004-054 — Happy: fresh DB → run all migrations → plan_json jsonb column
// exists on project_versions and is nullable.
// ---------------------------------------------------------------------------
it('T-0004-054: migration 0005 runs on a fresh DB; project_versions.plan_json is a nullable jsonb column', async () => {
  const colResult = await pool.query<{
    column_name: string
    data_type: string
    is_nullable: 'YES' | 'NO'
  }>(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_name = 'project_versions' AND column_name = 'plan_json'`,
  )
  expect(colResult.rows).toHaveLength(1)
  expect(colResult.rows[0]?.data_type).toBe('jsonb')
  // Nullable — plan_json IS NULL is the load-bearing signal for M1 fallback
  // rows (ADR-0004 §G). Must NOT be NOT NULL.
  expect(colResult.rows[0]?.is_nullable).toBe('YES')
})

// ---------------------------------------------------------------------------
// T-0004-055 — Happy: after migration 0005 has run, new project_versions rows
// default plan_json to NULL (no explicit value required on INSERT).
// ---------------------------------------------------------------------------
it('T-0004-055: new project_versions rows default plan_json to NULL after migration', async () => {
  // Insert a user + project + version to simulate pre-migration data.
  const userId = randomUUID()
  const projectId = randomUUID()
  const versionId = randomUUID()

  await pool.query(`INSERT INTO users (id, email) VALUES ($1, $2)`, [
    userId,
    `t0004-055-${Date.now()}@example.com`,
  ])
  await pool.query(`INSERT INTO projects (id, owner_id, title) VALUES ($1, $2, $3)`, [
    projectId,
    userId,
    'Pre-0005 project',
  ])
  await pool.query(
    `INSERT INTO project_versions (id, project_id, spec_json, render_hash)
     VALUES ($1, $2, $3::jsonb, $4)`,
    [versionId, projectId, JSON.stringify({version: 1}), 'aabbcc'],
  )

  // Migration is already applied in beforeAll. Verify that a row inserted
  // without an explicit plan_json value gets NULL (the column default).
  const {rows} = await pool.query<{id: string; plan_json: unknown}>(
    `SELECT id, plan_json FROM project_versions WHERE id = $1`,
    [versionId],
  )
  expect(rows).toHaveLength(1)
  // Row must exist.
  expect(rows[0]?.id).toBe(versionId)
  // plan_json must be NULL — column default, no backfill applied.
  expect(rows[0]?.plan_json).toBeNull()
})

// ---------------------------------------------------------------------------
// T-0004-056 — Boundary: running migration 0005 twice is a no-op (ADD COLUMN
// IF NOT EXISTS). No error; column unchanged.
// ---------------------------------------------------------------------------
it('T-0004-056: re-running migration 0005 is a no-op — no error, column unchanged', async () => {
  // runMigrations applies all .sql files including 0005 again.
  await expect(runMigrations({pool})).resolves.toBeDefined()

  // Column is still a nullable jsonb — no doubling, no type change.
  const colResult = await pool.query<{
    column_name: string
    data_type: string
    is_nullable: 'YES' | 'NO'
  }>(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_name = 'project_versions' AND column_name = 'plan_json'`,
  )
  expect(colResult.rows).toHaveLength(1)
  expect(colResult.rows[0]?.data_type).toBe('jsonb')
  expect(colResult.rows[0]?.is_nullable).toBe('YES')
})
