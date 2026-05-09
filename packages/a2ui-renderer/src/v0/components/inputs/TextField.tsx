/**
 * TextFieldRenderer — single-line or multiline text input.
 *
 * Binding: valueBinding: StringBinding resolved via useBinding<string>.
 *   literal  → static display value (effectively read-only)
 *   state    → reads slot; commit-on-blur dispatches set(target, value)
 *   collectionField → reads row field; writes back via set dispatch
 *     (inside a ListItemContext; outside → warning via useBinding)
 *
 * Commit strategy: commit-on-blur (T-0006-097). onChange updates local
 * draft state; onBlur dispatches the final value to the renderer state.
 * This matches iOS TextInput UX: the field is responsive as-you-type
 * but only commits on leave, reducing noisy re-renders across the tree.
 *
 * maxLength: enforced by TextInput's maxLength prop.
 * multiline: 5-line height (88pt); single-line default 44pt.
 *
 * Focus animation: React Native's onFocus/onBlur callbacks update border
 * color. Reanimated worklet animation is deferred to Step 9 (polish pass).
 *
 * Accessibility:
 *   - accessibilityLabel: from node.accessibilityLabel ?? node.label
 *   - accessibilityHint: helperText (none in V0 schema; reserved)
 *   - accessibilityState: {disabled: node.optional is NOT the same as disabled;
 *     V0 schema has no disabled field on TextField, so always enabled}
 *
 * T-0006-087 / T-0006-088: snapshots at productive×focus + expressive×health
 * T-0006-097: commit-on-blur dispatches set with typed value
 * T-0006-102: 3 binding kinds render without error (15-test parameterized)
 * T-0006-103: collectionField binding outside ListItemContext → warning, empty
 * T-0006-104: maxLength enforced
 */
import React, {useState, useRef} from 'react'
import {View, Text, TextInput} from 'react-native'
import type {Node} from '@app-creator/protocol'
import {useTheme, useStance} from '../../theme/RendererThemeProvider.js'
import {useBinding} from '../../state/useBinding.js'
import {useRendererStateContext} from '../../state/useRendererState.js'
import {INPUT_DEFAULTS} from './defaults.js'

type TextFieldNode = Extract<Node, {type: 'TextField'}>

export function TextFieldRenderer({node}: {node: TextFieldNode}) {
  const theme = useTheme()
  const stance = useStance()
  const defaults = INPUT_DEFAULTS[stance]
  const {dispatch} = useRendererStateContext()

  // Resolve the current committed value from binding.
  const boundValue = useBinding<string>(node.valueBinding) ?? ''

  // Local draft tracks keystrokes; committed to renderer state on blur.
  const [draft, setDraft] = useState<string>(boundValue)
  const [focused, setFocused] = useState(false)

  // Sync draft when bound value changes externally (e.g., reset action).
  // Derived-state ref-guard pattern (ADR-0006 §K): synchronous during render,
  // no useEffect, no stale closures. The prevBoundValueRef tracks the last
  // external value we synced from. If boundValue has changed AND the field is
  // not focused, we sync immediately. While focused, we deliberately ignore
  // external changes so in-progress typing is never overwritten.
  const prevBoundValueRef = useRef(boundValue)
  if (prevBoundValueRef.current !== boundValue && !focused) {
    prevBoundValueRef.current = boundValue
    setDraft(boundValue)
  }

  function handleBlur() {
    setFocused(false)
    // Dispatch only for state or collectionField bindings — literal is read-only.
    if (node.valueBinding.kind === 'state') {
      dispatch({type: 'set', target: node.valueBinding.slot, value: draft})
    }
    // collectionField dispatch is handled at the List level in Step 7.
    // For V0 Step 6, we dispatch to the slot only; collectionField writes
    // are a Step 7 concern when the List context owns the row update.
  }

  const borderColor = focused ? theme.accent : theme.divider
  const borderWidth = focused ? 2 : 1
  const fieldHeight = node.multiline ? defaults.multilineHeight : defaults.fieldMinHeight
  const captionSpec = theme.type.caption
  const bodySpec = theme.type.body

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
          minHeight: fieldHeight,
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
          keyboardType={node.keyboardType ?? 'default'}
          maxLength={node.maxLength}
          multiline={node.multiline ?? false}
          numberOfLines={node.multiline ? 5 : 1}
          style={{
            fontSize: bodySpec.size,
            lineHeight: bodySpec.lineHeight,
            color: theme.fg,
            // TextInput needs explicit padding 0 on iOS to override defaults
            padding: 0,
          }}
          accessibilityLabel={node.accessibilityLabel ?? node.label}
        />
      </View>
    </View>
  )
}
