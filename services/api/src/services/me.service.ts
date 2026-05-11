/**
 * Me service — ADR-0011 Step 5.
 *
 * Operations (out-of-scope intent reads + notify_opt_in toggle):
 *
 *   listMyOutOfScopeIntents(userId)
 *     → OutOfScopeIntentSummary[]
 *     Grouped by capability, returns count + max(createdAt) + notifyOptIn
 *     for each capability that the user has submitted at least one intent for.
 *     Email is NEVER returned (auth-only field per retro-lessons.md).
 *
 *   patchMyOutOfScopeIntent(userId, capability, {notifyOptIn})
 *     → PatchResult {updated: number}
 *     Updates ALL of the caller's rows for `capability`. Returns count of
 *     updated rows (0 when no matching rows exist — idempotent, always 200).
 *
 * Data sensitivity: auth-only. Email, userId, promptHash are NEVER present
 * in return values. The caller gets only the aggregate view.
 *
 * Closed-enum validation: capability is validated at the route layer
 * (VALID_CAPABILITIES list). The service accepts the pre-validated string.
 */

import {and, count, eq, max, sql} from 'drizzle-orm'
import type {NodePgDatabase} from 'drizzle-orm/node-postgres'

import * as schema from '../db/schema.js'
import {outOfScopeIntent} from '../db/schema.js'

type Db = NodePgDatabase<typeof schema>

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * The aggregate view of a user's out-of-scope intents for one capability.
 * Email is intentionally excluded — auth-only field.
 */
export interface OutOfScopeIntentSummary {
  capability: string
  capturedCount: number
  lastCapturedAt: string // ISO 8601
  notifyOptIn: boolean
}

export interface PatchResult {
  updated: number
}

// ---------------------------------------------------------------------------
// Service interface + factory
// ---------------------------------------------------------------------------

export interface MeService {
  listMyOutOfScopeIntents(userId: string): Promise<OutOfScopeIntentSummary[]>
  patchMyOutOfScopeIntent(
    userId: string,
    capability: string,
    patch: {notifyOptIn: boolean},
  ): Promise<PatchResult>
}

export function createMeService(db: Db): MeService {
  return {
    /**
     * listMyOutOfScopeIntents — groups by capability, returns aggregate.
     *
     * T-0011-102: returns [{capability, lastCapturedAt, capturedCount, notifyOptIn}]
     * T-0011-103: grouped by capability with count + max(createdAt)
     * T-0011-104: only the caller's rows (userId filter)
     * T-0011-105: email NOT returned (excluded from select)
     * T-0011-120: notifyOptIn is read from the notify_opt_in column
     */
    async listMyOutOfScopeIntents(userId: string): Promise<OutOfScopeIntentSummary[]> {
      // Group by (capability, notifyOptIn) — notifyOptIn may differ per row
      // if the PATCH was applied after some rows were inserted. We take
      // max(notifyOptIn::int) so any "true" in the group surfaces.
      // MAX on boolean: cast to int, max, cast back.
      const rows = await db
        .select({
          capability: outOfScopeIntent.capability,
          capturedCount: count(outOfScopeIntent.id),
          lastCapturedAt: max(outOfScopeIntent.createdAt),
          // true wins if any row in the group has notify_opt_in=true
          notifyOptIn: sql<boolean>`(max(${outOfScopeIntent.notifyOptIn}::int) = 1)`,
        })
        .from(outOfScopeIntent)
        .where(eq(outOfScopeIntent.userId, userId))
        .groupBy(outOfScopeIntent.capability)

      return rows.map(r => ({
        capability: r.capability,
        capturedCount: Number(r.capturedCount),
        lastCapturedAt:
          r.lastCapturedAt instanceof Date
            ? r.lastCapturedAt.toISOString()
            : String(r.lastCapturedAt),
        notifyOptIn: Boolean(r.notifyOptIn),
      }))
    },

    /**
     * patchMyOutOfScopeIntent — updates all caller's rows for capability.
     *
     * T-0011-107: updates all rows for capability/user combo
     * T-0011-110: returns {updated: 0} when no rows match (idempotent)
     * T-0011-111: only updates the caller's rows (userId + capability filter)
     */
    async patchMyOutOfScopeIntent(
      userId: string,
      capability: string,
      patch: {notifyOptIn: boolean},
    ): Promise<PatchResult> {
      const result = await db
        .update(outOfScopeIntent)
        .set({notifyOptIn: patch.notifyOptIn})
        .where(
          and(
            eq(outOfScopeIntent.userId, userId),
            eq(outOfScopeIntent.capability, capability),
          ),
        )
        .returning({id: outOfScopeIntent.id})

      return {updated: result.length}
    },
  }
}
