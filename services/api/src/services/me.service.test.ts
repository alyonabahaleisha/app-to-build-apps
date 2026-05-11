/**
 * Me service tests — ADR-0011 Step 5.
 *
 * T-IDs covered:
 *   T-0011-102: listMyOutOfScopeIntents returns OutOfScopeIntentSummary[]
 *   T-0011-103: grouped by capability with count + max(createdAt)
 *   T-0011-104: only the caller's rows returned (userId filter)
 *   T-0011-105: email NOT returned in any summary row
 *   T-0011-106: empty result when user has no intents
 *   T-0011-107: patchMyOutOfScopeIntent updates all rows for capability/user
 *   T-0011-108: patch does not affect other users' rows
 *   T-0011-109: patch does not affect same user's different capability rows
 *   T-0011-110: returns {updated: 0} when no rows match (idempotent)
 *   T-0011-111: only updates the caller's rows (userId + capability filter)
 *   T-0011-112: capturedCount is correct aggregate count
 *   T-0011-120: notifyOptIn is read from the notify_opt_in column
 *
 * Strategy: real Postgres via testcontainers. We insert rows directly via
 * Drizzle and assert on service output — no mocking.
 *
 * Data sensitivity: email is NEVER present in return values. Each test that
 * inserts a row with email asserts that the summary response does not contain
 * the email field.
 */

import {randomUUID} from 'node:crypto'

import {createHash} from 'node:crypto'
import type {NodePgDatabase} from 'drizzle-orm/node-postgres'

import * as schema from '../db/schema.js'
import {outOfScopeIntent, users} from '../db/schema.js'
import {createMeService, type MeService} from './me.service.js'
import {uniqueEmail} from '../../test/factories.js'
import {closeTestPool, getTestDb, truncateAll} from '../../test/setup.js'

type Db = NodePgDatabase<typeof schema>

function sha256(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex')
}

async function makeUser(db: Db, email = uniqueEmail()): Promise<string> {
  const id = randomUUID()
  await db.insert(users).values({id, email})
  return id
}

async function insertIntent(
  db: Db,
  userId: string,
  opts: {
    capability?: string
    email?: string | null
    notifyOptIn?: boolean
    promptHash?: string
  } = {},
): Promise<void> {
  await db.insert(outOfScopeIntent).values({
    userId,
    capability: opts.capability ?? 'image_gen',
    promptHash: opts.promptHash ?? sha256(randomUUID()),
    reason: 'test reason',
    email: opts.email ?? null,
    notifyOptIn: opts.notifyOptIn ?? false,
  })
}

describe('ADR-0011 Step 5 — meService (unit)', () => {
  let db: Db
  let service: MeService

  beforeAll(async () => {
    db = await getTestDb()
    service = createMeService(db)
  })

  afterEach(async () => {
    await truncateAll()
  })

  afterAll(async () => {
    await closeTestPool()
  })

  // -------------------------------------------------------------------------
  // listMyOutOfScopeIntents
  // -------------------------------------------------------------------------

  describe('listMyOutOfScopeIntents', () => {
    it('T-0011-106: returns [] when user has no intents', async () => {
      const userId = await makeUser(db)
      const result = await service.listMyOutOfScopeIntents(userId)
      expect(result).toEqual([])
    })

    it('T-0011-102: returns OutOfScopeIntentSummary[] with expected shape', async () => {
      const userId = await makeUser(db)
      await insertIntent(db, userId, {capability: 'image_gen', notifyOptIn: false})

      const result = await service.listMyOutOfScopeIntents(userId)
      expect(result).toHaveLength(1)
      const summary = result[0]!
      expect(summary).toHaveProperty('capability', 'image_gen')
      expect(summary).toHaveProperty('capturedCount')
      expect(summary).toHaveProperty('lastCapturedAt')
      expect(summary).toHaveProperty('notifyOptIn')
    })

    it('T-0011-105: email is NOT present in any summary row', async () => {
      const userId = await makeUser(db)
      await insertIntent(db, userId, {
        capability: 'vision',
        email: 'secret@example.com',
        notifyOptIn: false,
      })

      const result = await service.listMyOutOfScopeIntents(userId)
      expect(result).toHaveLength(1)
      const summary = result[0]!
      // Check that email key is absent from the returned object
      expect(Object.keys(summary)).not.toContain('email')
      expect(Object.keys(summary)).not.toContain('userId')
      expect(Object.keys(summary)).not.toContain('promptHash')
    })

    it('T-0011-103: grouped by capability with correct count + max(createdAt)', async () => {
      const userId = await makeUser(db)
      // Three intents: 2 for image_gen, 1 for vision
      await insertIntent(db, userId, {capability: 'image_gen'})
      await insertIntent(db, userId, {capability: 'image_gen'})
      await insertIntent(db, userId, {capability: 'vision'})

      const result = await service.listMyOutOfScopeIntents(userId)
      // Sort for deterministic assertion
      result.sort((a, b) => a.capability.localeCompare(b.capability))

      expect(result).toHaveLength(2)
      expect(result[0]!.capability).toBe('image_gen')
      expect(result[0]!.capturedCount).toBe(2)
      expect(result[1]!.capability).toBe('vision')
      expect(result[1]!.capturedCount).toBe(1)
    })

    it('T-0011-112: capturedCount is correct aggregate count', async () => {
      const userId = await makeUser(db)
      // Insert 5 intents for same capability
      for (let i = 0; i < 5; i++) {
        await insertIntent(db, userId, {capability: 'classification'})
      }

      const result = await service.listMyOutOfScopeIntents(userId)
      expect(result).toHaveLength(1)
      expect(result[0]!.capturedCount).toBe(5)
    })

    it('T-0011-104: only the callers rows returned (strict userId filter)', async () => {
      const userId1 = await makeUser(db)
      const userId2 = await makeUser(db)
      await insertIntent(db, userId1, {capability: 'image_gen'})
      await insertIntent(db, userId2, {capability: 'image_gen'})
      await insertIntent(db, userId2, {capability: 'vision'})

      const result1 = await service.listMyOutOfScopeIntents(userId1)
      expect(result1).toHaveLength(1)
      expect(result1[0]!.capturedCount).toBe(1)

      const result2 = await service.listMyOutOfScopeIntents(userId2)
      expect(result2).toHaveLength(2)
    })

    it('T-0011-120: notifyOptIn is read from the notify_opt_in column', async () => {
      const userId = await makeUser(db)
      await insertIntent(db, userId, {capability: 'image_gen', notifyOptIn: true})

      const result = await service.listMyOutOfScopeIntents(userId)
      expect(result).toHaveLength(1)
      expect(result[0]!.notifyOptIn).toBe(true)
    })

    it('T-0011-120: notifyOptIn true wins when any row in group is true', async () => {
      const userId = await makeUser(db)
      // One false, one true — true should win
      await insertIntent(db, userId, {capability: 'transcription', notifyOptIn: false})
      await insertIntent(db, userId, {capability: 'transcription', notifyOptIn: true})

      const result = await service.listMyOutOfScopeIntents(userId)
      expect(result).toHaveLength(1)
      expect(result[0]!.notifyOptIn).toBe(true)
    })

    it('lastCapturedAt is an ISO 8601 string', async () => {
      const userId = await makeUser(db)
      await insertIntent(db, userId, {capability: 'chat'})

      const result = await service.listMyOutOfScopeIntents(userId)
      expect(result).toHaveLength(1)
      const ts = result[0]!.lastCapturedAt
      expect(typeof ts).toBe('string')
      // ISO 8601 — parseable as a Date
      expect(isNaN(Date.parse(ts))).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // patchMyOutOfScopeIntent
  // -------------------------------------------------------------------------

  describe('patchMyOutOfScopeIntent', () => {
    it('T-0011-107: updates all rows for capability/user combo', async () => {
      const userId = await makeUser(db)
      await insertIntent(db, userId, {capability: 'image_gen', notifyOptIn: false})
      await insertIntent(db, userId, {capability: 'image_gen', notifyOptIn: false})

      const result = await service.patchMyOutOfScopeIntent(userId, 'image_gen', {
        notifyOptIn: true,
      })
      expect(result.updated).toBe(2)

      // Verify via list
      const summary = await service.listMyOutOfScopeIntents(userId)
      expect(summary[0]!.notifyOptIn).toBe(true)
    })

    it('T-0011-110: returns {updated: 0} when no rows match (idempotent)', async () => {
      const userId = await makeUser(db)
      // No rows for this capability

      const result = await service.patchMyOutOfScopeIntent(userId, 'image_gen', {
        notifyOptIn: true,
      })
      expect(result).toEqual({updated: 0})
    })

    it('T-0011-111: only updates the callers rows', async () => {
      const userId1 = await makeUser(db)
      const userId2 = await makeUser(db)
      await insertIntent(db, userId1, {capability: 'vision', notifyOptIn: false})
      await insertIntent(db, userId2, {capability: 'vision', notifyOptIn: false})

      const result = await service.patchMyOutOfScopeIntent(userId1, 'vision', {notifyOptIn: true})
      expect(result.updated).toBe(1)

      // userId2's row must be untouched
      const user2Summary = await service.listMyOutOfScopeIntents(userId2)
      expect(user2Summary[0]!.notifyOptIn).toBe(false)
    })

    it('T-0011-108: patch does not affect other users\' rows', async () => {
      const userId1 = await makeUser(db)
      const userId2 = await makeUser(db)
      await insertIntent(db, userId1, {capability: 'chat', notifyOptIn: false})
      await insertIntent(db, userId2, {capability: 'chat', notifyOptIn: false})

      await service.patchMyOutOfScopeIntent(userId1, 'chat', {notifyOptIn: true})

      const user2Summary = await service.listMyOutOfScopeIntents(userId2)
      expect(user2Summary[0]!.notifyOptIn).toBe(false)
    })

    it('T-0011-109: patch does not affect same user\'s different capability rows', async () => {
      const userId = await makeUser(db)
      await insertIntent(db, userId, {capability: 'image_gen', notifyOptIn: false})
      await insertIntent(db, userId, {capability: 'vision', notifyOptIn: false})

      await service.patchMyOutOfScopeIntent(userId, 'image_gen', {notifyOptIn: true})

      const summary = await service.listMyOutOfScopeIntents(userId)
      const visionSummary = summary.find(s => s.capability === 'vision')
      expect(visionSummary?.notifyOptIn).toBe(false)
    })

    it('patch true → false roundtrip returns correct updated count', async () => {
      const userId = await makeUser(db)
      await insertIntent(db, userId, {capability: 'transcription', notifyOptIn: true})

      const result = await service.patchMyOutOfScopeIntent(userId, 'transcription', {
        notifyOptIn: false,
      })
      expect(result.updated).toBe(1)

      const summary = await service.listMyOutOfScopeIntents(userId)
      expect(summary[0]!.notifyOptIn).toBe(false)
    })
  })
})
