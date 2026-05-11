/**
 * TimelineRenderer — vertical sequential events with left-rail date indicators.
 *
 * V1 Phase 1 Step 4 — Lists & Data tier expansion.
 *
 * Visual (per canvas-v1-catalog-expansion-phase1-ux.md §Timeline):
 *   - Vertical FlashList layout.
 *   - Left rail (40pt wide): 1pt vertical divider line, 12pt accent circle per event.
 *   - Right column: event date (type-micro, fg-faint) + event content (collection template).
 *   - groupBy: group header rows at day/week/month boundaries.
 *   - dateFormat: 'relative' ("2h ago"), 'absolute' ("Jan 14, 2026"), 'short' ("Jan 14").
 *
 * Accessibility:
 *   - accessibilityRole="list".
 *   - Each event: accessibilityLabel="{date}: {title}" (VoiceOver reads chronologically).
 *   - Focus order = visual top-to-bottom order (natural FlashList order).
 *
 * Cross-ref: dateField existence on collection is validated in Step 8.
 * This renderer reads dateField from each row; missing value renders as empty string.
 *
 * Stance:
 *   - Productive: events space-sm apart, 8pt dot, short date.
 *   - Expressive: events space-lg apart, 12pt dot, absolute date.
 *
 * T-0009-099: Timeline renders left rail with circles at each event
 * T-0009-100: groupBy: 'month' renders month headers between events
 * T-0009-107: snapshots at productive×focus + expressive×health
 */
import React from 'react'
import {Text, View} from 'react-native'
import {FlashList} from '@shopify/flash-list'
import type {Node} from '@app-creator/protocol'
import {useRendererStateContext} from '../../state/useRendererState.js'
import {ListItemContextProvider} from '../../state/ListItemContext.js'
import {useTheme, useStance} from '../../theme/RendererThemeProvider.js'
import type {Row, RowId} from '../../state/types.js'

type TimelineNode = Extract<Node, {type: 'Timeline'}>

// Rail geometry constants.
const RAIL_WIDTH = 40
const DOT_SIZE_PRODUCTIVE = 8
const DOT_SIZE_EXPRESSIVE = 12
const RAIL_LINE_LEFT = 19 // center of dot

// Date-group header item discriminator.
const GROUP_HEADER_SENTINEL = '__group_header__' as const

type TimelineItem =
  | {kind: 'event'; rowId: RowId; row: Row; index: number; dateValue: string}
  | {kind: 'header'; label: string}

/**
 * Format a date value (ISO string or any string) according to dateFormat.
 * Gracefully handles non-date strings by returning them as-is.
 */
function formatDateValue(raw: unknown, dateFormat: TimelineNode['dateFormat']): string {
  if (raw === null || raw === undefined || raw === '') return ''
  const str = String(raw)

  // Attempt to parse as ISO date.
  const ms = Date.parse(str)
  if (isNaN(ms)) return str // fallback: return raw string

  const date = new Date(ms)
  const format = dateFormat ?? 'relative'

  if (format === 'absolute') {
    return date.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})
  }
  if (format === 'short') {
    return date.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})
  }
  // relative: "Xs ago" / "Xm ago" / "Xh ago" / "Xd ago"
  const diffMs = Date.now() - ms
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}h ago`
  const diffDay = Math.floor(diffHour / 24)
  return `${diffDay}d ago`
}

/**
 * Get a group label string for a date value given the groupBy setting.
 * Returns '' when groupBy is 'none'.
 */
function getGroupLabel(raw: unknown, groupBy: TimelineNode['groupBy']): string {
  if (!groupBy || groupBy === 'none') return ''
  if (raw === null || raw === undefined || raw === '') return 'Unknown'
  const str = String(raw)
  const ms = Date.parse(str)
  if (isNaN(ms)) return 'Unknown'
  const date = new Date(ms)

  if (groupBy === 'month') {
    return date.toLocaleDateString('en-US', {month: 'long', year: 'numeric'})
  }
  if (groupBy === 'week') {
    // ISO week: "Week of Jan 1"
    const weekStart = new Date(date)
    weekStart.setDate(date.getDate() - date.getDay())
    return `Week of ${weekStart.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}`
  }
  // day
  return date.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})
}

export function TimelineRenderer({node}: {node: TimelineNode}) {
  const theme = useTheme()
  const stance = useStance()
  const {state} = useRendererStateContext()

  const collection = state.collections.get(node.collectionId)

  const dotSize = stance === 'productive' ? DOT_SIZE_PRODUCTIVE : DOT_SIZE_EXPRESSIVE
  const eventGap = stance === 'productive' ? theme.spacing['space-sm'] : theme.spacing['space-lg']
  const microSpec = theme.type.micro
  const bodySpec = theme.type.body

  const groupBy = node.groupBy ?? 'none'
  const dateFormat = node.dateFormat ?? 'relative'

  // Unknown collectionId.
  if (collection === undefined) {
    if (__DEV__) {
      console.warn(
        `[a2ui-renderer] Timeline: collectionId "${node.collectionId}" not found. Rendering empty.`,
      )
    }
    return (
      <View
        accessibilityLabel={node.accessibilityLabel ?? node.collectionId}
        accessibilityRole="list"
      />
    )
  }

  // Build timeline items — inject group headers when groupBy !== 'none'.
  const items: TimelineItem[] = []
  let lastGroupLabel = ''

  collection.rowOrder.forEach((rowId, index) => {
    const row = collection.rows.get(rowId)
    if (!row) return

    const rawDate = row[node.dateField]
    const dateValue = formatDateValue(rawDate, dateFormat)

    if (groupBy !== 'none') {
      const groupLabel = getGroupLabel(rawDate, groupBy)
      if (groupLabel !== lastGroupLabel) {
        lastGroupLabel = groupLabel
        items.push({kind: 'header', label: groupLabel})
      }
    }

    items.push({kind: 'event', rowId, row, index, dateValue})
  })

  if (items.length === 0) {
    const h2Spec = theme.type.h2
    return (
      <View
        style={{alignItems: 'center', padding: theme.spacing['space-xl']}}
        accessibilityLabel={node.accessibilityLabel ?? node.collectionId}
        accessibilityRole="list"
      >
        <Text style={{fontSize: h2Spec.size, color: theme['fg-muted'], textAlign: 'center'}}>
          No events yet
        </Text>
      </View>
    )
  }

  return (
    <View
      testID="timeline-container"
      style={{flex: 1}}
      accessibilityLabel={node.accessibilityLabel ?? node.collectionId}
      accessibilityRole="list"
    >
      {/* Vertical rail line — runs the full height of the timeline */}
      <View
        style={{
          position: 'absolute',
          left: RAIL_LINE_LEFT,
          top: 0,
          bottom: 0,
          width: 1,
          backgroundColor: theme.divider,
          zIndex: 0,
        }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />

      <FlashList<TimelineItem>
        data={items}
        keyExtractor={(item, _index) =>
          item.kind === 'header' ? `${GROUP_HEADER_SENTINEL}${item.label}` : item.rowId
        }
        renderItem={({item}) => {
          if (item.kind === 'header') {
            // Group header row — no circle, just a label with divider below.
            return (
              <View
                style={{
                  paddingLeft: RAIL_WIDTH,
                  paddingVertical: theme.spacing['space-xs'],
                }}
              >
                <Text
                  accessibilityRole="header"
                  style={{
                    fontSize: bodySpec.size,
                    lineHeight: bodySpec.lineHeight,
                    fontWeight: '600',
                    color: theme.fg,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.divider,
                    paddingBottom: theme.spacing['space-xs'],
                  }}
                >
                  {item.label}
                </Text>
              </View>
            )
          }

          // Event row.
          const titleFromRow = String(
            item.row['name'] ?? item.row['title'] ?? item.row['label'] ?? Object.values(item.row)[0] ?? '',
          )

          return (
            <ListItemContextProvider
              value={{row: item.row, rowId: item.rowId, index: item.index}}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  paddingBottom: eventGap,
                  zIndex: 1,
                }}
                accessibilityLabel={`${item.dateValue}: ${titleFromRow}`}
              >
                {/* Left rail: dot positioned over the continuous line */}
                <View
                  style={{
                    width: RAIL_WIDTH,
                    alignItems: 'center',
                    paddingTop: 4,
                  }}
                >
                  <View
                    style={{
                      width: dotSize,
                      height: dotSize,
                      borderRadius: dotSize / 2,
                      backgroundColor: theme.accent,
                    }}
                  />
                </View>

                {/* Right column: date + event content */}
                <View style={{flex: 1}}>
                  {item.dateValue ? (
                    <Text
                      style={{
                        fontSize: microSpec.size,
                        lineHeight: microSpec.lineHeight,
                        color: theme['fg-faint'],
                        marginBottom: theme.spacing['space-xs'],
                      }}
                    >
                      {item.dateValue}
                    </Text>
                  ) : null}
                  <Text
                    style={{
                      fontSize: bodySpec.size,
                      lineHeight: bodySpec.lineHeight,
                      color: theme.fg,
                    }}
                  >
                    {titleFromRow}
                  </Text>
                </View>
              </View>
            </ListItemContextProvider>
          )
        }}
      />
    </View>
  )
}
