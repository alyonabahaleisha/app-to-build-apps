/**
 * CalendarRenderer — month or week calendar grid.
 *
 * V1 Phase 1 Step 6 (T-0009-136..146, T-0009-152, T-0009-244).
 *
 * Visual (per ADR-0009 Step 6):
 *   - Month view: 6-row × 7-column fixed grid (42 cells). Leading/trailing
 *     cells from adjacent months rendered in fg-muted color.
 *   - Day-of-week header row at top (S/M/T/W/T/F/S or M/T/W/T/F/S/S).
 *   - Month nav chevrons manage internal monthState (NOT a spec binding).
 *   - selectedBinding (DateBinding) dispatched on date tap.
 *   - Same-date-tap is a no-op (T-0009-244): tapping already-selected date
 *     leaves selectedBinding value unchanged. Matches iOS Calendar behavior.
 *   - When collectionId + dateField set: accent dot beneath day number
 *     for any date that has a collection item.
 *
 * Accessibility (T-0009-145):
 *   - Grid container: accessibilityRole="grid"
 *   - Each day cell: accessibilityRole="button"
 *   - accessibilityLabel: formatted full date ("Tuesday, October 7")
 *
 * date-fns import pattern: tree-shaken imports from 'date-fns/<fn>'
 * per ADR-0009 Step 6 acceptance criteria (T-0009-137).
 *
 * T-0009-141: 6-row × 7-col grid for any month
 * T-0009-142: firstDayOfWeek: 'monday' shifts grid by one day
 * T-0009-143: selectedBinding updates on date tap
 * T-0009-144: accent dot for collection-bound dates
 * T-0009-145: accessibilityRole="grid" + "button"
 * T-0009-146: month nav chevrons advance/recede month state
 * T-0009-152: snapshots at productive×focus + expressive×health
 * T-0009-244: same-date tap is a no-op
 */
import React, {useState} from 'react'
import {View, Text, Pressable} from 'react-native'
import {format} from 'date-fns/format'
import {startOfMonth} from 'date-fns/startOfMonth'
import {endOfMonth} from 'date-fns/endOfMonth'
import {startOfWeek} from 'date-fns/startOfWeek'
import {endOfWeek} from 'date-fns/endOfWeek'
import {eachDayOfInterval} from 'date-fns/eachDayOfInterval'
import {addMonths} from 'date-fns/addMonths'
import {subMonths} from 'date-fns/subMonths'
import {isSameMonth} from 'date-fns/isSameMonth'
import {isSameDay} from 'date-fns/isSameDay'
import type {Node} from '@app-creator/protocol'
import {Icon} from '@app-creator/design-system'
import {useTheme} from '../../theme/RendererThemeProvider.js'
import {useRendererStateContext} from '../../state/useRendererState.js'

type CalendarNode = Extract<Node, {type: 'Calendar'}>

// Day-of-week header labels in Sunday-first order.
const DOW_LABELS_SUNDAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const
// Day-of-week header labels in Monday-first order.
const DOW_LABELS_MONDAY = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const

// Build 42-cell grid (6 rows × 7 cols) for a given month.
// Returns an array of Date objects; cells outside the month display in muted color.
function buildMonthGrid(month: Date, firstDayOfWeek: 'sunday' | 'monday'): Date[] {
  const weekOptions = {weekStartsOn: firstDayOfWeek === 'monday' ? 1 : 0} as const
  const monthStart = startOfMonth(month)
  const monthEnd = endOfMonth(month)
  const gridStart = startOfWeek(monthStart, weekOptions)
  const gridEnd = endOfWeek(monthEnd, weekOptions)
  const days = eachDayOfInterval({start: gridStart, end: gridEnd})

  // Pad to exactly 42 cells (6 rows × 7 cols)
  while (days.length < 42) {
    const last = days[days.length - 1]!
    const next = new Date(last)
    next.setDate(next.getDate() + 1)
    days.push(next)
  }
  return days.slice(0, 42)
}

// Parse an ISO date string (YYYY-MM-DD or full ISO) to a local Date.
// Returns null on invalid input so marker logic degrades gracefully.
//
// For YYYY-MM-DD strings: construct as local date (not UTC) to avoid timezone
// offset issues. `new Date('2026-01-01')` interprets as UTC midnight, which
// may shift to the previous day in negative-offset timezones. Instead parse
// the components directly to get a local midnight date.
function parseIsoDate(value: string): Date | null {
  // Fast path: YYYY-MM-DD format — parse as local date to avoid UTC offset issues.
  const dateParts = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (dateParts) {
    const year = parseInt(dateParts[1]!, 10)
    const month = parseInt(dateParts[2]!, 10) - 1 // 0-indexed
    const day = parseInt(dateParts[3]!, 10)
    return new Date(year, month, day)
  }
  // Full ISO string fallback
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

export function CalendarRenderer({node}: {node: CalendarNode}) {
  const theme = useTheme()
  const {state, dispatch} = useRendererStateContext()

  const firstDayOfWeek = node.firstDayOfWeek ?? 'sunday'
  const dowLabels = firstDayOfWeek === 'monday' ? DOW_LABELS_MONDAY : DOW_LABELS_SUNDAY

  // Internal month navigation state — NOT a spec binding (per ADR-0009 Step 6).
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()))

  // Resolve selected date from selectedBinding (state slot).
  let selectedDate: Date | null = null
  if (node.selectedBinding) {
    const binding = node.selectedBinding
    if (binding.kind === 'state') {
      const slotValue = state.slots.get(binding.slot)
      if (typeof slotValue === 'string' && slotValue) {
        selectedDate = parseIsoDate(slotValue)
      }
    } else if (binding.kind === 'literal' && binding.value) {
      selectedDate = parseIsoDate(binding.value)
    }
  }

  // Build set of marked dates from collection (collectionId + dateField).
  const markedDates = new Set<string>()
  if (node.collectionId && node.dateField) {
    const collection = state.collections.get(node.collectionId)
    if (collection) {
      for (const rowId of collection.rowOrder) {
        const row = collection.rows.get(rowId)
        if (!row) continue
        const fieldVal = row[node.dateField]
        if (typeof fieldVal === 'string') {
          const d = parseIsoDate(fieldVal)
          if (d) {
            // Store as YYYY-MM-DD for fast lookup
            markedDates.add(format(d, 'yyyy-MM-dd'))
          }
        }
      }
    }
  }

  const gridDays = buildMonthGrid(currentMonth, firstDayOfWeek)

  function handleDayPress(day: Date) {
    if (!node.selectedBinding) return
    const binding = node.selectedBinding
    if (binding.kind !== 'state') return

    // T-0009-244: same-date tap is a no-op — value stays unchanged.
    if (selectedDate && isSameDay(day, selectedDate)) return

    dispatch({
      type: 'set',
      target: binding.slot,
      value: format(day, 'yyyy-MM-dd'),
    })
  }

  const captionSpec = theme.type.caption
  const bodySpec = theme.type.body

  const CELL_SIZE = 36
  const ACCENT_DOT_SIZE = 4

  return (
    <View
      role="grid"
      accessibilityLabel={node.accessibilityLabel ?? 'Calendar'}
      testID={`calendar-${node.id}`}
    >
      {/* Month navigation header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: theme.spacing['space-sm'],
          paddingVertical: theme.spacing['space-xs'],
        }}
      >
        <Pressable
          testID={`calendar-prev-${node.id}`}
          onPress={() => setCurrentMonth(m => subMonths(m, 1))}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          style={{padding: theme.spacing['space-xs']}}
        >
          <Icon name="chevron-left" size={20} color={theme.fg} />
        </Pressable>

        <Text
          style={{
            fontSize: bodySpec.size,
            lineHeight: bodySpec.lineHeight,
            fontWeight: String(bodySpec.weight) as '600',
            color: theme.fg,
          }}
          testID={`calendar-month-label-${node.id}`}
        >
          {format(currentMonth, 'MMMM yyyy')}
        </Text>

        <Pressable
          testID={`calendar-next-${node.id}`}
          onPress={() => setCurrentMonth(m => addMonths(m, 1))}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          style={{padding: theme.spacing['space-xs']}}
        >
          <Icon name="chevron-right" size={20} color={theme.fg} />
        </Pressable>
      </View>

      {/* Day-of-week header row */}
      <View
        style={{
          flexDirection: 'row',
          paddingHorizontal: theme.spacing['space-xs'],
        }}
        testID={`calendar-dow-header-${node.id}`}
      >
        {dowLabels.map((label, idx) => (
          <View
            key={idx}
            style={{
              width: CELL_SIZE,
              height: CELL_SIZE,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                fontSize: captionSpec.size,
                lineHeight: captionSpec.lineHeight,
                fontWeight: String(captionSpec.weight) as '500',
                color: theme['fg-muted'],
              }}
              accessibilityElementsHidden
            >
              {label}
            </Text>
          </View>
        ))}
      </View>

      {/* 6-row × 7-col grid (T-0009-141) */}
      <View
        style={{paddingHorizontal: theme.spacing['space-xs']}}
        testID={`calendar-grid-${node.id}`}
      >
        {Array.from({length: 6}).map((_, rowIdx) => (
          <View
            key={rowIdx}
            style={{flexDirection: 'row'}}
            testID={`calendar-row-${node.id}-${rowIdx}`}
          >
            {gridDays.slice(rowIdx * 7, rowIdx * 7 + 7).map((day, colIdx) => {
              const isCurrentMonth = isSameMonth(day, currentMonth)
              const isSelected = selectedDate !== null && isSameDay(day, selectedDate)
              const dayKey = format(day, 'yyyy-MM-dd')
              const isMarked = markedDates.has(dayKey)
              const fullLabel = format(day, 'EEEE, MMMM d')

              return (
                <Pressable
                  key={colIdx}
                  testID={`calendar-cell-${node.id}-${dayKey}`}
                  onPress={() => handleDayPress(day)}
                  accessibilityRole="button"
                  accessibilityLabel={fullLabel}
                  style={{
                    width: CELL_SIZE,
                    height: CELL_SIZE,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: theme.radii['radius-full'],
                    backgroundColor: isSelected ? theme.accent : 'transparent',
                  }}
                >
                  <Text
                    style={{
                      fontSize: captionSpec.size,
                      lineHeight: captionSpec.lineHeight,
                      color: isSelected
                        ? theme['accent-fg']
                        : isCurrentMonth
                          ? theme.fg
                          : theme['fg-muted'],
                    }}
                  >
                    {format(day, 'd')}
                  </Text>

                  {/* T-0009-144: accent dot when collection has items on this date */}
                  {isMarked && !isSelected ? (
                    <View
                      style={{
                        position: 'absolute',
                        bottom: 3,
                        width: ACCENT_DOT_SIZE,
                        height: ACCENT_DOT_SIZE,
                        borderRadius: ACCENT_DOT_SIZE / 2,
                        backgroundColor: theme.accent,
                      }}
                      accessibilityElementsHidden
                      testID={`calendar-dot-${node.id}-${dayKey}`}
                    />
                  ) : null}
                </Pressable>
              )
            })}
          </View>
        ))}
      </View>
    </View>
  )
}
