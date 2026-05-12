/**
 * HeatmapRenderer — date-intensity heatmap grid backed by a collection.
 *
 * V1 Phase 1 Step 6 (T-0009-147..151, T-0009-153).
 *
 * Visual (per ADR-0009 Step 6):
 *   - 7-rows (Sun–Sat) × N-weeks-wide grid ending at today.
 *   - Range: '30d' (≈5w), '90d' (≈13w), '180d' (≈26w), '365d' (≈53w).
 *   - Intensity levels in 'count' mode: 5 levels (0=none; 1–5=quintiles).
 *   - Intensity levels in 'binary' mode: 0 (no items) or 1 (any items).
 *   - Today's cell: 1pt accent border (T-0009-150).
 *   - accessibilityCustomActions on each cell for per-cell info (T-0009-151).
 *
 * Quintile binning (T-0009-148):
 *   - Level 0: count === 0 (no items)
 *   - For days with count > 0: sort non-zero counts, compute percentile thresholds
 *     at 20th/40th/60th/80th percentile positions.
 *   - Level 1: count in [min, p20) → lowest quartile of active days
 *   - Level 2: count in [p20, p40)
 *   - Level 3: count in [p40, p60)
 *   - Level 4: count in [p60, p80)
 *   - Level 5: count in [p80, max] → most active days
 *
 * date-fns import pattern: tree-shaken imports from 'date-fns/<fn>'
 * per ADR-0009 Step 6 acceptance criteria (T-0009-137).
 *
 * T-0009-148: quintile binning maps to 5 levels
 * T-0009-149: binary mode uses single non-zero shade
 * T-0009-150: today's cell has 1pt accent border
 * T-0009-151: accessibilityCustomActions exposes per-cell info on long-press
 * T-0009-153: snapshots at productive×focus + expressive×health
 */
import React from 'react'
import {View, Text} from 'react-native'
import {format} from 'date-fns/format'
import {subDays} from 'date-fns/subDays'
import {startOfWeek} from 'date-fns/startOfWeek'
import {eachDayOfInterval} from 'date-fns/eachDayOfInterval'
import {isSameDay} from 'date-fns/isSameDay'
import type {Node} from '@app-creator/protocol'
import {useTheme} from '../../theme/RendererThemeProvider.js'
import {useRendererStateContext} from '../../state/useRendererState.js'

type HeatmapNode = Extract<Node, {type: 'Heatmap'}>

// Range string → number of days.
const RANGE_DAYS: Record<string, number> = {
  '30d': 30,
  '90d': 90,
  '180d': 180,
  '365d': 365,
}

// Intensity level → alpha multiplier for the accent color tint.
// Level 0 uses bg-elevated (no items). Levels 1–5 use accent at increasing opacity.
const LEVEL_ALPHA = [0, 0.15, 0.35, 0.55, 0.75, 1.0]

// Parse an ISO date string to a local Date. Returns null on invalid input.
// YYYY-MM-DD strings are parsed as local midnight to avoid UTC timezone offsets
// shifting the date by one day in negative-offset timezones.
function parseIsoDate(value: string): Date | null {
  const dateParts = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (dateParts) {
    const year = parseInt(dateParts[1]!, 10)
    const month = parseInt(dateParts[2]!, 10) - 1 // 0-indexed
    const day = parseInt(dateParts[3]!, 10)
    return new Date(year, month, day)
  }
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

// Compute count of collection items per day (keyed by YYYY-MM-DD).
function buildDayCounts(
  collectionId: string,
  dateField: string,
  collections: Map<string, {rowOrder: string[]; rows: Map<string, Record<string, unknown>>}>,
): Map<string, number> {
  const counts = new Map<string, number>()
  const collection = collections.get(collectionId)
  if (!collection) return counts

  for (const rowId of collection.rowOrder) {
    const row = collection.rows.get(rowId)
    if (!row) continue
    const fieldVal = row[dateField]
    if (typeof fieldVal !== 'string') continue
    const d = parseIsoDate(fieldVal)
    if (!d) continue
    const key = format(d, 'yyyy-MM-dd')
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

// Compute quintile thresholds from the non-zero count values.
// Returns [p20, p40, p60, p80] percentile boundary values.
// If fewer than 5 distinct values: thresholds collapse gracefully.
export function computeQuintileThresholds(nonZeroCounts: number[]): [number, number, number, number] {
  if (nonZeroCounts.length === 0) return [1, 1, 1, 1]
  const sorted = [...nonZeroCounts].sort((a, b) => a - b)
  const n = sorted.length

  function percentile(p: number): number {
    const idx = Math.floor(p * n)
    return sorted[Math.min(idx, n - 1)]!
  }

  return [percentile(0.2), percentile(0.4), percentile(0.6), percentile(0.8)]
}

// Map a count to an intensity level (0–5) in 'count' mode using quintile thresholds.
export function countToLevel(count: number, thresholds: [number, number, number, number]): number {
  if (count === 0) return 0
  const [p20, p40, p60, p80] = thresholds
  if (count < p20) return 1
  if (count < p40) return 2
  if (count < p60) return 3
  if (count < p80) return 4
  return 5
}

// Map a count to a level in 'binary' mode.
export function countToBinaryLevel(count: number): 0 | 1 {
  return count > 0 ? 1 : 0
}

// Blend accent color at a given alpha over bg for intensity rendering.
// Simple approach: use opacity on a colored View.
function IntensityCell({
  level,
  maxLevel,
  isToday,
  accentColor,
  bgColor,
  cellSize,
  accessibilityLabel,
  accessibilityActions,
  onAccessibilityAction,
}: {
  level: number
  maxLevel: number
  isToday: boolean
  accentColor: string
  bgColor: string
  cellSize: number
  accessibilityLabel: string
  accessibilityActions: Array<{name: string; label: string}>
  onAccessibilityAction: (name: string) => void
}) {
  const alpha = level === 0 ? 0 : LEVEL_ALPHA[Math.min(level, maxLevel)] ?? 0

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={(event) => onAccessibilityAction(event.nativeEvent.actionName)}
      style={{
        width: cellSize,
        height: cellSize,
        margin: 1,
        borderRadius: 2,
        backgroundColor: level === 0 ? bgColor : accentColor,
        opacity: level === 0 ? 1 : alpha,
        borderWidth: isToday ? 1 : 0,
        borderColor: isToday ? accentColor : 'transparent',
      }}
    />
  )
}

export function HeatmapRenderer({node}: {node: HeatmapNode}) {
  const theme = useTheme()
  const {state} = useRendererStateContext()

  const intensityMode = node.intensityMode ?? 'count'
  const rangeDays = RANGE_DAYS[node.range ?? '90d'] ?? 90

  const today = new Date()
  const rangeStart = subDays(today, rangeDays - 1)

  // Align grid start to the Sunday that contains rangeStart.
  const gridStart = startOfWeek(rangeStart, {weekStartsOn: 0})

  const allDays = eachDayOfInterval({start: gridStart, end: today})

  // Build day counts from collection.
  const dayCounts = buildDayCounts(node.collectionId, node.dateField, state.collections as Map<string, {rowOrder: string[]; rows: Map<string, Record<string, unknown>>}>)

  // Compute quintile thresholds for 'count' mode.
  let quintileThresholds: [number, number, number, number] = [1, 1, 1, 1]
  if (intensityMode === 'count') {
    const nonZeroCounts = Array.from(dayCounts.values()).filter(c => c > 0)
    quintileThresholds = computeQuintileThresholds(nonZeroCounts)
  }

  // Organise days into columns (weeks), 7 cells tall (Sun=0 … Sat=6).
  // allDays starts on a Sunday from gridStart.
  const numWeeks = Math.ceil(allDays.length / 7)

  const captionSpec = theme.type.caption
  const CELL_SIZE = 12

  // Day-of-week labels (single char, Sun–Sat)
  const DOW_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  return (
    <View
      testID={`heatmap-${node.id}`}
      accessibilityLabel={node.accessibilityLabel ?? 'Activity heatmap'}
    >
      <View style={{flexDirection: 'row'}}>
        {/* Day-of-week label column */}
        <View style={{width: 16, marginRight: 2}}>
          {DOW_LABELS.map((label, idx) => (
            <View
              key={idx}
              style={{
                height: CELL_SIZE + 2,
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 8,
                  color: theme['fg-muted'],
                  lineHeight: captionSpec.lineHeight,
                }}
                accessibilityElementsHidden
              >
                {idx % 2 === 0 ? label : ''}
              </Text>
            </View>
          ))}
        </View>

        {/* Heatmap grid: N columns (weeks) × 7 rows (day of week) */}
        <View style={{flexDirection: 'row'}} testID={`heatmap-grid-${node.id}`}>
          {Array.from({length: numWeeks}).map((_, weekIdx) => {
            const weekDays = allDays.slice(weekIdx * 7, weekIdx * 7 + 7)

            return (
              <View key={weekIdx} style={{flexDirection: 'column'}}>
                {Array.from({length: 7}).map((_, dowIdx) => {
                  const day = weekDays[dowIdx]
                  if (!day) {
                    // Padding cell for incomplete weeks
                    return (
                      <View
                        key={dowIdx}
                        style={{
                          width: CELL_SIZE,
                          height: CELL_SIZE,
                          margin: 1,
                        }}
                      />
                    )
                  }

                  const dayKey = format(day, 'yyyy-MM-dd')
                  const count = dayCounts.get(dayKey) ?? 0
                  const isToday = isSameDay(day, today)

                  let level: number
                  if (intensityMode === 'binary') {
                    level = countToBinaryLevel(count)
                  } else {
                    level = countToLevel(count, quintileThresholds)
                  }

                  const maxLevel = intensityMode === 'binary' ? 1 : 5
                  const displayDate = format(day, 'MMM d, yyyy')
                  const a11yLabel = `${displayDate}: ${count} item${count !== 1 ? 's' : ''}`

                  // T-0009-151: accessibilityCustomActions exposes per-cell info on long-press
                  const accessibilityActions = [
                    {name: 'cellInfo', label: `${count} item${count !== 1 ? 's' : ''} on ${displayDate}`},
                  ]

                  return (
                    <IntensityCell
                      key={dowIdx}
                      level={level}
                      maxLevel={maxLevel}
                      isToday={isToday}
                      accentColor={theme.accent}
                      bgColor={theme['bg-elevated']}
                      cellSize={CELL_SIZE}
                      accessibilityLabel={a11yLabel}
                      accessibilityActions={accessibilityActions}
                      onAccessibilityAction={() => {}}
                    />
                  )
                })}
              </View>
            )
          })}
        </View>
      </View>
    </View>
  )
}
