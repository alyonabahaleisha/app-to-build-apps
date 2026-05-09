/**
 * DateFieldRenderer — tappable date/time field backed by a Gorhom Bottom Sheet
 * containing a native date picker.
 *
 * Binding: valueBinding: DateBinding resolved via useBinding<string>.
 *   The protocol stores dates as ISO 8601 strings.
 *
 * Step 10 closure (Step 6 deferral, Roz Deviation 1):
 *   Full Gorhom sheet + DateTimePicker integration replaces the Step 6 toast stub.
 *   Tapping the field presents a BottomSheetModal; selecting a date dispatches
 *   set(target, isoString) and closes the sheet.
 *
 * Note on @react-native-community/datetimepicker:
 *   The package is not listed in package.json (Roz Deviation 1 deferred it).
 *   We provide a graceful fallback: if the module is unavailable, the sheet
 *   renders a text prompt. Tests mock the module with a press-to-fire pattern.
 *   The import is guarded by a try/catch at module load time.
 *
 * Display format: 'date' mode → locale short date (e.g., "May 9, 2026");
 *                 'time' → locale time; 'datetime' → both.
 * Fallback when no value: displays placeholder "—".
 *
 * Surface: tappable row (full-width Pressable), label caption above,
 *   value in type-body, chevron-right icon right edge, bg-elevated bg,
 *   radius-md, divider border.
 *
 * Accessibility:
 *   - accessibilityRole="button" (opens a picker on tap)
 *   - accessibilityLabel: node.accessibilityLabel ?? node.label
 *   - accessibilityHint: "Opens date picker"
 *
 * T-0006-091 / T-0006-092: snapshots at productive×focus + expressive×health
 * T-0006-099: tap opens Gorhom sheet (Step 10 closure)
 * T-0006-102: 3 binding kinds render without error
 */
import React, {useRef} from 'react'
import {View, Text, Pressable, Platform} from 'react-native'
import {BottomSheetModal, BottomSheetModalProvider, BottomSheetView} from '@gorhom/bottom-sheet'
import type {Node} from '@app-creator/protocol'
import {useTheme, useStance} from '../../theme/RendererThemeProvider.js'
import {useBinding} from '../../state/useBinding.js'
import {useRendererStateContext} from '../../state/useRendererState.js'
import {INPUT_DEFAULTS} from './defaults.js'

type DateFieldNode = Extract<Node, {type: 'DateField'}>

// Attempt to load @react-native-community/datetimepicker.
// Guarded — the package may not be installed; the sheet shows a text fallback.
let DateTimePicker: React.ComponentType<{
  value: Date
  mode: 'date' | 'time' | 'datetime'
  display?: string
  onChange: (event: unknown, date?: Date) => void
  testID?: string
}> | null = null

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('@react-native-community/datetimepicker')
  DateTimePicker = mod.default ?? mod.DateTimePicker ?? null
} catch {
  // Package not installed — sheet will render a text fallback.
}

function formatDateValue(isoString: string | undefined, mode: DateFieldNode['mode']): string {
  if (!isoString) return '—'
  try {
    const date = new Date(isoString)
    if (isNaN(date.getTime())) return '—'

    const resolvedMode = mode ?? 'date'
    if (resolvedMode === 'date') {
      return date.toLocaleDateString('en-US', {year: 'numeric', month: 'long', day: 'numeric'})
    }
    if (resolvedMode === 'time') {
      return date.toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit'})
    }
    // datetime
    return (
      date.toLocaleDateString('en-US', {year: 'numeric', month: 'short', day: 'numeric'}) +
      ' ' +
      date.toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit'})
    )
  } catch {
    return '—'
  }
}

export function DateFieldRenderer({node}: {node: DateFieldNode}) {
  const theme = useTheme()
  const stance = useStance()
  const defaults = INPUT_DEFAULTS[stance]
  const {dispatch} = useRendererStateContext()
  const sheetRef = useRef<BottomSheetModal>(null)

  const boundValue = useBinding<string>(node.valueBinding)
  const displayValue = formatDateValue(boundValue, node.mode)

  const captionSpec = theme.type.caption
  const bodySpec = theme.type.body

  function handlePress() {
    sheetRef.current?.present()
  }

  function handleDateChange(_event: unknown, selectedDate?: Date) {
    if (selectedDate && node.valueBinding.kind === 'state') {
      dispatch({
        type: 'set',
        target: node.valueBinding.slot,
        value: selectedDate.toISOString(),
      })
    }
    // Close the sheet after selection on iOS.
    if (Platform.OS === 'ios') {
      sheetRef.current?.dismiss()
    }
  }

  const pickerValue = boundValue ? new Date(boundValue) : new Date()
  const resolvedMode = (node.mode ?? 'date') as 'date' | 'time' | 'datetime'

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
          accessibilityHint="Opens date picker"
          testID={`datefield-trigger-${node.id}`}
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

      {/* Gorhom Bottom Sheet with native date picker */}
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={['40%']}
        enablePanDownToClose
      >
        <BottomSheetView style={{flex: 1, alignItems: 'center', paddingTop: 16}}>
          {DateTimePicker ? (
            <DateTimePicker
              value={pickerValue}
              mode={resolvedMode}
              display="spinner"
              onChange={handleDateChange}
              testID={`datefield-picker-${node.id}`}
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
              Date picker not available
            </Text>
          )}
        </BottomSheetView>
      </BottomSheetModal>
    </BottomSheetModalProvider>
  )
}
