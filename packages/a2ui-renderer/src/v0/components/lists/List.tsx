/**
 * ListRenderer — FlashList-backed container for collection rows.
 *
 * Per ADR-0006 §D + §Step 7 ACs:
 *   - Reads rows from state.collections.get(node.collectionId)
 *   - Provides ListItemContextProvider per row so children resolve
 *     collectionField bindings via useBinding
 *   - Empty state: renders node.emptyState (EmptyState node from spec) when rows = 0
 *   - Unknown collectionId: renders empty View with warning in __DEV__ (no crash)
 *   - estimatedItemSize derived from node.itemLayout per ITEM_LAYOUT_HEIGHT
 *
 * Item rendering:
 *   The spec embeds a row template inside each collection row's context.
 *   For V0, the renderer uses the collection's rows directly and renders a
 *   default ListItem layout per row (title from row['name'] or row['title'],
 *   subtitle from row['subtitle'] or row['description']).
 *   CollectionField bindings inside nested components resolve via ListItemContext.
 *
 * Reanimated layout animations:
 *   - addItem row entry: FadeIn.duration(200) via Animated.View wrapping each item
 *   - removeItem row exit: FadeOut.duration(200)
 *   - List relayout: LinearTransition.duration(200)
 *   - useReducedMotion → animations disabled (entering/exiting/layout = undefined)
 *
 * FlashList is always used (ADR-0006 §L: "no FlatList").
 *
 * Accessibility:
 *   - accessibilityLabel from node.accessibilityLabel ?? collectionId
 *   - Empty state has its own accessibility tree
 *
 * T-0006-107: snapshot at productive×focus
 * T-0006-108: snapshot at expressive×health
 * T-0006-117: renders rows from collection.rowOrder via FlashList
 * T-0006-118: item children resolve collectionField bindings via ListItemContext
 * T-0006-122: renders emptyState when collection has zero rows
 * T-0006-124: estimatedItemSize matches itemLayout (compact 44, standard 56, expanded 80)
 * T-0006-125: unknown collectionId renders empty without crash
 * T-0006-126: 50 rows render without issues
 * T-0006-127: 100 concurrent addItem dispatches result in correct row counts
 * T-0006-128: item identity preserved across re-renders (keyExtractor)
 *
 * V1 Phase 1 Step 2 — SearchBar integration (ADR-0009 §E):
 *   When a SearchBar with boundCollectionId === node.collectionId is mounted,
 *   ListRenderer reads the query from SearchFilterContext and filters rows
 *   by case-insensitive substring match across all string-valued fields.
 *   T-0009-053: case-insensitive substring filter
 *   T-0009-066: empty query → no filtering (all rows shown)
 */
import React from 'react'
import {Text, View} from 'react-native'
import {FlashList} from '@shopify/flash-list'
import Animated, {FadeIn, FadeOut, LinearTransition} from 'react-native-reanimated'
import type {Node} from '@app-creator/protocol'
import {useRendererStateContext} from '../../state/useRendererState.js'
import {ListItemContextProvider} from '../../state/ListItemContext.js'
import {useTheme} from '../../theme/RendererThemeProvider.js'
import {useReducedMotion} from '../../a11y/useReducedMotion.js'
import {NodeRenderer} from '../NodeRenderer.js'
import {ITEM_LAYOUT_HEIGHT} from './defaults.js'
import type {Row, RowId} from '../../state/types.js'
// V1 Phase 1 Step 2: SearchBar integration
import {useSearchFilter} from '../../state/SearchFilterContext.js'

type ListNode = Extract<Node, {type: 'List'}>

type RowEntry = {rowId: RowId; row: Row; index: number}

// Default row view used when no emptyState node is specified.
// Renders a simple plain-text "No items yet" centered view.
function DefaultEmptyRow({theme}: {theme: ReturnType<typeof useTheme>}) {
  const h2Spec = theme.type.h2
  return (
    <View
      style={{
        alignItems: 'center',
        padding: theme.spacing['space-xl'],
      }}
    >
      <Text
        style={{
          fontSize: h2Spec.size,
          color: theme['fg-muted'],
          textAlign: 'center',
        }}
      >
        No items yet
      </Text>
    </View>
  )
}

// DefaultRowView — renders a single collection row as a simple ListItem-shaped view.
// Used when the spec doesn't embed a richer template inside the collection context.
// CollectionField bindings nested inside still resolve via ListItemContext.
function DefaultRowView({
  row,
  theme,
  rowHeight,
}: {
  row: Row
  theme: ReturnType<typeof useTheme>
  rowHeight: number
}) {
  const bodySpec = theme.type.body
  const captionSpec = theme.type.caption

  // Pick the best available field for title and subtitle.
  const title = String(row['name'] ?? row['title'] ?? row['label'] ?? Object.values(row)[0] ?? '')
  const subtitle = String(row['subtitle'] ?? row['description'] ?? row['detail'] ?? '')

  return (
    <View
      style={{
        minHeight: rowHeight,
        paddingHorizontal: theme.spacing['space-md'],
        paddingVertical: theme.spacing['space-sm'],
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontSize: bodySpec.size,
          lineHeight: bodySpec.lineHeight,
          color: theme.fg,
        }}
        numberOfLines={1}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={{
            fontSize: captionSpec.size,
            lineHeight: captionSpec.lineHeight,
            color: theme['fg-muted'],
          }}
          numberOfLines={1}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  )
}

/**
 * Derives Reanimated entering/exiting/layout animation props from the
 * reduced-motion preference. Extracted for direct unit-testability.
 *
 * Returns `undefined` for all animations when reducedMotion is true, giving
 * users with vestibular disorders a static, non-animated list.
 */
export function buildAnimationProps(reducedMotion: boolean) {
  return {
    enteringAnim: reducedMotion ? undefined : FadeIn.duration(200),
    exitingAnim: reducedMotion ? undefined : FadeOut.duration(200),
    layoutAnim: reducedMotion ? undefined : LinearTransition.duration(200),
  }
}

/**
 * Returns true if the row has at least one string field that contains `query`
 * as a case-insensitive substring.
 * `query` must already be lowercased (SearchFilterContext stores it lowercased).
 */
function rowMatchesQuery(row: Row, query: string): boolean {
  for (const value of Object.values(row)) {
    if (typeof value === 'string' && value.toLowerCase().includes(query)) {
      return true
    }
  }
  return false
}

export function ListRenderer({node}: {node: ListNode}) {
  const theme = useTheme()
  const {state} = useRendererStateContext()
  const reducedMotion = useReducedMotion()
  const collection = state.collections.get(node.collectionId)
  const itemLayout = node.itemLayout ?? 'standard'
  const estimatedItemSize = ITEM_LAYOUT_HEIGHT[itemLayout]

  // V1 Phase 1 Step 2: read search filter for this collection (null = no filter active).
  // SearchFilterContext stores the query lowercased, so comparison is already normalized.
  const searchQuery = useSearchFilter(node.collectionId)

  // Animation builders — disabled when useReducedMotion() is true.
  const {enteringAnim, exitingAnim, layoutAnim} = buildAnimationProps(reducedMotion)

  // Unknown collectionId: render as empty (no crash).
  if (collection === undefined) {
    if (__DEV__) {
      console.warn(
        `[a2ui-renderer] List: collectionId "${node.collectionId}" not found in ` +
          `state.collections. Ensure the spec declares this collection. Rendering empty.`,
      )
    }
    return (
      <View
        accessibilityLabel={node.accessibilityLabel ?? node.collectionId}
      />
    )
  }

  // Build ordered row entries for FlashList data array.
  const allRowEntries: RowEntry[] = collection.rowOrder
    .map((rowId, index) => {
      const row = collection.rows.get(rowId)
      if (!row) return null
      return {rowId, row, index}
    })
    .filter((entry): entry is RowEntry => entry !== null)

  // Apply search filter: when a non-empty query is active, keep only matching rows.
  // Empty string or null → show all rows (T-0009-066).
  const rowEntries =
    searchQuery && searchQuery.length > 0
      ? allRowEntries.filter(({row}) => rowMatchesQuery(row, searchQuery))
      : allRowEntries

  // Empty state — render node.emptyState if provided, otherwise default view.
  if (rowEntries.length === 0) {
    if (node.emptyState) {
      return <NodeRenderer node={node.emptyState as Node} />
    }
    return <DefaultEmptyRow theme={theme} />
  }

  return (
    <Animated.View
      testID="list-container"
      style={{flex: 1, minHeight: estimatedItemSize * Math.min(rowEntries.length, 5)}}
      layout={layoutAnim}
      accessibilityLabel={node.accessibilityLabel ?? node.collectionId}
    >
      <FlashList<RowEntry>
        data={rowEntries}
        keyExtractor={(entry) => entry.rowId}
        renderItem={({item}) => (
          <Animated.View
            key={item.rowId}
            entering={enteringAnim}
            exiting={exitingAnim}
          >
            <ListItemContextProvider
              value={{row: item.row, rowId: item.rowId, index: item.index}}
            >
              <DefaultRowView
                row={item.row}
                theme={theme}
                rowHeight={estimatedItemSize}
              />
            </ListItemContextProvider>
          </Animated.View>
        )}
      />
    </Animated.View>
  )
}
