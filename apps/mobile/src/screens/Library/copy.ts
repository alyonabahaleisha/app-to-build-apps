/**
 * Library screen copy — every user-facing string lives here as a plain literal.
 *
 * Per ARCHITECTURE.md §11: no concatenation that produces different copy
 * variants. The M2 Lingui codemod can wrap each literal one-for-one without
 * touching JSX.
 *
 * Strings sourced from `docs/ux/canvas-v0-ux.md` §Content & Copy.
 *
 * T-0011-170: "Tools your friends share will appear here." is pinned verbatim
 * (Cal R3 P1-7) — do NOT paraphrase.
 */
export const libraryCopy = {
  title: 'Library',
  searchPlaceholder: 'Search your tools',

  // Filter chips
  filterAll: 'All',
  filterMine: 'Mine',
  filterShared: 'Shared with me',

  // Empty state (no tools at all)
  emptyHeadline: 'What do you want to build?',
  emptySubhead: 'Three ideas to get you started.',
  emptyChip1: '📓 Daily mood journal',
  emptyChip2: '🥗 Weekly grocery list',
  emptyChip3: '🏃 Track my workouts',

  // Inline empty states
  noResults: "No tools match '{query}'.", // query inserted by caller
  noShares: 'Tools your friends share will appear here.', // T-0011-170 pinned verbatim

  // Error state
  errorBanner: "Couldn't load your library. Pull to retry.",
  errorBannerShape: "Couldn't load your library.", // T-0011-190

  // Card
  cardUntitled: 'Untitled',
  cardCreatedPrefix: 'created ',

  // Long-press action sheet
  actionOpen: 'Open',
  actionShare: 'Share',
  actionMakeChanges: 'Make changes',
  actionArchive: 'Archive',
  actionRename: 'Rename',
  actionDelete: 'Delete',

  // Avatar / settings
  avatarA11y: 'Open settings',

  // Pull-to-refresh accessibility
  refreshed: 'Refreshed',
  noNewTools: 'No new tools',
} as const

/**
 * Builds the "No tools match '...'" string.
 * The template is kept in copy.ts; the parameter substitution is here.
 */
export function noResultsCopy(query: string): string {
  return `No tools match '${query}'.`
}
