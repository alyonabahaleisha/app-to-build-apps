/**
 * Stack param lists for all navigators.
 *
 * ADR-0011 Step 8: added 'Library', 'Run', 'Create' screen names.
 * Removed 'Home' (M1 screen deleted in Step 8).
 * 'Chat' and 'AppRunner' remain until Step 11 deletes them.
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
   * Create — prompt input screen. `prefilledPrompt` is set when arriving
   * from a Library empty-state chip (T-0011-165) or "Make changes" action.
   */
  Create: {prefilledPrompt?: string} | undefined

  // ---------- M1 screens kept until Step 11 deletion ----------
  /**
   * @deprecated Replaced by 'Create' — will be deleted in Step 11.
   */
  Chat:
    | {
        parentProjectId: string
        prefilledPrompt: string
        parentAuthorHandle: string
      }
    | undefined
  /**
   * @deprecated Replaced by 'Run' — will be deleted in Step 11.
   */
  AppRunner: {projectId: string}
}
