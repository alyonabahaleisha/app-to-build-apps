/**
 * Stack param lists for all navigators.
 *
 * ADR-0011 Step 8: added 'Library', 'Run', 'Create' screen names.
 * ADR-0011 Step 9: added 'Generating', 'OutOfScope', 'QuotaExhausted'.
 * ADR-0011 Step 10: 'AppRunner' removed; 'Run' is now the only run-mode screen.
 * Removed 'Home' (M1 screen deleted in Step 8).
 * 'Chat' and 'AppRunner' removed in Step 9/10 (M1 → V0 cutover).
 *
 * The full LibraryStackParamList + CreateStackParamList will be introduced
 * in Step 11 when Navigation.tsx is finalized to the full V0 shape.
 */

export type RootStackParamList = {
  /**
   * SignIn — `showExpiredBanner` is set by the navigator when an
   * `useAuthDeepLink` redeem attempt fails (token expired/used/malformed).
   * The screen renders the "That link expired" banner above the form when
   * the param is true.
   */
  SignIn: {showExpiredBanner?: boolean} | undefined

  /**
   * Library — V0 main screen. Replaces M1 'Home'.
   * No route params — the screen fetches data via useMiniAppsListQuery.
   * T-0011-290: authenticated session → library-screen-root testID present.
   */
  Library: undefined

  /**
   * Run — renders a mini-app in run mode.
   * T-0011-292: pushed inside LibraryStack from LibraryScreen card tap.
   */
  Run: {miniAppId: string}

  /**
   * Create — prompt input screen.
   * `prefilledPrompt`: set when arriving from a Library empty-state chip
   *   (T-0011-165) or "Make changes" action.
   * `editingMiniAppId`: present when arriving from RunScreen "Make changes"
   *   action (T-0011-202, T-0011-252). Dismissed pill → next submit creates
   *   a new mini-app (no editingMiniAppId sent to /generate).
   */
  Create: {prefilledPrompt?: string; editingMiniAppId?: string} | undefined

  /**
   * Generating — full-screen modal pushed from CreateScreen FAB tap.
   * Consumes SSE from POST /generate; manages client-paced progress bar.
   * `prompt`: the user-entered prompt forwarded to /generate.
   * `editingMiniAppId`: forwarded to /generate when editing an existing app.
   */
  Generating: {prompt: string; editingMiniAppId?: string}

  /**
   * OutOfScope — full-screen takeover from GeneratingScreen when the
   * SSE stream emits an out_of_scope event.
   * T-0011-213..222, T-0011-231b.
   */
  OutOfScope: {
    capability: 'image_gen' | 'vision' | 'chat' | 'transcription' | 'classification' | 'unknown'
    reason: string
    promptHash: string
    originalPrompt: string
  }

  /**
   * QuotaExhausted — full-screen takeover when the server returns
   * HTTP 429 with error=quota_exhausted.
   * T-0011-223..226.
   */
  QuotaExhausted: {resetAt: string}

}
