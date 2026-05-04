/**
 * Stack param list for the root navigator. Each entry is the params shape
 * the screen receives via `route.params` (or `undefined` if it accepts none).
 */
export type RootStackParamList = {
  /**
   * SignIn — `showExpiredBanner` is set by the navigator when an
   * `useAuthDeepLink` redeem attempt fails (token expired/used/malformed).
   * The screen renders the "That link expired" banner above the form when
   * the param is true.
   */
  SignIn: {showExpiredBanner?: boolean} | undefined
  Home: undefined
  /**
   * Chat screen — optional remix params when arriving from Try mode's Remix CTA.
   * All three must be present together or absent together.
   */
  Chat:
    | {
        parentProjectId: string
        prefilledPrompt: string
        parentAuthorHandle: string
      }
    | undefined
  AppRunner: {projectId: string}
}
