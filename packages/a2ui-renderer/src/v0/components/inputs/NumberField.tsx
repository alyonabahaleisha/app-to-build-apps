/**
 * NumberFieldRenderer — numeric text input with optional min/max/step constraints.
 *
 * Same visual shape as TextField: label above, input container bg-elevated,
 * radius-md, divider border with accent focus ring.
 *
 * Binding: valueBinding: NumberBinding resolved via useBinding<number>.
 *   literal      → static display (read-only render)
 *   state        → reads slot; commit-on-blur dispatches set(target, numeric)
 *   collectionField → reads row field; writes back (Step 7 concern)
 *
 * Numeric enforcement:
 *   keyboardType="numeric" restricts the keyboard. On blur, the draft string
 *   is parsed via parseFloat; NaN → rejected (T-0006-098), field reverts to
 *   bound value. min/max clamping applied before dispatch.
 *
 * Accessibility:
 *   - accessibilityRole="adjustable" (numeric adjustable field)
 *   - accessibilityValue.text: current value as string (announces on change)
 *   - accessibilityLabel: node.accessibilityLabel ?? node.label
 *
 * T-0006-089 / T-0006-090: snapshots at productive×focus + expressive×health
 * T-0006-098: non-numeric input rejected on blur
 * T-0006-102: 3 binding kinds render without error
 */
import React, {useState, useRef} from 'react'
import {View, Text, TextInput} from 'react-native'
import type {Node} from '@app-creator/protocol'
import {useTheme, useStance} from '../../theme/RendererThemeProvider.js'
import {useBinding} from '../../state/useBinding.js'
import {useRendererStateContext} from '../../state/useRendererState.js'
import {INPUT_DEFAULTS} from './defaults.js'

type NumberFieldNode = Extract<Node, {type: 'NumberField'}>

export function NumberFieldRenderer({node}: {node: NumberFieldNode}) {
  const theme = useTheme()
  const stance = useStance()
  const defaults = INPUT_DEFAULTS[stance]
  const {dispatch} = useRendererStateContext()

  const boundValue = useBinding<number>(node.valueBinding)
  const boundStr = boundValue != null ? String(boundValue) : ''

  const [draft, setDraft] = useState<string>(boundStr)
  const [focused, setFocused] = useState(false)

  // Derived-state ref-guard pattern (ADR-0006 §K): no useEffect, no stale closures.
  // Sync draft from the external bound value only when not focused.
  const prevBoundValueRef = useRef(boundValue)
  if (prevBoundValueRef.current !== boundValue && !focused) {
    prevBoundValueRef.current = boundValue
    setDraft(boundValue != null ? String(boundValue) : '')
  }

  function handleBlur() {
    setFocused(false)

    if (node.valueBinding.kind !== 'state') return

    const parsed = parseFloat(draft)
    if (isNaN(parsed)) {
      // Reject non-numeric input — revert draft to bound value (T-0006-098).
      setDraft(boundValue != null ? String(boundValue) : '')
      return
    }

    // Clamp to min/max if defined.
    let clamped = parsed
    if (node.min != null && clamped < node.min) clamped = node.min
    if (node.max != null && clamped > node.max) clamped = node.max

    dispatch({type: 'set', target: node.valueBinding.slot, value: clamped})
  }

  const borderColor = focused ? theme.accent : theme.divider
  const borderWidth = focused ? 2 : 1
  const captionSpec = theme.type.caption
  const bodySpec = theme.type.body
  const currentNumber = boundValue ?? 0

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

      {/* Input container */}
      <View
        style={{
          minHeight: defaults.fieldMinHeight,
          backgroundColor: theme['bg-elevated'],
          borderRadius: theme.radii['radius-md'],
          borderWidth,
          borderColor,
          paddingHorizontal: theme.spacing['space-md'],
          paddingVertical: theme.spacing['space-sm'],
          justifyContent: 'center',
        }}
      >
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onFocus={() => setFocused(true)}
          onBlur={handleBlur}
          placeholder={node.placeholder}
          placeholderTextColor={theme['fg-faint']}
          keyboardType="numeric"
          style={{
            fontSize: bodySpec.size,
            lineHeight: bodySpec.lineHeight,
            color: theme.fg,
            padding: 0,
          }}
          accessibilityRole="adjustable"
          accessibilityLabel={node.accessibilityLabel ?? node.label}
          accessibilityValue={{text: String(currentNumber)}}
        />
      </View>
    </View>
  )
}
