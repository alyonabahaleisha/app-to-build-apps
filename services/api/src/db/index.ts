/**
 * Database client — single source of `pool` and `db` for the api service.
 *
 * Per ARCHITECTURE.md §0/§5/§14: Drizzle ORM on top of `pg.Pool`. No raw SQL
 * in route handlers. Per CLAUDE.md: services consume `db` via import (DI-style).
 *
 * The pool is lazy: it's only created on first use. This matters for tests,
 * which reset DATABASE_URL between cases (T-0001-014).
 */
import {drizzle, type NodePgDatabase} from 'drizzle-orm/node-postgres'
import pg from 'pg'

import * as schema from './schema.js'

const {Pool} = pg

/**
 * MigrationError — thrown when the migration runner fails. Wraps the
 * underlying cause via the standard `Error.cause` field. T-0001-009 asserts
 * this exact class name and that the original error is reachable.
 */
export class MigrationError extends Error {
  override readonly name = 'MigrationError'
  constructor(message: string, options?: {cause?: unknown}) {
    super(message, options)
  }
}

/**
 * ConfigError — thrown at module import time if DATABASE_URL is missing or
 * malformed. Used by T-0001-014 (config exhaustion). We throw rather than
 * exit; tests need to assert the error.
 */
export class ConfigError extends Error {
  override readonly name = 'ConfigError'
}

let _pool: pg.Pool | undefined
let _db: NodePgDatabase<typeof schema> | undefined

/**
 * Validate and return the DATABASE_URL. Treats empty/whitespace as unset.
 * Throws ConfigError on missing / malformed URL.
 */
function resolveDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL
  if (raw === undefined || raw.trim() === '') {
    throw new ConfigError('DATABASE_URL is required but was not set')
  }
  // Validate URL shape. node:url throws TypeError on malformed.
  try {
    const url = new URL(raw)
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
      throw new ConfigError(`DATABASE_URL must use postgres:// or postgresql:// — got ${url.protocol}`)
    }
  } catch (err) {
    if (err instanceof ConfigError) throw err
    throw new ConfigError(`DATABASE_URL is not a valid URL: ${(err as Error).message}`)
  }
  return raw
}

/**
 * Build a fresh Pool from DATABASE_URL. Exported for testcontainers / tests
 * that need to swap DBs between cases. Production uses `pool` (the singleton).
 */
export function createPool(connectionString?: string): pg.Pool {
  const url = connectionString ?? resolveDatabaseUrl()
  return new Pool({
    connectionString: url,
    // Keep small at MVP; AC-Q3 rate limit caps inflight per user, and we run
    // a single API process. Bump when we horizontally scale.
    max: 10,
    // Reasonable connect timeout so unreachable hosts surface fast (T-0001-014).
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
  })
}

/**
 * Get (or lazily build) the singleton pool used by the application.
 * Tests should NOT use this — they should use createPool() against the
 * testcontainers Postgres URL and pass the resulting db down.
 */
export function getPool(): pg.Pool {
  if (!_pool) _pool = createPool()
  return _pool
}

export function getDb(): NodePgDatabase<typeof schema> {
  if (!_db) _db = drizzle(getPool(), {schema})
  return _db
}

/**
 * Convenience exports — singletons, lazily built. Production code uses these.
 *
 * NOTE: do NOT destructure on import in tests; the Proxy captures the live
 * singleton. Use createPool()/createDb(connection) in tests instead.
 */
export const pool = new Proxy({} as pg.Pool, {
  get(_t, prop) {
    return Reflect.get(getPool(), prop)
  },
})

export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_t, prop) {
    return Reflect.get(getDb(), prop)
  },
})

/**
 * Build a Drizzle instance bound to a specific pool. Used by tests + the
 * migration runner.
 */
export function createDb(p: pg.Pool): NodePgDatabase<typeof schema> {
  return drizzle(p, {schema})
}

export {schema}
