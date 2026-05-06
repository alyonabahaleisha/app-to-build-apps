/**
 * TextInputRenderer — A2UI TextInput component.
 *
 * Visual layout per Sable §A2UI Catalog Visual Treatment (line 402):
 *   radius: md, border.subtle, padding 12pt vertical / 14pt horizontal.
 *   Label sits above the input (caption typography, text.muted).
 *   Focus state: border becomes palette.primary.
 *   Multi-line: 5-line max, then internal scroll.
 *
 * State reads from state[node.id] as a string; defaults to '' when no entry.
 * Non-string state (null, boolean, number) is handled defensively:
 *   - null or number → renders empty without throwing (T-0003-088, T-0003-088b).
 *   - boolean → renders empty + warn-logs a2ui_textinput_type_mismatch
 *     (T-0003-088c). Payload MUST NOT include the actual value (PII rule §G-4).
 *
 * Dispatch:
 *   onChangeText(text) → dispatch({type:'set', targetId: node.id, value: text})
 *
 * Focus state (T-0003-088d):
 *   React useState for border color only. This is display state, not user state
 *   — the "no internal state" rule in ADR §D refers to A2UI value state. Focus
 *   tracking is a legitimate UI affordance (same pattern as pressed state in
 *   Button/Counter).
 *
 * Accessibility:
 *   accessibilityLabel = node.label (T-0003-087).
 */
import React, {useState} from 'react'
import {StyleSheet, Text, TextInput as RNTextInput, View} from 'react-native'

import {useRendererLogger} from '../logger/RendererLoggerProvider'
import {useRendererTheme} from '../theme/RendererThemeProvider'
import type {Dispatch, RenderState} from '../types'

// -- Node type ----------------------------------------------------------------

export type A2UITextInputNode = {
  type: 'TextInput'
  id: string
  label: string
  placeholder?: string
  multiline?: boolean
}

export interface TextInputNodeProps {
  node: A2UITextInputNode
  state: RenderState
  dispatch: Dispatch
}

// -- Component ----------------------------------------------------------------

export function TextInputRenderer({node, state, dispatch}: TextInputNodeProps): React.ReactElement {
  const theme = useRendererTheme()
  const logger = useRendererLogger()
  const [focused, setFocused] = useState(false)

  // Defensive state read:
  // - undefined / null / number → render empty string without throwing (T-0003-088, T-0003-088b).
  // - boolean → render empty + warn-log (T-0003-088c). No actual value in log per §G-4 PII rule.
  // - string → use directly (T-0003-086).
  const rawValue = state[node.id]
  let displayValue = ''
  if (typeof rawValue === 'string') {
    displayValue = rawValue
  } else if (typeof rawValue === 'boolean') {
    logger.warn('a2ui_textinput_type_mismatch', {
      id: node.id,
      expectedType: 'string',
      actualType: 'boolean',
      // NOTE: actual value intentionally omitted — §G-4 PII rule.
    })
    displayValue = ''
  }
  // null, undefined, number → silently render empty (T-0003-088, T-0003-088b).

  const borderColor = focused ? theme.palette.primary : theme.palette.border.subtle

  return (
    <View>
      {/* Label above input — caption style, text.muted */}
      <Text style={[theme.typography.caption, {color: theme.palette.text.muted}]}>
        {node.label}
      </Text>

      <RNTextInput
        accessibilityLabel={node.label}
        value={displayValue}
        placeholder={node.placeholder}
        placeholderTextColor={theme.palette.text.muted}
        multiline={node.multiline}
        // 5-line max with internal scroll when multiline (Sable line 402).
        numberOfLines={node.multiline ? 5 : undefined}
        scrollEnabled={node.multiline ? true : undefined}
        onChangeText={(text: string) => {
          dispatch({type: 'set', targetId: node.id, value: text})
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          styles.input,
          {
            borderColor,
            borderRadius: theme.radius.md,
            color: theme.palette.text.primary,
            ...theme.typography.body,
          },
        ]}
      />
    </View>
  )
}

// -- Styles -------------------------------------------------------------------

const styles = StyleSheet.create({
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
})
