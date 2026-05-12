/**
 * Clones domain — TanStack Query mutation for POST /mini-apps/clone.
 *
 * ADR-0008 Step 5: the clone mutation is triggered either:
 *   (a) directly, when the user taps a share link while authenticated, or
 *   (b) via pendingClone replay, after SIWA completes.
 *
 * Error discrimination:
 *   404 → "This tool is no longer available." (app deleted or never existed)
 *   410 → "This share link has been revoked." (revoked_at set)
 *   network → generic toast; mutation rejects so the caller may handle retry
 *
 * Zombie-intent prevention (T-0008-131):
 *   The pending intent is popped before mutate() is called. If the mutation
 *   fails, it does NOT re-persist — the user must re-tap the link.
 *
 * Telemetry (T-0008-132):
 *   On success, `link_clone_opened` is emitted with {share_id_prefix, mode}.
 *   On failure, no telemetry is emitted (the clone never completed server-side).
 */
import {useMutation, useQueryClient} from '@tanstack/react-query'

import {apiFetch, ApiError} from '#/lib/api'
import {logger, safeMessage} from '#/logger'
import {writeEvent} from '#/lib/telemetry'
import {miniAppsKeys} from '#/state/queries/miniApps'

// -- Types -------------------------------------------------------------------

export interface CloneInput {
  shareId: string
  /** The Universal Link mode that triggered the clone ('view' | 'remix'). */
  mode?: 'view' | 'remix'
}

export interface CloneResult {
  miniApp: {
    id: string
    title: string
  }
}

// -- Error class -------------------------------------------------------------

export type CloneErrorCode = 'not_found' | 'revoked' | 'network' | 'internal'

export class CloneError extends Error {
  readonly code: CloneErrorCode
  constructor(code: CloneErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'CloneError'
    this.code = code
  }
}

// -- Toast messages ----------------------------------------------------------

export const CLONE_TOAST_MESSAGES: Record<CloneErrorCode, string> = {
  not_found: 'This tool is no longer available.',
  revoked: 'This share link has been revoked.',
  network: 'Something went wrong. Please try again.',
  internal: 'Something went wrong. Please try again.',
}

// -- Error mapping -----------------------------------------------------------

function toCloneError(err: unknown): CloneError {
  if (err instanceof CloneError) return err
  if (err instanceof ApiError) {
    if (err.status === 404) return new CloneError('not_found')
    if (err.status === 410) return new CloneError('revoked')
    return new CloneError('internal')
  }
  if (err instanceof TypeError) {
    // fetch throws TypeError on network failure in RN.
    return new CloneError('network')
  }
  return new CloneError('internal')
}

// -- Hook --------------------------------------------------------------------

/**
 * `useCloneMutation` — POST /mini-apps/clone
 *
 * On success:
 *   - invalidates miniAppsKeys.list() so Library refreshes
 *   - emits `link_clone_opened` telemetry
 *
 * On error:
 *   - throws a typed `CloneError` so callers can drive toast copy from `code`
 *   - does NOT re-persist the pending intent (zombie-intent prevention)
 *
 * T-0008-125, T-0008-126, T-0008-127, T-0008-128, T-0008-129, T-0008-132.
 */
export function useCloneMutation() {
  const qc = useQueryClient()

  return useMutation<CloneResult, CloneError, CloneInput>({
    mutationFn: async ({shareId}) => {
      try {
        return await apiFetch<CloneResult>('/mini-apps/clone', {
          method: 'POST',
          body: JSON.stringify({shareId}),
        })
      } catch (err) {
        throw toCloneError(err)
      }
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({queryKey: miniAppsKeys.list()})
      try {
        writeEvent({
          eventType: 'link_clone_opened',
          share_id_prefix: vars.shareId.slice(0, 4),
          mode: vars.mode ?? 'view',
        })
      } catch (err) {
        // Telemetry failure is non-fatal.
        logger.error('link_clone_opened_telemetry_failed', {safeMessage: safeMessage(err)})
      }
    },
    onSettled: () => {
      void qc.invalidateQueries({queryKey: miniAppsKeys.list()})
    },
    retry: false,
  })
}
