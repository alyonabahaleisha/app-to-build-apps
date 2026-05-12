/**
 * ShareSheet — minimal action handler for the share / copy-link surface.
 *
 * ADR-0008 Step 6. Owns the data-flow contract; sheet presentation UX
 * (bottom sheet, coachmark, celebration) is owned by ADR-0011's host shell.
 *
 * This module exports:
 *   `useShareAction` — hook that returns `handleShare`, consuming
 *     `useCreateShareLinkMutation` and adapting the ToastProvider to the
 *     `ShareToast` interface expected by the mutation hook.
 *
 * Constraints:
 *   - No navigation calls — that lives in RunScreen / host shell.
 *   - No bottom-sheet presentation — caller owns that.
 *   - Clipboard write + haptic + telemetry are delegated to the mutation hook.
 */
import {useCallback} from 'react'

import {useToast} from '#/components/ToastProvider'
import {
  useCreateShareLinkMutation,
  type ShareToast,
} from '#/state/queries/shareLinks'

export interface UseShareActionOptions {
  miniAppId: string
  /** Optional callback invoked before the API call (e.g. to dismiss a sheet). */
  onBeforeShare?: () => void
}

export interface UseShareActionResult {
  /** Fire to trigger POST /me/mini-apps/:id/share → clipboard → haptic → toast. */
  handleShare: () => void
  /** True while the mutation is in-flight. */
  isPending: boolean
}

/**
 * `useShareAction` — composes useCreateShareLinkMutation with the ambient
 * ToastProvider to expose a single `handleShare` callback for RunScreen.
 *
 * T-0008-133..143b all flow through the mutation hook; this layer only
 * bridges the toast context and the pre-share callback.
 */
export function useShareAction({
  miniAppId,
  onBeforeShare,
}: UseShareActionOptions): UseShareActionResult {
  const rawToast = useToast()

  // Adapt ToastProvider's `.show(msg, {variant})` to the mutation's
  // `{success, error}` interface — keeps the mutation hook decoupled from
  // the app-shell ToastProvider shape.
  const toast: ShareToast = {
    success: (message: string) => rawToast.show(message),
    error: (message: string) => rawToast.show(message, {variant: 'error'}),
  }

  const mutation = useCreateShareLinkMutation(toast)

  const handleShare = useCallback(() => {
    onBeforeShare?.()
    mutation.mutate(miniAppId)
  }, [miniAppId, mutation, onBeforeShare])

  return {
    handleShare,
    isPending: mutation.isPending,
  }
}
