/**
 * LinkingProvider — Universal Link dispatch wired at app root.
 *
 * ADR-0011 Step 12 (surface) + ADR-0008 clone logic integrated per
 * the Sprint 12 implementation brief.
 *
 * Mount position: inside <SessionProvider> and <ToastProvider>, outside
 * <NavigationContainer>. Navigation to SignIn is implicit — when the session
 * is unauthenticated, Navigation.tsx already renders <SignInScreen>. We only
 * need to persist the pending intent; useNavigation() is intentionally absent
 * (it would require being inside a NavigationContainer, which this provider
 * is not).
 *
 * Flows:
 *   1. Clone link + authed  → cloneMutation.mutate(shareId) immediately.
 *   2. Clone link + unauthed → setPendingClone(shareId); session-driven nav
 *      shows SignIn automatically (Navigation.tsx conditional stack).
 *   3. Reserved mode (view/remix) → "Coming soon" toast.
 *   4. Post-SIWA replay → useEffect([status]) detects unauthenticated→authenticated
 *      transition; pops pendingClone and fires mutation if a share_id was stored.
 *
 * Telemetry for clone events lives entirely inside useCloneMutation's onSuccess
 * (link_clone_opened). LinkingProvider does NOT write telemetry directly; it
 * delegates to the mutation. This ensures the whitelist and prefix-hashing
 * contract (T-0011-309) is only in one place.
 */
import {createContext, useCallback, useContext, useEffect, useRef, type ReactNode} from 'react'

import {useToast} from '#/components/ToastProvider'
import {popPendingClone, setPendingClone} from '#/lib/pendingClone'
import {useUniversalLink, type ParsedUniversalLink} from '#/lib/universalLink'
import {logger, safeMessage} from '#/logger'
import {useCloneMutation} from '#/state/queries/clones'
import {useSession} from '#/state/session/useSession'

// ---------------------------------------------------------------------------
// Public surface (ADR-0011 Step 12 contract)
// ---------------------------------------------------------------------------

export interface LinkingHandlers {
  /** Called when the app receives a /m/{share_id}/clone Universal Link. */
  onCloneLinkOpen: (shareId: string, source: 'cold' | 'warm' | 'deferred') => Promise<void>
  /** Called when the app receives an unsupported universal-link mode (e.g. 'view', 'remix'). */
  onUnsupportedMode: (mode: string, shareId: string) => void
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const LinkingContext = createContext<LinkingHandlers | null>(null)
LinkingContext.displayName = 'LinkingContext'

// ---------------------------------------------------------------------------
// Toast copy — kept here so the reserved-mode message is in one place.
// ---------------------------------------------------------------------------

const COMING_SOON_MESSAGE = 'Coming soon — preview and remix arrive in V0.5.'

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function LinkingProvider({children}: {children: ReactNode}) {
  const session = useSession()
  const cloneMutation = useCloneMutation()
  const toast = useToast()

  // Tracks the previous session status so we can detect the
  // unauthenticated → authenticated transition for SIWA replay.
  const prevStatusRef = useRef(session.status)
  // Guard against firing the replay effect more than once per transition.
  const replayFiredRef = useRef(false)

  // -- Handlers --------------------------------------------------------------

  const onUnsupportedMode = useCallback(
    (mode: string, _shareId: string) => {
      // No client-side telemetry — ADR-0008 Step 7's server-side
      // `share_link.reserved_mode_viewed` covers this event.
      logger.info(`linking: reserved mode '${mode}' received — showing coming soon toast`)
      toast.show(COMING_SOON_MESSAGE)
    },
    [toast],
  )

  const onCloneLinkOpen = useCallback(
    async (shareId: string, _source: 'cold' | 'warm' | 'deferred'): Promise<void> => {
      if (session.status === 'authenticated') {
        cloneMutation.mutate({shareId})
      } else {
        // Unauthenticated: persist intent, then navigation to SignIn is
        // handled implicitly — Navigation.tsx renders <SignIn> when
        // session.status !== 'authenticated'.
        try {
          await setPendingClone(shareId)
        } catch (err) {
          logger.warn('linking: setPendingClone failed', {safeMessage: safeMessage(err)})
        }
      }
    },
    [session.status, cloneMutation.mutate],
  )

  // -- Universal Link wiring -------------------------------------------------

  const handleActiveLink = useCallback(
    (link: ParsedUniversalLink) => {
      void onCloneLinkOpen(link.shareId, 'warm')
    },
    [onCloneLinkOpen],
  )

  const handleReservedMode = useCallback(
    (link: ParsedUniversalLink) => {
      onUnsupportedMode(link.mode, link.shareId)
    },
    [onUnsupportedMode],
  )

  useUniversalLink({
    onActiveLink: handleActiveLink,
    onReservedMode: handleReservedMode,
  })

  // -- Post-SIWA replay ------------------------------------------------------
  // When session transitions from any non-authenticated state to authenticated,
  // pop any pending clone intent and fire the mutation.
  // The ref guard ensures this fires at most once per transition even if the
  // component re-renders multiple times after the flip.

  useEffect(() => {
    const wasUnauthed = prevStatusRef.current !== 'authenticated'
    const isNowAuthed = session.status === 'authenticated'

    if (wasUnauthed && isNowAuthed && !replayFiredRef.current) {
      replayFiredRef.current = true
      void (async () => {
        try {
          const pendingShareId = await popPendingClone()
          if (pendingShareId) {
            cloneMutation.mutate({shareId: pendingShareId})
          }
        } catch (err) {
          logger.warn('linking: post-SIWA popPendingClone failed', {
            safeMessage: safeMessage(err),
          })
        }
      })()
    }

    // Reset the guard when session leaves authenticated (sign-out → ready
    // for a fresh transition on next sign-in).
    if (prevStatusRef.current === 'authenticated' && session.status !== 'authenticated') {
      replayFiredRef.current = false
    }

    prevStatusRef.current = session.status
    // cloneMutation.mutate is stable (TanStack Query guarantees it).
  }, [session.status, cloneMutation.mutate])

  // -- Context value ---------------------------------------------------------

  const value: LinkingHandlers = {onCloneLinkOpen, onUnsupportedMode}

  return <LinkingContext.Provider value={value}>{children}</LinkingContext.Provider>
}

// ---------------------------------------------------------------------------
// Consumer hook
// ---------------------------------------------------------------------------

/**
 * Returns the `LinkingHandlers` registered at the nearest `<LinkingProvider>`.
 * Throws if called outside the provider.
 */
export function useLinkingHandlers(): LinkingHandlers {
  const value = useContext(LinkingContext)
  if (value === null) {
    throw new Error('useLinkingHandlers() must be used within <LinkingProvider>')
  }
  return value
}
