/**
 * Users service — server-side mirror of Supabase auth.users into our local
 * `users` table. Per ADR-0001 §G: we keep our own `users` row for FK integrity
 * (`projects.owner_id`) and provider portability.
 *
 * Source-of-truth contract (T-0001-119, T-0001-044):
 *  - Supabase `auth.users` is the canonical identity store.
 *  - The local `users` row's email is captured ONLY at first sign-in, when the
 *    row is inserted by `findOrCreate`. Subsequent sync calls — even if the
 *    JWT carries a different `email` claim for the same `sub` — DO NOT update
 *    the local row's email. Explicit re-sync is Phase 2.
 *  - `sub` (UUID) is the canonical identity. `findOrCreate`'s `id` parameter
 *    must be the `sub` claim from a verified JWT (asserted upstream by
 *    `requireAuth` + `verifyJwt`).
 *
 * Why ON CONFLICT DO NOTHING (not DO UPDATE): updating email here would let a
 * forged JWT with a stolen `sub` rewrite the local email, violating the
 * upstream identity model. The race-safe two-statement pattern (insert + select)
 * gives us idempotency without privilege creep.
 */
import {eq} from 'drizzle-orm'
import type {NodePgDatabase} from 'drizzle-orm/node-postgres'

import {users, type User} from '../db/schema.js'
import * as schema from '../db/schema.js'

type Db = NodePgDatabase<typeof schema>

export interface MirroredUser {
  id: string
  email: string
  createdAt: Date
}

/**
 * Insert the user row if absent, then read it back. Two statements at the
 * read-committed default isolation level — concurrent first-syncs from the
 * same `sub` produce one INSERT (Postgres serializes the unique-PK conflict)
 * and two identical SELECT reads, both returning the single committed row
 * (T-0001-045 verifies row count = 1 after parallel calls).
 *
 * The shape returned is `{id, email, createdAt}` — the public-safe view of a
 * user. Per retro-lessons.md `normalizeRow` lesson: callers that need PII-free
 * data get the same fields; we don't expose anything else from the table.
 */
export async function findOrCreate(
  db: Db,
  supabaseUserId: string,
  email: string,
): Promise<MirroredUser> {
  // Insert with no-op on conflict. This explicitly does NOT update email on
  // conflict — see file-header T-0001-119 contract.
  await db.insert(users).values({id: supabaseUserId, email}).onConflictDoNothing()

  const rows: User[] = await db.select().from(users).where(eq(users.id, supabaseUserId))
  const row = rows[0]
  if (!row) {
    // Defensive: a race in which the row was deleted between INSERT and SELECT
    // is theoretically possible (cascade from auth.users delete, etc). At MVP
    // we treat this as an internal error; Phase 2 may retry the insert.
    throw new Error('users.findOrCreate: row missing after insert')
  }
  return {id: row.id, email: row.email, createdAt: row.createdAt}
}
