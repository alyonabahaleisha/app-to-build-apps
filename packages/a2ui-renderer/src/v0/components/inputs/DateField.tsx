/**
 * DateFieldRenderer — tappable date/time field backed by a native date picker.
 *
 * Binding: valueBinding: DateBinding resolved via useBinding<string>.
 *   The protocol stores dates as ISO 8601 strings.
 *
 * V0 Step 6 implementation note:
 *   Full DateTimePickerIOS (from @react-native-community/datetimepicker) is not
 *   installed in this package yet — the dependency lands with the Gorhom-sheet
 *   integration polish at Step 8. For Step 6, the field renders the current
 *   formatted date value and tapping calls host.onToast with a "date picker
 *   coming soon" message. The Gorhom sheet + native picker integration is the
 *   Step 8 Compound-tier concern. ADR Step 6 AC (T-0006-099) is satisfied by
 *   verifying the onPress handler is wired — native picker content tested at Step 8.
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
 * T-0006-099: tap triggers picker open (stub: onPress wired, toast fired)
 * T-0006-102: 3 binding kinds render without error
 */
import React from 'react'
import {View, Text, Pressable} from 'react-native'
import type {Node} from '@app-creator/protocol'
import {useTheme, useStance} from '../../theme/RendererThemeProvider.js'
import {useBinding} from '../../state/useBinding.js'
import {useHost} from '../../host/HostContext.js'
import {INPUT_DEFAULTS} from './defaults.js'

type DateFieldNode = Extract<Node, {type: 'DateField'}>

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
  const host = useHost()

  const boundValue = useBinding<string>(node.valueBinding)
  const displayValue = formatDateValue(boundValue, node.mode)

  const captionSpec = theme.type.caption
  const bodySpec = theme.type.body

  function handlePress() {
    // Step 6 stub: real DateTimePickerIOS in Gorhom sheet lands at Step 8.
    host.onToast('Date picker — coming in a future step', undefined)
  }

  return (
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
        {/* Chevron placeholder — Icon component from design-system would be used here */}
        <Text style={{color: theme['fg-faint'], fontSize: 14}}>{'›'}</Text>
      </Pressable>
    </View>
  )
}
