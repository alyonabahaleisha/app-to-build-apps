/**
 * GridListRenderer — N-column masonry FlashList grid.
 *
 * V1 Phase 1 Step 4 — Lists & Data tier expansion.
 *
 * Visual (per canvas-v1-catalog-expansion-phase1-ux.md §GridList):
 *   - FlashList in numColumns mode for even grid layout.
 *   - Masonry mode (via masonry={true} + optimizeItemArrangement={true}).
 *   - columns: 2 (default) or 3 — renderer collapses to 2 on narrow widths < 380pt.
 *   - Each cell clips to itemAspectRatio shape (default '1:1').
 *   - gap: space-md (productive) / space-lg (expressive) when not specified.
 *
 * States: populated, empty (renders emptyState node or default), loading.
 *
 * Accessibility: accessibilityRole="list"; items inherit from template.
 *
 * Stance: productive → 2-col default, 1:1 aspect, tight gaps.
 *         expressive → 2-col default, 4:5 aspect, generous gaps.
 *
 * FlashList masonry: masonry={true} enables masonry item arrangement.
 * Per ADR-0006 §L amendment: no estimatedItemSize in FlashList v2.
 *
 * T-0009-091: GridList renders 2-column grid; collapses to 2 on narrow widths
 * T-0009-105: snapshots at productive×focus + expressive×health
 */
import React from 'react'
import {Text, View, useWindowDimensions} from 'react-native'
import {FlashList} from '@shopify/flash-list'
import type {Node} from '@app-creator/protocol'
import {useRendererStateContext} from '../../state/useRendererState.js'
import {ListItemContextProvider} from '../../state/ListItemContext.js'
import {useTheme, useStance} from '../../theme/RendererThemeProvider.js'
import {NodeRenderer} from '../NodeRenderer.js'
import type {Row, RowId} from '../../state/types.js'
// V1 Phase 1 Step 4: SearchBar integration — mirrors List.tsx pattern
import {useSearchFilter} from '../../state/SearchFilterContext.js'
import {rowMatchesQuery} from './List.js'

type GridListNode = Extract<Node, {type: 'GridList'}>

// Collapse threshold per ADR-0009 UX spec: "collapse when device width < 380pt".
// Path 1 (spec-aligned): hardcoded 380pt. Any requestedColumns > 2 collapses to 2
// on devices narrower than this. Does not affect 2-column (already minimum).
const NARROW_WIDTH_COLLAPSE_PT = 380

// Default gap tokens per stance.
const DEFAULT_GAP_TOKEN = {
  productive: 'space-sm' as const,
  expressive: 'space-md' as const,
}

// Aspect-ratio height multiplier for cells.
const ASPECT_RATIO_MULTIPLIER: Record<string, number> = {
  '1:1': 1,
  '4:5': 1.25,
  '3:4': 1.333,
}

type RowEntry = {rowId: RowId; row: Row; index: number}

function DefaultGridCell({row, theme, cellWidth}: {row: Row; theme: ReturnType<typeof useTheme>; cellWidth: number}) {
  const bodySpec = theme.type.body
  const captionSpec = theme.type.caption
  const title = String(row['name'] ?? row['title'] ?? row['label'] ?? Object.values(row)[0] ?? '')
  const subtitle = String(row['subtitle'] ?? row['description'] ?? '')

  return (
    <View
      style={{
        width: cellWidth,
        backgroundColor: theme['bg-elevated'],
        borderRadius: theme.radii['radius-md'],
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing['space-xs'],
      }}
    >
      <Text
        style={{
          fontSize: bodySpec.size,
          lineHeight: bodySpec.lineHeight,
          color: theme.fg,
          textAlign: 'center',
        }}
        numberOfLines={2}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={{
            fontSize: captionSpec.size,
            lineHeight: captionSpec.lineHeight,
            color: theme['fg-muted'],
            textAlign: 'center',
          }}
          numberOfLines={1}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  )
}

export function GridListRenderer({node}: {node: GridListNode}) {
  const theme = useTheme()
  const stance = useStance()
  const {state} = useRendererStateContext()
  const {width: windowWidth} = useWindowDimensions()

  // V1 Phase 1 Step 4: read search filter for this collection (null = no filter active).
  // ADR-0009 line 847 + line 1837: GridList must consume useSearchFilter, same as List.
  const searchQuery = useSearchFilter(node.collectionId)

  const collection = state.collections.get(node.collectionId)

  // Resolve columns: collapse to 2 when device width < 380pt (T-0009-091).
  // ADR-0009 UX spec: "collapse when width < 380pt". Path 1 (spec-aligned):
  // any requestedColumns > 2 collapses to 2 on narrow devices.
  const requestedColumns = node.columns ?? 2
  const columns = windowWidth < NARROW_WIDTH_COLLAPSE_PT && requestedColumns > 2 ? 2 : requestedColumns

  // Resolve gap token.
  const gapToken = node.gap ?? DEFAULT_GAP_TOKEN[stance]
  const gap = theme.spacing[gapToken]

  // Resolve aspect ratio.
  const itemAspectRatio = node.itemAspectRatio ?? '1:1'
  const aspectMultiplier = ASPECT_RATIO_MULTIPLIER[itemAspectRatio] ?? 1

  // Compute cell width from available space.
  const totalGap = gap * (columns + 1)
  const cellWidth = Math.floor((windowWidth - totalGap) / columns)
  const cellHeight = Math.floor(cellWidth * aspectMultiplier)

  // Unknown collectionId: render empty without crash.
  if (collection === undefined) {
    if (__DEV__) {
      console.warn(
        `[a2ui-renderer] GridList: collectionId "${node.collectionId}" not found in ` +
          `state.collections. Rendering empty.`,
      )
    }
    return (
      <View
        accessibilityLabel={node.accessibilityLabel ?? node.collectionId}
        accessibilityRole="list"
      />
    )
  }

  // Build ordered row entries.
  const allRowEntries: RowEntry[] = collection.rowOrder
    .map((rowId, index) => {
      const row = collection.rows.get(rowId)
      if (!row) return null
      return {rowId, row, index}
    })
    .filter((entry): entry is RowEntry => entry !== null)

  // Apply search filter: when a non-empty query is active, keep only matching rows.
  // Empty string or null → show all rows (mirrors List.tsx T-0009-066 behavior).
  const rowEntries =
    searchQuery && searchQuery.length > 0
      ? allRowEntries.filter(({row}) => rowMatchesQuery(row, searchQuery))
      : allRowEntries

  // Empty state.
  if (rowEntries.length === 0) {
    if (node.emptyState) {
      return <NodeRenderer node={node.emptyState as Node} />
    }
    const h2Spec = theme.type.h2
    return (
      <View
        style={{alignItems: 'center', padding: theme.spacing['space-xl']}}
        accessibilityLabel={node.accessibilityLabel ?? node.collectionId}
        accessibilityRole="list"
      >
        <Text style={{fontSize: h2Spec.size, color: theme['fg-muted'], textAlign: 'center'}}>
          No items yet
        </Text>
      </View>
    )
  }

  return (
    <View
      testID="gridlist-container"
      style={{flex: 1}}
      accessibilityLabel={node.accessibilityLabel ?? node.collectionId}
      accessibilityRole="list"
    >
      <FlashList<RowEntry>
        data={rowEntries}
        numColumns={columns}
        keyExtractor={(entry) => entry.rowId}
        renderItem={({item}) => (
          <ListItemContextProvider
            value={{row: item.row, rowId: item.rowId, index: item.index}}
          >
            <View
              style={{
                width: cellWidth,
                height: cellHeight,
                margin: gap / 2,
                borderRadius: theme.radii['radius-md'],
                overflow: 'hidden',
              }}
            >
              <DefaultGridCell
                row={item.row}
                theme={theme}
                cellWidth={cellWidth}
              />
            </View>
          </ListItemContextProvider>
        )}
      />
    </View>
  )
}
