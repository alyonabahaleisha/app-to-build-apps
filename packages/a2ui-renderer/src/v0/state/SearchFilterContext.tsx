/**
 * SearchFilterContext — renderer-instance-scoped search filter state.
 *
 * Provides a Map<collectionId, query> that SearchBar components write to
 * and List/GridList/Gallery components read from via useSearchFilter().
 *
 * Architecture: ADR-0009 Step 2 §E.
 *
 * Scoping: per-Renderer-instance (NOT module-level singleton). The
 * SearchFilterProvider is mounted inside <Renderer> above the nav root,
 * which means each Renderer tree gets its own Map. Multiple Renderer
 * instances in the same app (or same test) cannot cross-pollute.
 *
 * Why a Map instead of multiple Contexts: a single spec may have 2+
 * SearchBars on different collections. A Map keyed by collectionId is
 * cleaner than nested providers.
 *
 * Filter behavior (renderer-side):
 * - Substring match, case-insensitive, across all string fields of a row.
 * - Numeric fields are ignored.
 * - Empty string or null → no filter (full collection shown).
 * - Filter is render-time only — no source mutation, no persistence.
 * - SearchBar clears its Map entry on unmount.
 *
 * Performance note (ADR-0009 §Risks):
 * - The Map holds lowercased query strings. Comparison cost per row is
 *   O(stringFields × queryLength). For ≤200 rows this is negligible.
 * - Throttle SearchBar binding updates to 16ms (one frame) via Reanimated
 *   runOnJS — the SearchBar renderer is responsible for this throttle.
 *
 * T-0009-230: instance-scoping — two independent Renderer instances maintain
 *   separate Maps (NOT a module-level singleton).
 * T-0009-231: unmount-clears-filter — SearchBar unmount removes Map entry.
 * T-0009-232: two SearchBars on same collectionId — last-writer-wins, with
 *   console.warn for dev visibility.
 */
import React, {createContext, useContext, useRef} from 'react'

/** collectionId → lowercased query string */
export type SearchFilterMap = Map<string, string>

// Context holds a stable ref to the Map. The ref itself never changes reference,
// which prevents SearchFilterContext.Provider value changes from re-rendering
// all consumers on every keystroke. Consumers call .get() on the Map directly.
//
// NOTE: This is NOT reactive by default — components consuming useSearchFilter
// will need to subscribe to changes via the update mechanism below. For V1 Phase 1
// the pattern is: SearchBar forces a re-render of List via a shared state signal
// (the SearchBar writes the query both to the Map AND to the local state that
// feeds the renderer). See SearchBarRenderer for the wiring.
const SearchFilterContext = createContext<SearchFilterMap>(new Map())

/**
 * useSearchFilter — read the current filter query for a collection.
 *
 * Returns null if no SearchBar is bound to this collectionId (no filter active).
 * Returns '' if a SearchBar is bound but currently has an empty query.
 * Returns a lowercased query string when filtering is active.
 *
 * Callers should treat null and '' as "no filter" (show all rows).
 */
export function useSearchFilter(collectionId: string): string | null {
  const map = useContext(SearchFilterContext)
  return map.get(collectionId) ?? null
}

export type SearchFilterControls = {
  /**
   * Write a query for a collection. Call on every SearchBar value change.
   * Lowercases the query before storing.
   * If another SearchBar already holds a query for the same collectionId,
   * this overwrites it (last-writer-wins) and emits a console.warn in __DEV__.
   */
  setFilter: (collectionId: string, query: string) => void
  /** Remove the filter for a collection. Call on SearchBar unmount. */
  clearFilter: (collectionId: string) => void
}

export type SearchFilterContextValue = {
  map: SearchFilterMap
  controls: SearchFilterControls
}

// Internal context that exposes the mutable controls as well.
// Only SearchBarRenderer needs these — List/GridList only need the read-only map.
const SearchFilterControlsContext = createContext<SearchFilterControls>({
  setFilter: () => undefined,
  clearFilter: () => undefined,
})

/**
 * useSearchFilterControls — access write methods.
 * Only SearchBar renderers should call this.
 */
export function useSearchFilterControls(): SearchFilterControls {
  return useContext(SearchFilterControlsContext)
}

export type SearchFilterProviderProps = {
  children: React.ReactNode
}

/**
 * SearchFilterProvider — mount once at the Renderer root.
 *
 * Creates a stable Map reference (via useRef) so that the context value
 * never changes reference. This means we need a separate mechanism to
 * trigger re-renders when filter values change. The SearchBar renderer
 * achieves this by updating both the Map AND a local state in the List
 * (via a force-update signal). For V1 Phase 1, the simpler approach is:
 * SearchBar sets both the Map entry AND a shared forceUpdate counter that
 * List subscribed to. However, to keep the architecture clean and avoid
 * over-engineering, the SearchBar will re-trigger renders by updating its
 * own state (which flows down as a binding update to the list).
 *
 * In practice: when a SearchBar has `boundCollectionId` set, the List
 * that renders that collection calls `useSearchFilter()` on each render.
 * The re-render is triggered because the SearchBar's valueBinding dispatches
 * a state `set` action, which updates the RendererState, which triggers
 * a re-render of all consumers including the List.
 */
export function SearchFilterProvider({children}: SearchFilterProviderProps) {
  // Stable Map ref — same object throughout the component's lifetime.
  // This is intentionally mutable: we write into the Map without triggering
  // a provider re-render, relying on RendererState re-renders to propagate.
  const mapRef = useRef<SearchFilterMap>(new Map())

  // Stable controls ref — same object throughout.
  const controlsRef = useRef<SearchFilterControls>({
    setFilter(collectionId: string, query: string) {
      const map = mapRef.current
      // Dev warning for two SearchBars on the same collection (T-0009-232).
      if (__DEV__ && map.has(collectionId) && map.get(collectionId) !== query) {
        const existing = map.get(collectionId)
        if (existing !== undefined && existing !== query) {
          // Only warn when there's already a different non-empty query.
          // This signals two SearchBars on the same collectionId.
          console.warn(
            `[a2ui-renderer] SearchFilterContext: two SearchBars are writing to ` +
              `collectionId "${collectionId}". Last-writer-wins. ` +
              `If this is intentional, suppress this warning by using separate collectionIds.`,
          )
        }
      }
      map.set(collectionId, query.toLowerCase())
    },
    clearFilter(collectionId: string) {
      mapRef.current.delete(collectionId)
    },
  })

  return (
    <SearchFilterContext.Provider value={mapRef.current}>
      <SearchFilterControlsContext.Provider value={controlsRef.current}>
        {children}
      </SearchFilterControlsContext.Provider>
    </SearchFilterContext.Provider>
  )
}
