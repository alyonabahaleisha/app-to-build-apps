/**
 * Universal Link handler for App Creator share links.
 *
 * URL contract (ADR-0008 §3):
 *   https://canvas.app/m/{share_id}/{mode}
 *
 * Where:
 *   share_id — exactly 24 alphanumeric chars [0-9A-Za-z]
 *   mode     — one of 'clone' (active) | 'view' | 'remix' (reserved)
 *
 * Two surfaces:
 *   parseUniversalLink(url)    — pure parser, no side effects
 *   useUniversalLink(opts)     — React hook, wires iOS Linking events
 *
 * Intentionally independent of deepLink.ts / parseAuthDeepLink. The M1
 * custom-scheme handler (appcreator://auth) and this module share no code —
 * they handle different URL surfaces on different OS channels.
 */
import * as Linking from 'expo-linking'
import {useEffect} from 'react'

export interface ParsedUniversalLink {
  shareId: string
  mode: 'clone' | 'view' | 'remix'
}

const SHARE_ID_PATTERN = /^[0-9A-Za-z]{24}$/

// Modes that trigger an immediate clone flow.
const ACTIVE_MODES = ['clone'] as const
// Modes recognized by the schema but not yet actionable in-app (reserved for
// future use). They fire onReservedMode so callers can show an appropriate
// message without silently dropping the intent.
const RESERVED_MODES = ['view', 'remix'] as const

type ActiveMode = (typeof ACTIVE_MODES)[number]
type ReservedMode = (typeof RESERVED_MODES)[number]

function isActiveMode(mode: string): mode is ActiveMode {
  return (ACTIVE_MODES as readonly string[]).includes(mode)
}

function isReservedMode(mode: string): mode is ReservedMode {
  return (RESERVED_MODES as readonly string[]).includes(mode)
}

// Path pattern: /m/{share_id}/{mode} with optional trailing slash.
// Does NOT match /m/{id}/{mode}/extra (no extra segments).
const PATH_PATTERN = /^\/m\/([^/]+)\/([^/]+)\/?$/

/**
 * Pure parser — converts a raw URL string to a ParsedUniversalLink or null.
 *
 * Returns null for:
 *   - null / empty string input
 *   - URLs that fail to parse (malformed)
 *   - non-HTTPS protocol (AC-P7)
 *   - host other than canvas.app (AC-P7)
 *   - path not matching /m/{id}/{mode} exactly
 *   - share_id that doesn't satisfy SHARE_ID_PATTERN (24 alphanumeric)
 *   - mode not in the recognized closed set (silently dropped)
 *
 * Query strings and fragments are accepted and ignored.
 */
export function parseUniversalLink(url: string | null): ParsedUniversalLink | null {
  if (!url) return null

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  // AC-P7: must be https://canvas.app
  if (parsed.protocol !== 'https:' || parsed.host !== 'canvas.app') return null

  const match = PATH_PATTERN.exec(parsed.pathname)
  if (!match) return null

  const shareId = match[1]!
  const mode = match[2]!

  if (!SHARE_ID_PATTERN.test(shareId)) return null

  if (!isActiveMode(mode) && !isReservedMode(mode)) return null

  return {shareId, mode: mode as ParsedUniversalLink['mode']}
}

export interface UseUniversalLinkOptions {
  /**
   * Called when a clone-mode URL is received (cold or warm start).
   * Step 5 wires this to setPendingClone + navigation.
   */
  onActiveLink: (link: ParsedUniversalLink) => void
  /**
   * Called when a reserved-mode URL (view / remix) is received.
   * Step 5 / Phase 3 wires this to the appropriate UI flow.
   */
  onReservedMode: (link: ParsedUniversalLink) => void
}

/**
 * Hook that wires iOS Universal Link events to the caller's handlers.
 *
 * Cold start: reads the URL that launched the app via Linking.getInitialURL().
 * Warm start: subscribes to Linking 'url' events for links tapped while the
 *             app is running.
 *
 * Note on useEffect: ADR-0006 §K bans useEffect in packages/a2ui-renderer
 * only. This module is in apps/mobile/src/lib — the ban does not apply.
 *
 * Note on deduplication: the OS guarantees no duplicate Linking events, but
 * this hook deliberately does not dedup (T-0008-110). If the OS fires the
 * same URL twice, onActiveLink fires twice. This keeps the hook simple and
 * lets callers enforce their own idempotency.
 */
export function useUniversalLink(opts: UseUniversalLinkOptions): void {
  const {onActiveLink, onReservedMode} = opts

  useEffect(() => {
    // Cold start: the URL that caused the app to open (null if none).
    void Linking.getInitialURL().then(url => {
      const parsed = parseUniversalLink(url)
      if (!parsed) return
      if (isActiveMode(parsed.mode)) {
        onActiveLink(parsed)
      } else {
        onReservedMode(parsed)
      }
    })

    // Warm start: URLs arriving while the app is foregrounded.
    const sub = Linking.addEventListener('url', ({url}) => {
      const parsed = parseUniversalLink(url)
      if (!parsed) return
      if (isActiveMode(parsed.mode)) {
        onActiveLink(parsed)
      } else {
        onReservedMode(parsed)
      }
    })

    return () => {
      sub.remove()
    }
    // opts callbacks are destructured above so we use stable references.
    // Callers must stabilize their callbacks (useCallback or module-level
    // definitions) if they want to avoid effect re-runs on every render.
    // Step 5 will wire stable callbacks from the SessionProvider.
  }, [onActiveLink, onReservedMode])
}
