/**
 * Shared test infra. Spins up Postgres via testcontainers (image
 * `pgvector/pgvector:pg16`), runs migrations once per worker, and exposes a
 * `truncateAll()` helper for between-test isolation.
 *
 * Usage in a test file:
 *
 *   import {getTestDb, truncateAll, closeTestPool} from '../../test/setup'
 *
 *   describe('schema', () => {
 *     beforeAll(async () => { await getTestDb() })
 *     afterEach(async () => { await truncateAll() })
 *     afterAll(async () => { await closeTestPool() })
 *     ...
 *   })
 *
 * Per ADR-0001 §Test Helpers: this is Step 1's first use of the file;
 * subsequent steps will reuse it.
 */
import {GenericContainer, type StartedTestContainer, Wait} from 'testcontainers'

import {createDb, createPool, type schema as schemaTypes} from '../src/db/index.js'
import {runMigrations} from '../src/db/migrate.js'
import type pg from 'pg'
import type {NodePgDatabase} from 'drizzle-orm/node-postgres'

let _container: StartedTestContainer | undefined
let _pool: pg.Pool | undefined
let _db: NodePgDatabase<typeof schemaTypes> | undefined
let _connectionString: string | undefined
let _initPromise: Promise<void> | undefined

const PGVECTOR_IMAGE = 'pgvector/pgvector:pg16'
const PG_USER = 'postgres'
const PG_PASS = 'postgres'
const PG_DB = 'app_creator_test'

async function init(): Promise<void> {
  if (_db) return
  if (_initPromise) {
    await _initPromise
    return
  }
  _initPromise = (async () => {
    const container = await new GenericContainer(PGVECTOR_IMAGE)
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

    _container = container
    _connectionString = url

    const pool = createPool(url)
    _pool = pool
    _db = createDb(pool)

    await runMigrations({pool})
  })()
  await _initPromise
}

/** Pool against the testcontainer Postgres. Initialized on first call. */
export async function getTestPool(): Promise<pg.Pool> {
  await init()
  if (!_pool) throw new Error('test pool not initialized')
  return _pool
}

/** Drizzle instance against the testcontainer Postgres. */
export async function getTestDb(): Promise<NodePgDatabase<typeof schemaTypes>> {
  await init()
  if (!_db) throw new Error('test db not initialized')
  return _db
}

/** Connection string for the testcontainer Postgres (used by config tests). */
export async function getTestConnectionString(): Promise<string> {
  await init()
  if (!_connectionString) throw new Error('test connection string not initialized')
  return _connectionString
}

/**
 * TRUNCATE every table to give each test a clean slate. CASCADE for FK chains.
 * RESTART IDENTITY for the bigserial on `events`. Per Roz M-10 cleanup rule.
 */
export async function truncateAll(): Promise<void> {
  if (!_pool) return
  await _pool.query(
    'TRUNCATE TABLE memory_embeddings, facts, messages, project_versions, projects, events, out_of_scope_intent, users RESTART IDENTITY CASCADE',
  )
}

/** Tear down. Call from afterAll(). */
export async function closeTestPool(): Promise<void> {
  if (_pool) {
    await _pool.end().catch(() => {})
    _pool = undefined
    _db = undefined
  }
  if (_container) {
    await _container.stop().catch(() => {})
    _container = undefined
  }
  _connectionString = undefined
  _initPromise = undefined
}
