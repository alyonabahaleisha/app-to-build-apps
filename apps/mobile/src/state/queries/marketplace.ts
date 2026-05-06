/**
 * Marketplace domain — TanStack Query hooks for publish/unpublish/handle operations.
 *
 * Per CLAUDE.md §2: query keys via `createQueryKey`; fetchers via `apiFetch`.
 * ADR-0002 Step 9.
 *
 * Error handling: `apiFetch` throws `ApiError` on non-2xx. `mutationFn`
 * catches these and re-throws as typed `PublishError` so callers can
 * discriminate error codes without parsing raw strings.
 */
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'

import {apiFetch, ApiError} from '#/lib/api'
import {createQueryKey, STALE} from '#/state/queries/util'
import {projectsKeys} from '#/state/queries/projects'

// -- Error class -------------------------------------------------------------

export class PublishError extends Error {
  readonly code: PublishErrorCode
  constructor(code: PublishErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'PublishError'
    this.code = code
  }
}

export type PublishErrorCode =
  | 'handle_required'
  | 'invalid_handle'
  | 'handle_reserved'
  | 'handle_taken'
  | 'handle_immutable'
  | 'not_found'
  | 'invalid_state'
  | 'internal'
  | 'network'

// -- Query keys --------------------------------------------------------------

export const marketplaceKeys = {
  handleCheck: (h: string) => createQueryKey('marketplace', 'handleCheck', {h}),
  handleSuggest: () => createQueryKey('marketplace', 'handleSuggest'),
} as const

// -- Types -------------------------------------------------------------------

export interface PublishInput {
  projectId: string
  handle?: string
}

export interface PublishResult {
  project: {
    id: string
    visibility: 'public'
    publishedAt: string
    authorHandle: string
  }
}

export interface UnpublishInput {
  projectId: string
}

export interface UnpublishResult {
  project: {
    id: string
    visibility: 'private'
  }
}

export interface SetHandleInput {
  handle: string
}

export interface SetHandleResult {
  handle: string
}

export interface HandleCheckResult {
  available: boolean
  reason?: 'taken' | 'reserved' | 'invalid'
}

export interface HandleSuggestResult {
  handle: string
}

// -- Helpers -----------------------------------------------------------------

/**
 * Parse an `ApiError` body (JSON string) and extract the `error` field.
 * Returns 'internal' if parsing fails.
 */
function parseErrorCode(err: ApiError): PublishErrorCode {
  try {
    const body = JSON.parse(err.body) as {error?: string}
    const code = body.error
    const KNOWN: PublishErrorCode[] = [
      'handle_required',
      'invalid_handle',
      'handle_reserved',
      'handle_taken',
      'handle_immutable',
      'not_found',
      'invalid_state',
      'internal',
    ]
    if (typeof code === 'string' && (KNOWN as string[]).includes(code)) {
      return code as PublishErrorCode
    }
    return 'internal'
  } catch {
    return 'internal'
  }
}

function toPublishError(err: unknown): PublishError {
  if (err instanceof PublishError) return err
  if (err instanceof ApiError) {
    return new PublishError(parseErrorCode(err))
  }
  if (err instanceof TypeError) {
    // fetch throws TypeError on network failure in RN.
    return new PublishError('network')
  }
  return new PublishError('internal')
}

// -- Hooks -------------------------------------------------------------------

/**
 * `usePublishMutation` — POST /projects/:id/publish
 *
 * Invalidates the project detail + list on success so AppRunner and Home
 * both see the updated visibility immediately.
 */
export function usePublishMutation() {
  const qc = useQueryClient()
  return useMutation<PublishResult, PublishError, PublishInput>({
    mutationFn: async ({projectId, handle}) => {
      try {
        return await apiFetch<PublishResult>(`/projects/${projectId}/publish`, {
          method: 'POST',
          body: JSON.stringify(handle ? {handle} : {}),
        })
      } catch (err) {
        throw toPublishError(err)
      }
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({queryKey: projectsKeys.detail(vars.projectId)})
      void qc.invalidateQueries({queryKey: projectsKeys.list()})
    },
    retry: false,
  })
}

/**
 * `useUnpublishMutation` — POST /projects/:id/unpublish
 *
 * Invalidates the project detail + list on success.
 */
export function useUnpublishMutation() {
  const qc = useQueryClient()
  return useMutation<UnpublishResult, PublishError, UnpublishInput>({
    mutationFn: async ({projectId}) => {
      try {
        return await apiFetch<UnpublishResult>(`/projects/${projectId}/unpublish`, {
          method: 'POST',
          body: JSON.stringify({}),
        })
      } catch (err) {
        throw toPublishError(err)
      }
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({queryKey: projectsKeys.detail(vars.projectId)})
      void qc.invalidateQueries({queryKey: projectsKeys.list()})
    },
    retry: false,
  })
}

/**
 * `useSetHandleMutation` — POST /users/me/handle
 *
 * Used when the user sets a handle independently of the publish flow.
 */
export function useSetHandleMutation() {
  return useMutation<SetHandleResult, PublishError, SetHandleInput>({
    mutationFn: async ({handle}) => {
      try {
        return await apiFetch<SetHandleResult>('/users/me/handle', {
          method: 'POST',
          body: JSON.stringify({handle}),
        })
      } catch (err) {
        throw toPublishError(err)
      }
    },
    retry: false,
  })
}

/**
 * `useCheckHandleQuery` — GET /handles/check?h=<handle>
 *
 * Short stale time (30s) because availability changes on other users' publish
 * events. `retry: false` — if the check fails, we don't silently proceed.
 * `enabled` must be set to false when handle is empty or callers want to skip.
 */
export function useCheckHandleQuery(handle: string, enabled: boolean) {
  return useQuery<HandleCheckResult, Error>({
    queryKey: marketplaceKeys.handleCheck(handle),
    queryFn: () => apiFetch<HandleCheckResult>(`/handles/check?h=${encodeURIComponent(handle)}`),
    enabled: enabled && handle.length > 0,
    staleTime: STALE.SECONDS(30),
    retry: false,
  })
}

/**
 * `useHandleSuggestQuery` — GET /me/handle/suggest
 *
 * Returns a server-sanitized handle suggestion derived from the user's email.
 * Called once when the first-time publish sheet opens. Long stale time — the
 * suggestion doesn't change unless the user's email changes.
 */
export function useHandleSuggestQuery(enabled: boolean) {
  return useQuery<HandleSuggestResult, Error>({
    queryKey: marketplaceKeys.handleSuggest(),
    queryFn: () => apiFetch<HandleSuggestResult>('/me/handle/suggest'),
    enabled,
    staleTime: STALE.MINUTES(60),
    retry: false,
  })
}
