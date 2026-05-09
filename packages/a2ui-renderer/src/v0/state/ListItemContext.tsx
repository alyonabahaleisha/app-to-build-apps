/**
 * ListItemContext — row-scoped React context for collection-field bindings.
 *
 * The <List> renderer (Step 7) wraps each row's children in a
 * <ListItemContextProvider> with the current row's data. useBinding reads
 * this context when resolving `collectionField` bindings.
 *
 * This is the only React context the renderer uses for app logic — all others
 * are pure renderer infrastructure (theme, AI capabilities, host callbacks).
 * The brief's "no app-specific contexts" rule is honored: this is renderer
 * infrastructure, not app-specific.
 *
 * null default means "not inside a List row" — useBinding uses this to detect
 * the collectionField-outside-ListItemContext error case.
 */
import React, {createContext, useContext} from 'react'
import type {Row} from './types.js'

export type ListItemContextValue = {
  row: Row
  rowId: string
  index: number
} | null

const ListItemContext = createContext<ListItemContextValue>(null)

/**
 * useListItemContext — reads the current row context.
 * Returns null when called outside a ListItemContextProvider.
 */
export function useListItemContext(): ListItemContextValue {
  return useContext(ListItemContext)
}

/**
 * ListItemContextProvider — wraps a row's children to provide row context.
 * Used by the <List> component renderer for each row.
 */
export function ListItemContextProvider({
  value,
  children,
}: {
  value: NonNullable<ListItemContextValue>
  children: React.ReactNode
}): React.ReactElement {
  return (
    <ListItemContext.Provider value={value}>
      {children}
    </ListItemContext.Provider>
  )
}
