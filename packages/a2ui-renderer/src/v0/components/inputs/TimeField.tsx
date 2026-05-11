/**
 * TimeFieldRenderer — native time picker; counterpart to DateField.
 *
 * Storage: valueBinding: StringBinding — stored as "HH:MM" (24h) at protocol level.
 * Renderer converts iOS picker output to 24h HH:MM string on change.
 * Renderer formats for display per device locale (12h vs 24h via Intl hourCycle).
 *
 * Pattern: reuses DateField's Gorhom sheet wiring.
 * Uses @react-native-community/datetimepicker in 'time' mode (guarded import).
 *
 * Visual: tappable field showing formatted time; tap opens Gorhom sheet with
 *   iOS-native time picker in spinner mode. Matches DateField visual shape.
 *
 * Accessibility:
 *   - accessibilityRole="button" (opens a picker on tap)
 *   - accessibilityLabel: node.accessibilityLabel ?? node.label
 *   - accessibilityHint: "Opens time picker"
 *
 * V1 Phase 1 Step 2 — ADR-0009
 * T-0009-038..039, T-0009-059 (snapshot), T-0009-062
 */
import React, {useRef} from 'react'
import {View, Text, Pressable, Platform} from 'react-native'
import {BottomSheetModal, BottomSheetModalProvider, BottomSheetView} from '@gorhom/bottom-sheet'
import type {Node} from '@app-creator/protocol'
import {useTheme, useStance} from '../../theme/RendererThemeProvider.js'
import {useBinding} from '../../state/useBinding.js'
import {useRendererStateContext} from '../../state/useRendererState.js'
import {INPUT_DEFAULTS} from './defaults.js'

type TimeFieldNode = Extract<Node, {type: 'TimeField'}>

// ---------------------------------------------------------------------------
// § Time helpers
// ---------------------------------------------------------------------------

/**
 * parseHHMM — parse a "HH:MM" 24h string into a Date object (today + that time).
 * Returns null if the string is malformed.
 */
function parseHHMM(hhMM: string): Date | null {
  if (!hhMM) return null
  const [hoursStr, minutesStr] = hhMM.split(':')
  const hours = parseInt(hoursStr ?? '', 10)
  const minutes = parseInt(minutesStr ?? '', 10)
  if (isNaN(hours) || isNaN(minutes)) return null
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  const d = new Date()
  d.setHours(hours, minutes, 0, 0)
  return d
}

/**
 * dateToHHMM — convert a Date to a "HH:MM" 24h string.
 */
export function dateToHHMM(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

/**
 * formatTimeForDisplay — format a "HH:MM" string for display using device locale.
 * If device uses 24h: "13:30". If 12h: "1:30 PM".
 * Returns "—" for empty/invalid input.
 */
export function formatTimeForDisplay(hhMM: string | undefined): string {
  if (!hhMM) return '—'
  const date = parseHHMM(hhMM)
  if (!date) return '—'
  try {
    // Intl.DateTimeFormat respects the device's 24h preference.
    return date.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      // No hourCycle override — let device locale decide 12h vs 24h.
    })
  } catch {
    return hhMM
  }
}

// ---------------------------------------------------------------------------
// § Guarded DateTimePicker import (same pattern as DateField)
// ---------------------------------------------------------------------------

let DateTimePicker: React.ComponentType<{
  value: Date
  mode: 'time'
  display?: string
  onChange: (event: unknown, date?: Date) => void
  testID?: string
}> | null = null

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('@react-native-community/datetimepicker')
  DateTimePicker = mod.default ?? mod.DateTimePicker ?? null
} catch {
  // Not installed — sheet falls back to text prompt.
}

// ---------------------------------------------------------------------------
// § Renderer
// ---------------------------------------------------------------------------

export function TimeFieldRenderer({node}: {node: TimeFieldNode}) {
  const theme = useTheme()
  const stance = useStance()
  const defaults = INPUT_DEFAULTS[stance]
  const {dispatch} = useRendererStateContext()
  const sheetRef = useRef<BottomSheetModal>(null)

  const boundValue = useBinding<string>(node.valueBinding)
  const displayValue = formatTimeForDisplay(boundValue)

  const captionSpec = theme.type.caption
  const bodySpec = theme.type.body

  function handlePress() {
    sheetRef.current?.present()
  }

  function handleTimeChange(_event: unknown, selectedDate?: Date) {
    if (selectedDate && node.valueBinding.kind === 'state') {
      dispatch({
        type: 'set',
        target: node.valueBinding.slot,
        value: dateToHHMM(selectedDate),
      })
    }
    if (Platform.OS === 'ios') {
      sheetRef.current?.dismiss()
    }
  }

  // Build picker value from bound HH:MM string, or default to current time.
  const pickerValue = (boundValue ? parseHHMM(boundValue) : null) ?? new Date()

  return (
    <BottomSheetModalProvider>
      <View>
        {/* Label */}
        <Text
          style={{
            fontSize: captionSpec.size,
            lineHeight: captionSpec.lineHeight,
            fontWeight: '400',
            letterSpacing: captionSpec.letterSpacing,
            color: theme['fg-muted'],
            marginBottom: theme.spacing['space-xs'],
          }}
          accessibilityElementsHidden
        >
          {node.label}
        </Text>

        {/* Tappable field */}
        <Pressable
          onPress={handlePress}
          style={({pressed}) => ({
            minHeight: defaults.fieldMinHeight,
            backgroundColor: pressed ? theme['bg-overlay'] : theme['bg-elevated'],
            borderRadius: theme.radii['radius-md'],
            borderWidth: 1,
            borderColor: theme.divider,
            paddingHorizontal: theme.spacing['space-md'],
            paddingVertical: theme.spacing['space-sm'],
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          })}
          accessibilityRole="button"
          accessibilityLabel={node.accessibilityLabel ?? node.label}
          accessibilityHint="Opens time picker"
          testID={`timefield-trigger-${node.id}`}
        >
          <Text
            style={{
              fontSize: bodySpec.size,
              lineHeight: bodySpec.lineHeight,
              color: boundValue ? theme.fg : theme['fg-faint'],
            }}
          >
            {displayValue}
          </Text>
          <Text style={{color: theme['fg-faint'], fontSize: 14}}>{'›'}</Text>
        </Pressable>
      </View>

      {/* Gorhom Bottom Sheet with native time picker */}
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={['40%']}
        enablePanDownToClose
      >
        <BottomSheetView style={{flex: 1, alignItems: 'center', paddingTop: 16}}>
          {DateTimePicker ? (
            <DateTimePicker
              value={pickerValue}
              mode="time"
              display="spinner"
              onChange={handleTimeChange}
              testID={`timefield-picker-${node.id}`}
            />
          ) : (
            <Text
              style={{
                fontSize: bodySpec.size,
                color: theme['fg-muted'],
                textAlign: 'center',
                padding: 24,
              }}
            >
              Time picker not available
            </Text>
          )}
        </BottomSheetView>
      </BottomSheetModal>
    </BottomSheetModalProvider>
  )
}
