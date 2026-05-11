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
 * ADR-0013 Step 1 adds `findOrCreateByAppleSub`:
 *  - Apple `apple_user_id` (the "sub" claim) is the primary join key — NOT
 *    email. Email is metadata (may be real or a Relay alias); it is captured
 *    on first sign-in and NEVER overwritten on subsequent calls.
 *  - `display_name` captured on first sign-in (Apple emits it once); not
 *    updated on conflict.
 *  - Apple Relay aliases (`*@privaterelay.appleid.com`) stored verbatim; NEVER
 *    logged at INFO (T-0013-033).
 *  - Race-safe: same INSERT ... ON CONFLICT DO NOTHING + SELECT pattern as
 *    `findOrCreate` (T-0013-029/030).
 *
 * Why ON CONFLICT DO NOTHING (not DO UPDATE): updating email here would let a
 * forged JWT with a stolen `sub` rewrite the local email, violating the
 * upstream identity model. The race-safe two-statement pattern (insert + select)
 * gives us idempotency without privilege creep.
 */
import {eq} from 'drizzle-orm'
import type {NodePgDatabase} from 'drizzle-orm/node-postgres'
import {randomUUID} from 'node:crypto'

import {users, type User} from '../db/schema.js'
import * as schema from '../db/schema.js'

type Db = NodePgDatabase<typeof schema>

export interface MirroredUser {
  id: string
  email: string
  createdAt: Date
  displayName: string | null
}

/**
 * Insert the user row if absent, then read it back. Two statements at the
 * read-committed default isolation level — concurrent first-syncs from the
 * same `sub` produce one INSERT (Postgres serializes the unique-PK conflict)
 * and two identical SELECT reads, both returning the single committed row
 * (T-0001-045 verifies row count = 1 after parallel calls).
 *
 * The shape returned is `{id, email, createdAt, displayName}` — the public-safe
 * view of a user. Per retro-lessons.md `normalizeRow` lesson: callers that need
 * PII-free data get the same fields; we don't expose anything else from the table.
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
  return {id: row.id, email: row.email, createdAt: row.createdAt, displayName: row.displayName}
}

/**
 * Find or create a user row keyed on the Apple `sub` claim (apple_user_id).
 *
 * Identity model (ADR-0013 §Decision 2):
 *  - `appleSub` is the primary join key. Email is metadata — captured once,
 *    never overwritten on conflict.
 *  - `displayName` is captured on first sign-in only. Apple emits it once;
 *    subsequent calls omit it. On conflict we leave the stored value intact.
 *  - Apple Relay aliases (`*@privaterelay.appleid.com`) stored verbatim and
 *    NEVER logged at INFO (T-0013-033 assertion in test).
 *
 * Race-safe: INSERT ... ON CONFLICT (apple_user_id) DO NOTHING + SELECT.
 * Two concurrent first-sign-ins for the same sub produce one DB row (T-0013-029).
 *
 * T-0013-025..036.
 */
export async function findOrCreateByAppleSub(
  db: Db,
  appleSub: string,
  email: string,
  displayName?: string,
): Promise<MirroredUser> {
  if (!appleSub || appleSub.trim().length === 0) {
    throw new Error('invalid_apple_sub')
  }

  // Generate our own UUID for the users.id — Apple's sub is stored in
  // apple_user_id; our local id is always a random UUID (T-0013-025).
  const newId = randomUUID()

  // INSERT ... ON CONFLICT DO NOTHING on the apple_user_id partial unique index.
  // Does NOT update email or display_name on conflict (T-0013-026/027/035).
  // Note: `id` (PK) is always unique; conflict is on apple_user_id index.
  await db
    .insert(users)
    .values({
      id: newId,
      email,
      appleUserId: appleSub,
      displayName: displayName ?? null,
    })
    .onConflictDoNothing()

  // Read back — finds the row whether it was just inserted or pre-existed.
  const rows: User[] = await db
    .select()
    .from(users)
    .where(eq(users.appleUserId, appleSub))

  const row = rows[0]
  if (!row) {
    // Defensive: theoretically possible if the row was deleted between
    // INSERT and SELECT. Treat as internal error.
    throw new Error('users.findOrCreateByAppleSub: row missing after insert')
  }

  // Return auth-only view — appleUserId deliberately excluded per data
  // sensitivity table (ADR-0013 Step 1 §Data Sensitivity: auth-only).
  return {
    id: row.id,
    email: row.email,
    createdAt: row.createdAt,
    displayName: row.displayName,
  }
}
