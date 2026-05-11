/**
 * Out-of-scope intents domain — TanStack Query hooks for the user's
 * out-of-scope intent summaries and notify opt-in mutation.
 *
 * ADR-0011 Step 5.
 *
 * Endpoints:
 *   GET  /me/out-of-scope-intents → {intents: OutOfScopeIntentSummary[]}
 *   PATCH /me/out-of-scope-intents/:capability → {updated: number}
 *
 * Data sensitivity: email, userId, promptHash are NEVER present in the
 * server response. The summary shape only exposes the aggregate view.
 *
 * Mutation pattern (CLAUDE.md §2):
 *   useUpdateNotifyOptInMutation implements the previous-snapshot optimistic
 *   update: onMutate cancels + saves snapshot; onError restores; onSettled
 *   invalidates.
 */
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'

import {apiFetch} from '#/lib/api'
import {createQueryKey, STALE} from '#/state/queries/util'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface OutOfScopeIntentSummary {
  capability: string
  capturedCount: number
  lastCapturedAt: string // ISO 8601
  notifyOptIn: boolean
}

// ---------------------------------------------------------------------------
// Shape error — thrown when the API response doesn't match expected shape.
// TanStack Query propagates this into the `error` slot.
// ---------------------------------------------------------------------------

export class OutOfScopeIntentShapeError extends Error {
  readonly issue: string
  constructor(issue: string) {
    super(`outOfScopeIntents: shape mismatch — ${issue}`)
    this.name = 'OutOfScopeIntentShapeError'
    this.issue = issue
  }
}

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const outOfScopeIntentsKeys = {
  list: () => createQueryKey('outOfScopeIntents', 'list'),
} as const

// ---------------------------------------------------------------------------
// Response parsers (defense-in-depth)
// ---------------------------------------------------------------------------

function parseSummary(raw: unknown, index: number): OutOfScopeIntentSummary {
  if (typeof raw !== 'object' || raw === null) {
    throw new OutOfScopeIntentShapeError(`item[${index}] is not an object`)
  }
  const r = raw as Record<string, unknown>

  if (typeof r.capability !== 'string') {
    throw new OutOfScopeIntentShapeError(`item[${index}].capability is missing or not a string`)
  }
  if (typeof r.capturedCount !== 'number') {
    throw new OutOfScopeIntentShapeError(`item[${index}].capturedCount is missing or not a number`)
  }
  if (typeof r.lastCapturedAt !== 'string') {
    throw new OutOfScopeIntentShapeError(
      `item[${index}].lastCapturedAt is missing or not a string`,
    )
  }
  if (typeof r.notifyOptIn !== 'boolean') {
    throw new OutOfScopeIntentShapeError(`item[${index}].notifyOptIn is missing or not a boolean`)
  }

  return {
    capability: r.capability,
    capturedCount: r.capturedCount,
    lastCapturedAt: r.lastCapturedAt,
    notifyOptIn: r.notifyOptIn,
  }
}

function parseListResponse(raw: unknown): OutOfScopeIntentSummary[] {
  if (typeof raw !== 'object' || raw === null) {
    throw new OutOfScopeIntentShapeError('response is not an object')
  }
  const r = raw as Record<string, unknown>
  if (!Array.isArray(r.intents)) {
    throw new OutOfScopeIntentShapeError('response.intents is not an array')
  }
  return r.intents.map((item, i) => parseSummary(item, i))
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * useOutOfScopeIntentsQuery — fetches the current user's out-of-scope intent
 * summaries grouped by capability.
 */
export function useOutOfScopeIntentsQuery() {
  return useQuery({
    queryKey: outOfScopeIntentsKeys.list(),
    queryFn: async () => {
      const raw = await apiFetch<unknown>('/me/out-of-scope-intents')
      return parseListResponse(raw)
    },
    staleTime: STALE.MINUTES(5),
  })
}

/**
 * useUpdateNotifyOptInMutation — optimistically toggles notifyOptIn for all
 * of the caller's rows for the given capability.
 *
 * Optimistic update: flips the matching summary in cache immediately.
 * Rollback: restores previous list on error.
 * Settlement: always invalidates to sync with server.
 */
export function useUpdateNotifyOptInMutation() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({capability, notifyOptIn}: {capability: string; notifyOptIn: boolean}) =>
      apiFetch<{updated: number}>(`/me/out-of-scope-intents/${capability}`, {
        method: 'PATCH',
        body: JSON.stringify({notifyOptIn}),
      }),
    onMutate: async ({capability, notifyOptIn}) => {
      await qc.cancelQueries({queryKey: outOfScopeIntentsKeys.list()})
      const previous = qc.getQueryData<OutOfScopeIntentSummary[]>(outOfScopeIntentsKeys.list())

      qc.setQueryData<OutOfScopeIntentSummary[]>(outOfScopeIntentsKeys.list(), old => {
        if (!old) return old
        return old.map(item =>
          item.capability === capability ? {...item, notifyOptIn} : item,
        )
      })

      return {previous}
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous !== undefined) {
        qc.setQueryData(outOfScopeIntentsKeys.list(), ctx.previous)
      }
    },
    onSettled: () => {
      qc.invalidateQueries({queryKey: outOfScopeIntentsKeys.list()})
    },
  })
}
