/**
 * Share-link domain — TanStack mutation for POST /me/mini-apps/:id/share.
 *
 * ADR-0008 Step 6.
 *
 * Responsibilities:
 *   - Call the share endpoint and return {share_id, universal_link}.
 *   - Copy the universal_link to clipboard via setClipboardString (async
 *     wrapper over react-native Clipboard.setString) — wrapped in try/catch
 *     so clipboard failure is surfaced without haptic or success toast.
 *   - Fire haptic feedback after a confirmed clipboard write.
 *   - Emit `share_link_copied` telemetry with whitelisted payload.
 *   - Show success or error toast.
 *
 * T-0008-143b (P1-1 pin):
 *   Clipboard failure order — if setClipboardString rejects:
 *     1. logger.error('clipboard_set_failed')
 *     2. toast.error("Couldn't copy the link. Long-press the share link to copy manually.")
 *     3. return — NO haptic, NO telemetry, NO success toast
 *   Rationale: success toast for a failed copy is worse than the error toast
 *   because the user may paste a stale clipboard value into iMessage.
 */
import {useMutation} from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'

import {apiFetch} from '#/lib/api'
import {logger, safeMessage} from '#/logger'
import {writeEvent} from '#/lib/telemetry'

// -- Types -------------------------------------------------------------------

export interface ShareLinkResult {
  share_id: string
  universal_link: string
}

// -- Clipboard abstraction ---------------------------------------------------
//
// react-native's Clipboard.setString is synchronous and does not return a
// Promise. We wrap it so callers can await it and so tests can mock the
// resolved/rejected path without adding a hard dependency on expo-clipboard.
// Exported for testing: tests can mock this module and make setClipboardString
// reject to exercise T-0008-143b.

import {Clipboard} from 'react-native'

export function setClipboardString(value: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    try {
      Clipboard.setString(value)
      resolve()
    } catch (err) {
      reject(err)
    }
  })
}

// -- Toast messenger type (injected so component-free hook stays testable) ---

export interface ShareToast {
  success: (message: string) => void
  error: (message: string) => void
}

// -- Copy strings ------------------------------------------------------------

export const SHARE_LINK_COPY = {
  linkCopied: 'Link copied',
  clipboardError: "Couldn't copy the link. Long-press the share link to copy manually.",
  createError: "Couldn't create a share link. Try again.",
  rateLimited: 'Try again in a moment.',
} as const

// -- Hook options ------------------------------------------------------------

export interface CreateShareLinkMutationOptions {
  /**
   * Clipboard write implementation. Defaults to `setClipboardString`.
   * Injectable for testing — lets tests mock the async clipboard path without
   * relying on Jest module-factory override limitations.
   * T-0008-143b requires this to be awaitable and catchable.
   */
  setClipboard?: (value: string) => Promise<void>
}

// -- Hook --------------------------------------------------------------------

/**
 * `useCreateShareLinkMutation` — POST /me/mini-apps/:id/share
 *
 * Accepts a `toast` injector so the hook can be used outside a component
 * tree in tests without a ToastProvider.
 *
 * Accepts `setClipboard` for testing the T-0008-143b clipboard-fail path.
 *
 * T-0008-133..143b.
 */
export function useCreateShareLinkMutation(
  toast: ShareToast,
  opts: CreateShareLinkMutationOptions = {},
) {
  const setClipboard = opts.setClipboard ?? setClipboardString

  return useMutation<ShareLinkResult, Error, string>({
    mutationFn: (miniAppId: string) =>
      apiFetch<ShareLinkResult>(`/me/mini-apps/${miniAppId}/share`, {
        method: 'POST',
      }),

    onSuccess: async (result) => {
      // T-0008-143b: clipboard first — if it fails, skip haptic / telemetry / success toast.
      try {
        await setClipboard(result.universal_link)
      } catch (err) {
        logger.error('clipboard_set_failed', {safeMessage: safeMessage(err)})
        toast.error(SHARE_LINK_COPY.clipboardError)
        return
      }

      // Clipboard confirmed written — now haptic, telemetry, success toast (in order).
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

      // share_id_prefix: first 4 chars of ksuid — anonymous time-bucket, no PII.
      writeEvent({
        eventType: 'share_link_copied',
        share_id_prefix: result.share_id.slice(0, 4),
      })

      toast.success(SHARE_LINK_COPY.linkCopied)
    },

    onError: (err) => {
      logger.error('share_create_failed', {safeMessage: safeMessage(err)})
      if ((err as {status?: number}).status === 429) {
        toast.error(SHARE_LINK_COPY.rateLimited)
        return
      }
      toast.error(SHARE_LINK_COPY.createError)
    },
  })
}
