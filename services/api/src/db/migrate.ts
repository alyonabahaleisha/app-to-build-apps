/**
 * Migration runner. Used by:
 *   pnpm db:migrate                        — production / dev DB
 *   services/api/test/setup.ts             — test DB inside testcontainers
 *
 * Why hand-rolled instead of `drizzle-kit migrate`? Two reasons:
 *
 *   1. Step 1 needs `CREATE EXTENSION IF NOT EXISTS vector;` to run BEFORE
 *      anything that references the `vector` type. drizzle-kit's generator
 *      doesn't emit this. We want full control over ordering.
 *   2. The deferred FK pattern (`projects.current_version_id` → cycle break)
 *      lives in `0002_project_version_fk.sql`. We need a runner that
 *      processes both files in order.
 *
 * This runner is **idempotent** (T-0001-005): re-running it against an
 * already-migrated DB succeeds with no errors. The contract is enforced via
 * `IF NOT EXISTS` clauses in every DDL statement.
 *
 * On failure (T-0001-009): wraps the underlying cause in a `MigrationError`.
 * No half-applied DDL — each migration file runs inside a single transaction.
 */
// Side-effect: load .env so process.env.DATABASE_URL is populated before
// resolveDatabaseUrl() runs. testcontainers-driven test runs bypass this
// path (they call createPool with an explicit connection string), so this
// import only matters for the CLI / dev / staging path.
import 'dotenv/config'

import {readdir, readFile} from 'node:fs/promises'
import {join} from 'node:path'

import type pg from 'pg'

import {MigrationError, getPool} from './index.js'

// Resolve relative to the file's source location at runtime. tsx + ts-jest
// both honour __dirname when CommonJS module is in effect, which is what
// services/api/tsconfig.json sets. Avoids `import.meta.url` (not available
// under module: CommonJS) and keeps the migration loader portable.
const MIGRATIONS_DIR = join(__dirname, '..', '..', 'migrations')

export interface RunMigrationsOptions {
  /** Optional pool to run against (tests pass their testcontainer pool). */
  pool?: pg.Pool
  /** Override migrations directory (tests use this). */
  migrationsDir?: string
}

/**
 * Apply all SQL files in the migrations directory, in lexical order.
 * Returns the list of files applied.
 *
 * Thrown errors are always `MigrationError`. Original cause is preserved
 * via the standard `Error.cause` field (asserted by T-0001-009).
 */
export async function runMigrations(opts: RunMigrationsOptions = {}): Promise<string[]> {
  const pool = opts.pool ?? getPool()
  const dir = opts.migrationsDir ?? MIGRATIONS_DIR

  let files: string[]
  try {
    const entries = await readdir(dir)
    files = entries.filter(f => f.endsWith('.sql')).sort()
  } catch (err) {
    throw new MigrationError(`failed to read migrations directory: ${dir}`, {cause: err})
  }

  if (files.length === 0) {
    throw new MigrationError(`no migration files found in ${dir}`)
  }

  const applied: string[] = []
  for (const file of files) {
    const path = join(dir, file)
    let sql: string
    try {
      sql = await readFile(path, 'utf-8')
    } catch (err) {
      throw new MigrationError(`failed to read migration ${file}`, {cause: err})
    }

    let client: pg.PoolClient
    try {
      client = await pool.connect()
    } catch (err) {
      throw new MigrationError(`failed to acquire connection for ${file}`, {cause: err})
    }

    try {
      await client.query('BEGIN')
      await client.query(sql)
      await client.query('COMMIT')
      applied.push(file)
    } catch (err) {
      try {
        await client.query('ROLLBACK')
      } catch {
        // Pool may already be ended; original error is what matters.
      }
      throw new MigrationError(`migration ${file} failed`, {cause: err})
    } finally {
      client.release()
    }
  }

  return applied
}

// CLI entry point — `pnpm db:migrate` runs `tsx src/db/migrate.ts`. Under
// module: CommonJS we use `require.main === module` to detect direct
// execution. Skipped when imported by tests.
declare const require: NodeJS.Require & {main?: NodeJS.Module}
declare const module: NodeJS.Module

if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
  const {createPool} = require('./index.js') as typeof import('./index.js')
  const pool = createPool()
  runMigrations({pool})
    .then(applied => {
      console.error(`applied ${applied.length} migration(s):`, applied.join(', '))
      return pool.end()
    })
    .catch(async err => {
      console.error('migration failed:', err)
      await pool.end().catch(() => {})
      process.exit(1)
    })
}
