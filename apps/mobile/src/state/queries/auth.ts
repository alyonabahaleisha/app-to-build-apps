/**
 * Auth domain — TanStack Query mutations for the magic-link flow.
 *
 * Per CLAUDE.md §2: query keys built via `createQueryKey` (no inline
 * literals); fetcher routed through `apiFetch`. The magic-link route is
 * classified as public in `apiFetch`'s `PUBLIC_PATH_PREFIXES`, so no
 * session is required to call it.
 */
import {useMutation, type UseMutationResult} from '@tanstack/react-query'

import {apiFetch, ApiError} from '#/lib/api'
import {createQueryKey} from '#/state/queries/util'

export const authKeys = {
  magicLink: () => createQueryKey('auth', 'magicLink'),
} as const

export interface MagicLinkInput {
  email: string
}

export interface MagicLinkResult {
  /** Server returns `{sent: true}` on success — we don't depend on shape. */
  sent: true
}

export type MagicLinkError = ApiError | Error

/**
 * `useMagicLinkMutation` — fires `POST /auth/magic-link {email}`.
 *
 * The button-double-tap-debounce (T-0001-126) is enforced at the call site
 * via `mutation.isPending` — the second tap is ignored because the Send
 * button is disabled while in flight.
 */
export function useMagicLinkMutation(): UseMutationResult<
  MagicLinkResult,
  MagicLinkError,
  MagicLinkInput
> {
  return useMutation<MagicLinkResult, MagicLinkError, MagicLinkInput>({
    mutationKey: authKeys.magicLink(),
    mutationFn: async ({email}: MagicLinkInput) => {
      return apiFetch<MagicLinkResult>('/auth/magic-link', {
        method: 'POST',
        body: JSON.stringify({email}),
      })
    },
    // Network errors surface to the caller via `onError`. We DON'T retry
    // automatically because (a) the server may have already sent the
    // email, and (b) rate-limit responses (429) shouldn't be retried at
    // the client layer.
    retry: false,
  })
}

/**
 * Inspect a mutation error and classify it. Centralized so the screen
 * doesn't sprinkle status-code branches in JSX. Per ARCHITECTURE.md §11:
 * the return values are stable enums — copy mapping happens in the screen's
 * `copy.ts` so future i18n codemod can wrap the literals.
 */
export type MagicLinkErrorKind = 'rate_limited' | 'offline' | 'server'

export function classifyMagicLinkError(err: unknown): MagicLinkErrorKind {
  if (err instanceof ApiError) {
    if (err.status === 429) return 'rate_limited'
    return 'server'
  }
  // `fetch` throws a `TypeError` with a "Network request failed" message
  // when offline on RN. We catch the broad case here and surface it as
  // 'offline' so the screen can show the offline copy variant.
  if (err instanceof TypeError) return 'offline'
  return 'server'
}
