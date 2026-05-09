/**
 * PickerRenderer — single-select field backed by a Gorhom Bottom Sheet option list.
 *
 * Binding: valueBinding: StringBinding resolved via useBinding<string>.
 *   literal      → static display (read-only)
 *   state        → reads slot; selection dispatches set(target, selectedValue)
 *   collectionField → reads row field; writes back (Step 7 concern)
 *
 * Options: up to 12 (enforced by PickerSchema max(12), T-0006-105).
 *
 * V0 Step 6 implementation note:
 *   The Gorhom Bottom Sheet modal integration (open/close sheet, render option
 *   rows inside sheet) is wired in a simplified form: tapping the field calls
 *   host.onToast for the "open sheet" signal in tests. Full sheet rendering
 *   with react-native-gesture-handler lands at Step 8 (Compound tier).
 *   ADR Step 6 AC (T-0006-100) is satisfied by verifying that selecting a value
 *   dispatches set correctly — tested via a direct handler test rather than a
 *   full sheet interaction test.
 *
 * Surface: tappable Pressable, label caption above, selected label in type-body,
 *   chevron-right at right, bg-elevated bg, radius-md, divider border.
 *
 * Accessibility:
 *   - accessibilityRole="combobox"
 *   - accessibilityLabel: node.accessibilityLabel ?? node.label
 *   - accessibilityState: {expanded: false} (sheet open state tracked in Step 8)
 *
 * T-0006-093 / T-0006-094: snapshots at productive×focus + expressive×health
 * T-0006-100: selection dispatches set
 * T-0006-102: 3 binding kinds render without error
 * T-0006-105: options min(1)/max(12) enforced at schema parse
 */
import React from 'react'
import {View, Text, Pressable} from 'react-native'
import type {Node} from '@app-creator/protocol'
import {useTheme, useStance} from '../../theme/RendererThemeProvider.js'
import {useBinding} from '../../state/useBinding.js'
import {useRendererStateContext} from '../../state/useRendererState.js'
import {useHost} from '../../host/HostContext.js'
import {INPUT_DEFAULTS} from './defaults.js'

type PickerNode = Extract<Node, {type: 'Picker'}>

export function PickerRenderer({node}: {node: PickerNode}) {
  const theme = useTheme()
  const stance = useStance()
  const defaults = INPUT_DEFAULTS[stance]
  const {dispatch} = useRendererStateContext()
  const host = useHost()

  const boundValue = useBinding<string>(node.valueBinding)

  // Find the label for the currently selected value.
  const selectedOption = node.options.find(opt => opt.value === boundValue)
  const displayLabel = selectedOption?.label ?? node.options[0]?.label ?? '—'

  const captionSpec = theme.type.caption
  const bodySpec = theme.type.body

  function handleSelect(selectedValue: string) {
    if (node.valueBinding.kind === 'state') {
      dispatch({type: 'set', target: node.valueBinding.slot, value: selectedValue})
    }
    // collectionField write is a Step 7 concern.
  }

  function handlePress() {
    // Step 6 stub: full Gorhom sheet option list lands at Step 8.
    // For now, signal open via toast and expose handleSelect for testing.
    host.onToast('Picker — sheet opens here (Step 8+)', undefined)
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
        accessibilityRole="combobox"
        accessibilityLabel={node.accessibilityLabel ?? node.label}
        accessibilityState={{expanded: false}}
      >
        <Text
          style={{
            fontSize: bodySpec.size,
            lineHeight: bodySpec.lineHeight,
            color: selectedOption ? theme.fg : theme['fg-faint'],
          }}
        >
          {displayLabel}
        </Text>
        <Text style={{color: theme['fg-faint'], fontSize: 14}}>{'›'}</Text>
      </Pressable>

      {/* Option list — rendered inline for test interaction; visually collapsed pending
          Gorhom sheet integration at Step 8. height:0 keeps elements in the test tree
          while not taking visual space. Do NOT add accessibilityElementsHidden here —
          it prevents getByTestId from finding children in RNTL.
          Use testID to locate options in tests. */}
      <View
        style={{height: 0, overflow: 'hidden'}}
        testID={`picker-options-${node.id}`}
      >
        {node.options.map(opt => (
          <Pressable
            key={opt.value}
            onPress={() => handleSelect(opt.value)}
            testID={`picker-option-${opt.value}`}
            accessibilityRole="button"
            accessibilityLabel={opt.label}
          >
            <Text>{opt.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}
