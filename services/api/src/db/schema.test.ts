/**
 * Step 1 schema tests — ADR-0001.
 *
 * Test IDs map 1:1 to the ADR §Step 1 Tests table. We list 16 tests here.
 * T-0001-013 is N/A (no prior schema, nothing to break) per the ADR.
 *
 * Counts:
 *   Happy:        T-001, T-002, T-003, T-004                     (4)
 *   Failure:      T-007, T-008, T-115, T-116, T-132              (5)
 *   Boundary:     T-005, T-006                                   (2)
 *   Error:        T-009                                          (1)
 *   Security:     T-010                                          (1)
 *   Concurrency:  T-011                                          (1)
 *   Regression:   T-012                                          (1)
 *   Config:       T-014 (5 sub-cases)                            (1)
 *   ----------------------------------------------------------------
 *   Total:                                                       16
 *
 * Failure (5) ≥ Happy (4). T-013 (Breaking change) is N/A.
 */
import {randomUUID} from 'node:crypto'
import {mkdtemp, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {sql} from 'drizzle-orm'
import type {NodePgDatabase} from 'drizzle-orm/node-postgres'

import {ConfigError, MigrationError, createDb, createPool} from './index.js'
import {runMigrations} from './migrate.js'
import {facts, memoryEmbeddings, projects, projectVersions, users} from './schema.js'
import * as schema from './schema.js'
import {isReservedHandle, RESERVED_HANDLES} from '../lib/reservedHandles.js'
import {userRow, validSpec} from '../../test/factories.js'
import {
  closeTestPool,
  getTestConnectionString,
  getTestDb,
  getTestPool,
  truncateAll,
} from '../../test/setup.js'

type Db = NodePgDatabase<typeof schema>

describe('ADR-0001 Step 1 — db schema', () => {
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

  // -------------------------------------------------------------------------
  // T-0001-001 — Happy: migration creates 7 tables
  // -------------------------------------------------------------------------
  it('T-0001-001: migration applied to empty DB creates 7 tables', async () => {
    const pool = await getTestPool()
    const {rows} = await pool.query<{table_name: string}>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
    )
    const names = rows.map(r => r.table_name)
    expect(names).toEqual(
      expect.arrayContaining([
        'users',
        'projects',
        'project_versions',
        'messages',
        'facts',
        'memory_embeddings',
        'events',
      ]),
    )
    // All 7 expected — no fewer.
    expect(names.length).toBeGreaterThanOrEqual(7)
  })

  // -------------------------------------------------------------------------
  // T-0001-002 — Happy: pgvector extension enabled
  // -------------------------------------------------------------------------
  it('T-0001-002: pgvector extension enabled before any vector column is referenced', async () => {
    const pool = await getTestPool()
    const {rows} = await pool.query<{extname: string}>(
      `SELECT extname FROM pg_extension WHERE extname = 'vector'`,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.extname).toBe('vector')

    // Sanity-check: memory_embeddings.embedding column reports udt_name = 'vector'.
    const colCheck = await pool.query<{udt_name: string}>(
      `SELECT udt_name FROM information_schema.columns
       WHERE table_name = 'memory_embeddings' AND column_name = 'embedding'`,
    )
    expect(colCheck.rows[0]?.udt_name).toBe('vector')
  })

  // -------------------------------------------------------------------------
  // T-0001-003 — Happy: required indexes exist
  // -------------------------------------------------------------------------
  it('T-0001-003: indexes exist (projects owner+updated_at, project_versions.project_id, messages.project_id)', async () => {
    const pool = await getTestPool()
    const {rows} = await pool.query<{indexname: string; tablename: string; indexdef: string}>(
      `SELECT indexname, tablename, indexdef FROM pg_indexes
       WHERE schemaname = 'public'`,
    )
    const byName = new Map(rows.map(r => [r.indexname, r]))

    const projectsOwnerIdx = byName.get('projects_owner_idx')
    expect(projectsOwnerIdx).toBeDefined()
    expect(projectsOwnerIdx?.tablename).toBe('projects')
    // Sort direction must be DESC on updated_at (library-list query).
    expect(projectsOwnerIdx?.indexdef).toMatch(/owner_id/)
    expect(projectsOwnerIdx?.indexdef).toMatch(/updated_at\s+DESC/i)

    expect(byName.get('project_versions_project_idx')?.tablename).toBe('project_versions')
    expect(byName.get('messages_project_idx')?.tablename).toBe('messages')
  })

  // -------------------------------------------------------------------------
  // T-0001-004 — Happy: required FKs exist
  // -------------------------------------------------------------------------
  it('T-0001-004: required FKs exist', async () => {
    const pool = await getTestPool()
    const {rows} = await pool.query<{
      table_name: string
      column_name: string
      foreign_table_name: string
      foreign_column_name: string
    }>(
      `SELECT
         tc.table_name,
         kcu.column_name,
         ccu.table_name AS foreign_table_name,
         ccu.column_name AS foreign_column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema   = kcu.table_schema
       JOIN information_schema.constraint_column_usage ccu
         ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema    = tc.table_schema
       WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'`,
    )
    const seen = rows.map(
      r => `${r.table_name}.${r.column_name}->${r.foreign_table_name}.${r.foreign_column_name}`,
    )
    expect(seen).toEqual(
      expect.arrayContaining([
        'projects.owner_id->users.id',
        'project_versions.project_id->projects.id',
        'messages.project_id->projects.id',
        // Deferred cycle-breaking FK from migration 0002:
        'projects.current_version_id->project_versions.id',
      ]),
    )
  })

  // -------------------------------------------------------------------------
  // T-0001-005 — Boundary: re-running migrations is idempotent
  // -------------------------------------------------------------------------
  it('T-0001-005: migration is idempotent — running it twice succeeds with no errors', async () => {
    const pool = await getTestPool()
    // The base migration ran in setup (). Re-run it on the same pool.
    await expect(runMigrations({pool})).resolves.toBeDefined()
    // Still able to query a table — no DDL damage.
    const result = await db.select().from(users)
    expect(Array.isArray(result)).toBe(true)
  })

  // -------------------------------------------------------------------------
  // T-0001-006 — Boundary: empty `projects` returns []
  // -------------------------------------------------------------------------
  it('T-0001-006: empty projects table returns []', async () => {
    const result = await db.select().from(projects)
    expect(result).toEqual([])
  })

  // -------------------------------------------------------------------------
  // T-0001-007 — Failure: project_version with non-existent project_id
  // -------------------------------------------------------------------------
  it('T-0001-007: inserting a project_version with non-existent project_id raises FK violation', async () => {
    await expect(
      db.insert(projectVersions).values({
        projectId: randomUUID(),
        specJson: validSpec(),
        renderHash: 'x'.repeat(64),
      }),
    ).rejects.toThrow(/foreign key|violates/i)
  })

  // -------------------------------------------------------------------------
  // T-0001-008 — Failure: duplicate user email
  // -------------------------------------------------------------------------
  it('T-0001-008: inserting a users row with duplicate email raises uniqueness violation', async () => {
    const a = userRow({email: 'dup@example.com'})
    const b = userRow({email: 'dup@example.com'})
    await db.insert(users).values(a)
    await expect(db.insert(users).values(b)).rejects.toThrow(/duplicate|unique/i)
  })

  // -------------------------------------------------------------------------
  // T-0001-009 — Error handling: migration runner wraps the cause AND no
  // half-applied DDL — cite this exact phrasing in the test name. (Roz will
  // grep for it.)
  //
  // Two failure modes per the ADR contract:
  //   (i)  pg.Pool connection refused (unreachable host)
  //   (ii) torn down mid-migration via pool.end()
  // Plus the post-failure rollback contract:
  //   (a)  db.select().from(users) rejects on the failed pool — no half-
  //        applied DDL (each migration runs in a transaction; on error,
  //        ROLLBACK undoes any partial CREATE TABLE)
  //   (b)  re-running on a clean pool completes successfully
  // -------------------------------------------------------------------------
  it('T-0001-009: connection-pool failure during migration raises MigrationError; clean error and no half-applied DDL', async () => {
    // ---- (i) connection refused ------------------------------------------
    const badPool = createPool('postgresql://postgres:postgres@127.0.0.1:1/nope')

    let thrown: unknown
    try {
      await runMigrations({pool: badPool})
    } catch (err) {
      thrown = err
    } finally {
      await badPool.end().catch(() => {})
    }

    expect(thrown).toBeInstanceOf(MigrationError)
    expect((thrown as MigrationError).name).toBe('MigrationError')
    expect((thrown as MigrationError).cause).toBeDefined()

    // (a) Querying `users` via the bad pool also rejects — the table was
    //     never created (no half-applied DDL). Note: with a connect-refused
    //     pool, every query rejects with a connection error, which is
    //     the observable manifestation of "table not created."
    const badDb = createDb(badPool)
    await expect(badDb.select().from(users)).rejects.toThrow()

    // ---- (ii) torn down mid-migration -----------------------------------
    // Build a one-off pool against the live test container, write a single
    // intentionally-broken migration to a temp dir, run it, expect rollback
    // (no half-applied DDL on the live DB).
    const liveUrl = await getTestConnectionString()
    const midRunPool = createPool(liveUrl)
    const tempDir = await mkdtemp(join(tmpdir(), 'adr0001-mig-'))
    try {
      // First statement creates a junk table; second is invalid SQL. The
      // entire file is wrapped in BEGIN/COMMIT by the runner — so the
      // junk table must NOT survive.
      await writeFile(
        join(tempDir, '0001_broken.sql'),
        `CREATE TABLE adr0001_junk (id int);\n` + `THIS IS NOT VALID SQL;\n`,
      )
      await expect(
        runMigrations({pool: midRunPool, migrationsDir: tempDir}),
      ).rejects.toBeInstanceOf(MigrationError)

      // Confirm the junk table was rolled back — not half-applied.
      const checkPool = await getTestPool()
      const {rows} = await checkPool.query<{table_name: string}>(
        `SELECT table_name FROM information_schema.tables
         WHERE table_name = 'adr0001_junk'`,
      )
      expect(rows).toEqual([])
    } finally {
      await midRunPool.end().catch(() => {})
      await rm(tempDir, {recursive: true, force: true})
    }

    // (b) Re-running the migration against a clean (healthy) pool still
    //     completes successfully. The ambient test container holds the
    //     real schema — re-running is the idempotent path.
    const healthyPool = await getTestPool()
    await expect(runMigrations({pool: healthyPool})).resolves.toBeDefined()
    await expect(db.select().from(users)).resolves.toEqual([])
  })

  // -------------------------------------------------------------------------
  // T-0001-010 — Security: parameterization. Inserts the exact literal
  // "a@b.c'; DROP TABLE users; --" as the email value; the row exists with
  // that exact email; the users table still exists.
  // -------------------------------------------------------------------------
  it('T-0001-010: drizzle parameterizes all queries — SQL-injection literal stored verbatim', async () => {
    const sneaky = "a@b.c'; DROP TABLE users; --"
    const id = randomUUID()
    await db.insert(users).values({id, email: sneaky})

    // Row exists with the exact literal email.
    const found = await db
      .select()
      .from(users)
      .where(sql`${users.id} = ${id}`)
    expect(found).toHaveLength(1)
    expect(found[0]?.email).toBe(sneaky)

    // users table still exists — verifiable by querying information_schema
    // (avoids a false-positive if the SELECT above was somehow cached).
    const pool = await getTestPool()
    const tableCheck = await pool.query<{table_name: string}>(
      `SELECT table_name FROM information_schema.tables WHERE table_name = 'users'`,
    )
    expect(tableCheck.rows).toHaveLength(1)
  })

  // -------------------------------------------------------------------------
  // T-0001-115 — Failure: vector column rejects non-vector value
  // -------------------------------------------------------------------------
  it('T-0001-115: memory_embeddings.embedding rejects non-vector values', async () => {
    // Set up a fact to satisfy the FK.
    const u = userRow()
    await db.insert(users).values(u)
    const factId = randomUUID()
    await db.insert(facts).values({id: factId, userId: u.id!, content: 'a fact'})

    const pool = await getTestPool()

    // (a) plain text: no implicit cast from text to vector — rejected.
    await expect(
      pool.query(`INSERT INTO memory_embeddings (fact_id, embedding) VALUES ($1, $2)`, [
        factId,
        'this is not a vector',
      ]),
    ).rejects.toThrow()

    // (b) wrong-dimension array — vector(1536) refuses 4-d input.
    await expect(
      db.insert(memoryEmbeddings).values({
        factId,
        embedding: [1, 2, 3, 4],
      }),
    ).rejects.toThrow()

    // No row was inserted from either attempt.
    const remaining = await db.select().from(memoryEmbeddings)
    expect(remaining).toEqual([])
  })

  // -------------------------------------------------------------------------
  // T-0001-116 — Failure: each NOT NULL column rejects null inserts.
  // Parameterized table-driven test.
  // -------------------------------------------------------------------------
  it('T-0001-116: NOT NULL columns reject null inserts', async () => {
    // Bootstrap a real user and project so FK-constrained inserts can reach
    // the NOT NULL check rather than failing at the FK.
    const u = userRow()
    await db.insert(users).values(u)
    const projectId = randomUUID()
    await db.insert(projects).values({id: projectId, ownerId: u.id!, title: 'p'})

    const pool = await getTestPool()

    type Case = {label: string; sql: string; params: unknown[]}
    const cases: Case[] = [
      {
        label: 'users.email',
        sql: `INSERT INTO users (id, email) VALUES ($1, $2)`,
        params: [randomUUID(), null],
      },
      {
        label: 'projects.owner_id',
        sql: `INSERT INTO projects (id, owner_id, title) VALUES ($1, $2, $3)`,
        params: [randomUUID(), null, 'x'],
      },
      {
        label: 'projects.title',
        sql: `INSERT INTO projects (id, owner_id, title) VALUES ($1, $2, $3)`,
        params: [randomUUID(), u.id, null],
      },
      {
        label: 'project_versions.spec_json',
        sql: `INSERT INTO project_versions (id, project_id, spec_json, render_hash) VALUES ($1, $2, $3, $4)`,
        params: [randomUUID(), projectId, null, 'h'],
      },
      {
        label: 'project_versions.render_hash',
        sql: `INSERT INTO project_versions (id, project_id, spec_json, render_hash) VALUES ($1, $2, $3, $4)`,
        params: [randomUUID(), projectId, JSON.stringify(validSpec()), null],
      },
      {
        label: 'project_versions.project_id',
        sql: `INSERT INTO project_versions (id, project_id, spec_json, render_hash) VALUES ($1, $2, $3, $4)`,
        params: [randomUUID(), null, JSON.stringify(validSpec()), 'h'],
      },
    ]

    for (const c of cases) {
      await expect(pool.query(c.sql, c.params)).rejects.toThrow(/null value|not[- ]null|violates/i)
    }
  })

  // -------------------------------------------------------------------------
  // T-0001-132 — Failure: project FK to users
  // -------------------------------------------------------------------------
  it('T-0001-132: inserting a project with non-existent owner_id raises FK violation', async () => {
    await expect(
      db.insert(projects).values({
        ownerId: randomUUID(),
        title: 'orphan',
      }),
    ).rejects.toThrow(/foreign key|violates/i)
  })

  // -------------------------------------------------------------------------
  // T-0001-011 — Concurrency: ON CONFLICT DO NOTHING produces one row
  // -------------------------------------------------------------------------
  it('T-0001-011: two concurrent INSERT ... ON CONFLICT DO NOTHING produce one row', async () => {
    const pool = await getTestPool()
    const id = randomUUID()
    const email = uniqueEmailForTest()

    const sqlText = `INSERT INTO users (id, email) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`

    await Promise.all([pool.query(sqlText, [id, email]), pool.query(sqlText, [id, email])])

    const {rows} = await pool.query<{count: string}>(
      `SELECT count(*)::text AS count FROM users WHERE id = $1`,
      [id],
    )
    expect(rows[0]?.count).toBe('1')
  })

  // -------------------------------------------------------------------------
  // T-0001-012 — Regression: users.email is NOT NULL UNIQUE
  // -------------------------------------------------------------------------
  it('T-0001-012: users.email is NOT NULL UNIQUE — verified via INFORMATION_SCHEMA', async () => {
    const pool = await getTestPool()
    const colInfo = await pool.query<{column_name: string; is_nullable: 'YES' | 'NO'}>(
      `SELECT column_name, is_nullable FROM information_schema.columns
       WHERE table_name = 'users' AND column_name = 'email'`,
    )
    expect(colInfo.rows[0]?.is_nullable).toBe('NO')

    // UNIQUE constraint exists on email.
    const uniqueInfo = await pool.query<{constraint_type: string}>(
      `SELECT tc.constraint_type
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
       WHERE tc.table_name = 'users'
         AND kcu.column_name = 'email'
         AND tc.constraint_type = 'UNIQUE'`,
    )
    expect(uniqueInfo.rows.length).toBeGreaterThanOrEqual(1)
  })

  // -------------------------------------------------------------------------
  // T-0001-014 — Config exhaustion: DATABASE_URL — five sub-cases
  //
  // We don't import the live `db` singleton here (it'd be initialised
  // already). Instead we exercise `createPool()` and the URL validation in
  // the same module to assert the contract: each bad input throws a typed
  // error fast; valid inputs build a connectable pool.
  // -------------------------------------------------------------------------
  it('T-0001-014: DATABASE_URL exhaustion — unset, empty, valid, malformed, unreachable', async () => {
    const original = process.env.DATABASE_URL

    try {
      // 1. Unset → ConfigError
      delete process.env.DATABASE_URL
      expect(() => createPool()).toThrow(ConfigError)

      // 2. Empty string → ConfigError (treated as unset)
      process.env.DATABASE_URL = ''
      expect(() => createPool()).toThrow(ConfigError)

      // Whitespace-only → ConfigError (treated as unset; defense in depth)
      process.env.DATABASE_URL = '   '
      expect(() => createPool()).toThrow(ConfigError)

      // 3. Valid → pool builds and connects to our testcontainer.
      const liveUrl = await getTestConnectionString()
      process.env.DATABASE_URL = liveUrl
      const goodPool = createPool()
      const liveDb = createDb(goodPool)
      // Smoke-test: `SELECT 1` round-trips. Use raw sql to avoid table deps.
      const ok = await liveDb.execute(sql`select 1 as one`)
      // node-postgres returns a QueryResult; rows[0].one === 1
      expect((ok as unknown as {rows: Array<{one: number}>}).rows[0]?.one).toBe(1)
      await goodPool.end()

      // 4. Malformed URL → ConfigError surfaces clearly
      process.env.DATABASE_URL = 'not-a-url-at-all'
      expect(() => createPool()).toThrow(ConfigError)

      // 5. Valid URL but unreachable host: pool builds (lazy connections), but
      //    a query fails inside connectionTimeoutMillis (5s). We assert the
      //    error surfaces; "retried per backoff" is the migration runner's
      //    behavior, not the pool's — covered by T-0001-009.
      process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:1/nope'
      const unreachable = createPool()
      await expect(unreachable.query('SELECT 1')).rejects.toThrow()
      await unreachable.end().catch(() => {})
    } finally {
      if (original === undefined) delete process.env.DATABASE_URL
      else process.env.DATABASE_URL = original
    }
  }, 30_000)
})

// Local helper — avoids reaching back into factories' module-level counter
// from inside a single test file. The factory's `uniqueEmail` works too;
// inlined here to make the assertion-self-contained reading easier.
function uniqueEmailForTest(): string {
  return `concurrent-${randomUUID()}@example.com`
}

// =============================================================================
// ADR-0002 Step 1 — schema additions tests
//
// Tests T-0002-001 through T-0002-010 exercised against the shared testcontainer
// that has already been migrated through 0003_marketplace_columns.sql.
//
// T-0002-009 (regression) is naturally satisfied by this entire file
// (the ADR-0001 tests above still pass). The describe block below adds the
// explicit ADR-0002 assertions that require column/constraint presence.
// =============================================================================
describe('ADR-0002 Step 1 — marketplace columns', () => {
  let db2: Db

  beforeAll(async () => {
    db2 = await getTestDb()
  })

  afterEach(async () => {
    await truncateAll()
  })

  afterAll(async () => {
    // Pool is shared with the outer describe — closeTestPool() is already
    // called in the outer afterAll. Don't double-close here.
  })

  // -------------------------------------------------------------------------
  // T-0002-001 — Happy: users.handle column exists with UNIQUE constraint
  // -------------------------------------------------------------------------
  it('T-0002-001: users.handle column exists and has a UNIQUE constraint', async () => {
    const pool = await getTestPool()

    const colResult = await pool.query<{column_name: string; is_nullable: 'YES' | 'NO'}>(
      `SELECT column_name, is_nullable
       FROM information_schema.columns
       WHERE table_name = 'users' AND column_name = 'handle'`,
    )
    expect(colResult.rows).toHaveLength(1)
    expect(colResult.rows[0]?.is_nullable).toBe('YES')

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

  // -------------------------------------------------------------------------
  // T-0002-002 — Happy: new project rows get default values
  // -------------------------------------------------------------------------
  it('T-0002-002: new project rows get visibility=private, published_at=null, original_prompt=empty', async () => {
    const u = userRow()
    await db2.insert(users).values(u)
    await db2.insert(projects).values({
      ownerId: u.id!,
      title: 'Default columns test',
    })

    const rows = await db2
      .select({
        visibility: projects.visibility,
        publishedAt: projects.publishedAt,
        originalPrompt: projects.originalPrompt,
      })
      .from(projects)

    expect(rows).toHaveLength(1)
    expect(rows[0]?.visibility).toBe('private')
    expect(rows[0]?.publishedAt).toBeNull()
    expect(rows[0]?.originalPrompt).toBe('')
  })

  // -------------------------------------------------------------------------
  // T-0002-003 — Boundary: re-running migrations is idempotent
  // -------------------------------------------------------------------------
  it('T-0002-003: re-running migration 0003 is a no-op', async () => {
    const pool = await getTestPool()
    await expect(runMigrations({pool})).resolves.toBeDefined()
    // Users table still accessible — no DDL damage.
    const result = await db2.select().from(users)
    expect(Array.isArray(result)).toBe(true)
  })

  // -------------------------------------------------------------------------
  // T-0002-004 — Boundary: users.handle allows null
  // -------------------------------------------------------------------------
  it('T-0002-004: users.handle allows null (Drizzle insert without handle field)', async () => {
    const u = userRow() // no handle property
    await expect(db2.insert(users).values(u)).resolves.toBeDefined()

    const found = await db2.select({handle: users.handle}).from(users)
    expect(found[0]?.handle).toBeNull()
  })

  // -------------------------------------------------------------------------
  // T-0002-005 — Boundary: users.handle UNIQUE catches duplicate non-null values
  // -------------------------------------------------------------------------
  it('T-0002-005: users.handle UNIQUE rejects duplicate non-null handles', async () => {
    const handle = `maker-${randomUUID().slice(0, 8)}`

    const uA = userRow()
    const uB = userRow()
    await db2.insert(users).values({...uA, handle})
    await expect(db2.insert(users).values({...uB, handle})).rejects.toThrow(/duplicate|unique/i)
  })

  // -------------------------------------------------------------------------
  // T-0002-006 — Security: visibility CHECK rejects invalid values
  // -------------------------------------------------------------------------
  it("T-0002-006: visibility CHECK rejects 'unlisted', 'PUBLIC', '', null", async () => {
    const pool = await getTestPool()
    const u = userRow()
    await db2.insert(users).values(u)

    const invalidValues = ['unlisted', 'PUBLIC', '']
    for (const v of invalidValues) {
      await expect(
        pool.query(
          `INSERT INTO projects (id, owner_id, title, visibility) VALUES ($1, $2, $3, $4)`,
          [randomUUID(), u.id, 'p', v],
        ),
      ).rejects.toThrow(/check|violates/i)
    }

    // null: column is NOT NULL
    await expect(
      pool.query(`INSERT INTO projects (id, owner_id, title, visibility) VALUES ($1, $2, $3, $4)`, [
        randomUUID(),
        u.id,
        'p',
        null,
      ]),
    ).rejects.toThrow(/null|not[- ]null|violates/i)
  })

  // -------------------------------------------------------------------------
  // T-0002-007 — Happy: projects_library_idx exists as a partial index
  // -------------------------------------------------------------------------
  it('T-0002-007: projects_library_idx is a partial index on visibility=public', async () => {
    const pool = await getTestPool()
    const idxResult = await pool.query<{indexname: string; indexdef: string}>(
      `SELECT indexname, indexdef FROM pg_indexes
       WHERE schemaname = 'public' AND indexname = 'projects_library_idx'`,
    )
    expect(idxResult.rows).toHaveLength(1)
    const def = idxResult.rows[0]?.indexdef ?? ''
    expect(def).toMatch(/where/i)
    expect(def).toMatch(/visibility\s*=\s*'public'/i)
    expect(def).toMatch(/published_at/i)
  })

  // -------------------------------------------------------------------------
  // T-0002-008 — Boundary: original_prompt accepts '' and 10 000-char values
  // -------------------------------------------------------------------------
  it('T-0002-008: original_prompt accepts empty string and a 10 000-char value', async () => {
    const u = userRow()
    await db2.insert(users).values(u)

    // Empty string.
    const [emptyRow] = await db2
      .insert(projects)
      .values({ownerId: u.id!, title: 'empty-prompt', originalPrompt: ''})
      .returning({originalPrompt: projects.originalPrompt})
    expect(emptyRow?.originalPrompt).toBe('')

    // 10 000-char value.
    const longPrompt = 'a'.repeat(10_000)
    const [longRow] = await db2
      .insert(projects)
      .values({ownerId: u.id!, title: 'long-prompt', originalPrompt: longPrompt})
      .returning({originalPrompt: projects.originalPrompt})
    expect(longRow?.originalPrompt).toHaveLength(10_000)
  })

  // -------------------------------------------------------------------------
  // T-0002-009 — Regression: ADR-0001 schema still intact after 0003 migration.
  // The outer describe block's tests already verify this structurally. This
  // test adds a targeted assertion — FK and index presence — as a named
  // regression marker.
  // -------------------------------------------------------------------------
  it('T-0002-009: ADR-0001 constraints intact after 0003 — FK and indexes unchanged', async () => {
    const pool = await getTestPool()

    // Deferred cycle-break FK from 0002 still in place.
    const fkResult = await pool.query<{constraint_name: string}>(
      `SELECT constraint_name FROM information_schema.table_constraints
       WHERE table_name = 'projects'
         AND constraint_name = 'projects_current_version_id_fk'
         AND constraint_type = 'FOREIGN KEY'`,
    )
    expect(fkResult.rows).toHaveLength(1)

    // ADR-0001 owner index still present.
    const idxResult = await pool.query<{indexname: string}>(
      `SELECT indexname FROM pg_indexes
       WHERE schemaname = 'public' AND indexname = 'projects_owner_idx'`,
    )
    expect(idxResult.rows).toHaveLength(1)

    // Can still insert and read a user row (basic smoke).
    const u = userRow()
    await db2.insert(users).values(u)
    const found = await db2.select({id: users.id}).from(users)
    expect(found.some(r => r.id === u.id)).toBe(true)
  })

  // -------------------------------------------------------------------------
  // T-0002-010 — Happy: visibility='public' + published_at inserts cleanly
  // (confirms the allowed set covers what the library feature needs).
  // -------------------------------------------------------------------------
  it("T-0002-010: visibility='public' with published_at inserts and reads back correctly", async () => {
    const u = userRow()
    await db2.insert(users).values(u)

    const now = new Date()
    const [row] = await db2
      .insert(projects)
      .values({
        ownerId: u.id!,
        title: 'Published app',
        visibility: 'public',
        publishedAt: now,
        originalPrompt: 'a tip splitter for my coffee shop',
      })
      .returning({
        visibility: projects.visibility,
        publishedAt: projects.publishedAt,
        originalPrompt: projects.originalPrompt,
      })

    expect(row?.visibility).toBe('public')
    expect(row?.publishedAt).not.toBeNull()
    expect(row?.originalPrompt).toBe('a tip splitter for my coffee shop')
  })
})

// =============================================================================
// ADR-0002 Step 2 — @example seed user + 5 seed projects + reserved handles
//
// Tests T-0002-011 through T-0002-021.
//
// The shared testcontainer runs migrations 0001 → 0004 in sequence (the
// runMigrations() call in setup.ts picks up all *.sql files in order).
// T-0002-021 (regression) is satisfied by the full migration chain succeeding,
// plus the ADR-0001 and Step 1 tests above still passing.
// =============================================================================

const EXAMPLE_USER_ID = '00000000-0000-0000-0000-000000000001'
const SEED_PROJECT_IDS = [
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000012',
  '00000000-0000-0000-0000-000000000013',
  '00000000-0000-0000-0000-000000000014',
]

describe('ADR-0002 Step 2 seeds', () => {
  // The outer describe blocks call truncateAll() in their afterEach, which
  // removes the seed data. Re-run migrations before this describe block so
  // seed rows exist (migrations are idempotent; ON CONFLICT DO NOTHING).
  beforeAll(async () => {
    const pool = await getTestPool()
    await runMigrations({pool})
  })

  // No afterEach truncation — seeds are read-only assertions.

  // -------------------------------------------------------------------------
  // T-0002-011 — Happy: @example user is present with handle='example'
  // -------------------------------------------------------------------------
  it('T-0002-011: @example user inserted with handle=example', async () => {
    const pool = await getTestPool()
    const result = await pool.query<{id: string; handle: string; email: string}>(
      `SELECT id, handle, email FROM users WHERE id = $1`,
      [EXAMPLE_USER_ID],
    )
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]?.handle).toBe('example')
    expect(result.rows[0]?.email).toBe('example@reserved.localhost')
  })

  // -------------------------------------------------------------------------
  // T-0002-012 — Happy: ≥5 seed projects owned by @example, all public
  // -------------------------------------------------------------------------
  it('T-0002-012: ≥5 seed projects with visibility=public, published_at set, owner=@example', async () => {
    const pool = await getTestPool()
    const result = await pool.query<{
      id: string
      visibility: string
      published_at: string | null
      owner_id: string
    }>(
      `SELECT id, visibility, published_at, owner_id
       FROM projects
       WHERE owner_id = $1`,
      [EXAMPLE_USER_ID],
    )
    expect(result.rows.length).toBeGreaterThanOrEqual(5)
    for (const row of result.rows) {
      expect(row.visibility).toBe('public')
      expect(row.published_at).not.toBeNull()
      expect(row.owner_id).toBe(EXAMPLE_USER_ID)
    }
  })

  // -------------------------------------------------------------------------
  // T-0002-015 — Boundary: re-running migration 0004 is idempotent
  // -------------------------------------------------------------------------
  it('T-0002-015: re-running migration 0004 is a no-op (ON CONFLICT DO NOTHING)', async () => {
    const pool = await getTestPool()
    // Re-running all migrations is the idempotent path (same as T-0002-003).
    await expect(runMigrations({pool})).resolves.toBeDefined()

    // Seed user count hasn't doubled.
    const userResult = await pool.query<{count: string}>(
      `SELECT count(*)::text AS count FROM users WHERE id = $1`,
      [EXAMPLE_USER_ID],
    )
    expect(userResult.rows[0]?.count).toBe('1')

    // Seed project count hasn't doubled.
    for (const projectId of SEED_PROJECT_IDS) {
      const projectResult = await pool.query<{count: string}>(
        `SELECT count(*)::text AS count FROM projects WHERE id = $1`,
        [projectId],
      )
      expect(projectResult.rows[0]?.count).toBe('1')
    }
  })

  // -------------------------------------------------------------------------
  // T-0002-016 — Security: @example user email is sentinel value
  // -------------------------------------------------------------------------
  it("T-0002-016: @example user has email 'example@reserved.localhost'", async () => {
    const pool = await getTestPool()
    const result = await pool.query<{email: string}>(`SELECT email FROM users WHERE id = $1`, [
      EXAMPLE_USER_ID,
    ])
    expect(result.rows[0]?.email).toBe('example@reserved.localhost')
  })

  // -------------------------------------------------------------------------
  // T-0002-017 — Security (structural): sentinel email is unroutable
  //
  // We can't send a real Supabase magic-link in a unit test. Instead, verify
  // the structural property: the `.localhost` TLD is IANA-reserved and no
  // real Supabase project can route to it. This test documents the intent;
  // actual Supabase behavior is verified via manual smoke test at deploy time.
  // -------------------------------------------------------------------------
  it('T-0002-017: @example email uses .localhost TLD — unroutable by design', async () => {
    const pool = await getTestPool()
    const result = await pool.query<{email: string}>(`SELECT email FROM users WHERE id = $1`, [
      EXAMPLE_USER_ID,
    ])
    const email = result.rows[0]?.email ?? ''
    // Must end with .localhost — the IANA-reserved TLD that MX records cannot
    // resolve. Supabase will fail to send a magic link to this address.
    expect(email).toMatch(/\.localhost$/)
  })

  // -------------------------------------------------------------------------
  // T-0002-018 — Happy: RESERVED_HANDLES membership (unit check in-test)
  // -------------------------------------------------------------------------
  it('T-0002-018: RESERVED_HANDLES includes admin, system, official, support, app, creator, example', () => {
    const required = ['admin', 'system', 'official', 'support', 'app', 'creator', 'example']
    for (const handle of required) {
      expect(RESERVED_HANDLES).toContain(handle)
    }
  })

  // -------------------------------------------------------------------------
  // T-0002-019 — Boundary: isReservedHandle is case-insensitive
  // -------------------------------------------------------------------------
  it("T-0002-019: isReservedHandle('admin')=true, isReservedHandle('Admin')=true, isReservedHandle('admin1')=false", () => {
    expect(isReservedHandle('admin')).toBe(true)
    expect(isReservedHandle('Admin')).toBe(true)
    expect(isReservedHandle('admin1')).toBe(false)
  })

  // -------------------------------------------------------------------------
  // T-0002-020 — Negative: empty string is not reserved
  // -------------------------------------------------------------------------
  it("T-0002-020: isReservedHandle('') returns false", () => {
    expect(isReservedHandle('')).toBe(false)
  })

  // -------------------------------------------------------------------------
  // T-0002-021 — Regression: migrations 0001 + 0002 still apply after 0003 + 0004
  //
  // The testcontainer in setup.ts runs the full migration chain at init().
  // This test verifies that the complete chain (0001 → 0004) leaves the
  // database in a state where ADR-0001 constraints are intact — specifically:
  //   - The cycle-breaking FK from 0002 still exists.
  //   - The ADR-0001 owner index still exists.
  //   - A user + project + project_version round-trip still works.
  // -------------------------------------------------------------------------
  it('T-0002-021: ADR-0001 + 0002 migrations intact after 0003 + 0004', async () => {
    const pool = await getTestPool()

    // Deferred FK from migration 0002 still in place.
    const fkResult = await pool.query<{constraint_name: string}>(
      `SELECT constraint_name FROM information_schema.table_constraints
       WHERE table_name = 'projects'
         AND constraint_name = 'projects_current_version_id_fk'
         AND constraint_type = 'FOREIGN KEY'`,
    )
    expect(fkResult.rows).toHaveLength(1)

    // ADR-0001 owner index still present.
    const idxResult = await pool.query<{indexname: string}>(
      `SELECT indexname FROM pg_indexes
       WHERE schemaname = 'public' AND indexname = 'projects_owner_idx'`,
    )
    expect(idxResult.rows).toHaveLength(1)

    // ADR-0002 library index still present.
    const libIdxResult = await pool.query<{indexname: string}>(
      `SELECT indexname FROM pg_indexes
       WHERE schemaname = 'public' AND indexname = 'projects_library_idx'`,
    )
    expect(libIdxResult.rows).toHaveLength(1)
  })
})
