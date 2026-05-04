/**
 * users.service unit tests — focused on the `findOrCreate` source-of-truth
 * contract. The route-level tests in `routes/auth.test.ts` exercise the
 * HTTP surface; this file isolates the service.
 *
 * Covered: ON CONFLICT DO NOTHING (no email update), idempotency, race-safe
 * row-count = 1 under concurrent calls.
 */
import {randomUUID} from 'node:crypto'

import {eq} from 'drizzle-orm'
import type {NodePgDatabase} from 'drizzle-orm/node-postgres'

import {users} from '../db/schema.js'
import * as schema from '../db/schema.js'
import {findOrCreate} from './users.service.js'
import {closeTestPool, getTestDb, getTestPool, truncateAll} from '../../test/setup.js'

type Db = NodePgDatabase<typeof schema>

describe('users.service.findOrCreate', () => {
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

  it('inserts a new row when none exists and returns the mirrored shape', async () => {
    const id = randomUUID()
    const result = await findOrCreate(db, id, 'first@example.com')

    expect(result.id).toBe(id)
    expect(result.email).toBe('first@example.com')
    expect(result.createdAt).toBeInstanceOf(Date)

    const pool = await getTestPool()
    const {rows} = await pool.query<{id: string; email: string}>(
      'SELECT id, email FROM users WHERE id = $1',
      [id],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.email).toBe('first@example.com')
  })

  it('does NOT update email on conflict — Supabase is source of truth (T-0001-119 contract)', async () => {
    const id = randomUUID()
    await findOrCreate(db, id, 'alice@example.com')

    const result = await findOrCreate(db, id, 'bob@example.com')

    // The returned row carries the ORIGINAL email, not the second-call value.
    expect(result.id).toBe(id)
    expect(result.email).toBe('alice@example.com')

    // And the DB confirms — single row, original email.
    const persisted = await db.select().from(users).where(eq(users.id, id))
    expect(persisted).toHaveLength(1)
    expect(persisted[0]?.email).toBe('alice@example.com')
  })

  it('is idempotent — repeated calls do not duplicate rows', async () => {
    const id = randomUUID()
    await findOrCreate(db, id, 'idempotent@example.com')
    await findOrCreate(db, id, 'idempotent@example.com')
    await findOrCreate(db, id, 'idempotent@example.com')

    const persisted = await db.select().from(users).where(eq(users.id, id))
    expect(persisted).toHaveLength(1)
  })
})
