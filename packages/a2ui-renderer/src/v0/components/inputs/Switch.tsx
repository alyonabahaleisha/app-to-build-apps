/**
 * SwitchRenderer — iOS-native toggle with label.
 *
 * Binding: valueBinding: BooleanBinding resolved via useBinding<boolean>.
 *   literal      → static display (read-only)
 *   state        → reads slot; toggle dispatches set(target, !current)
 *   collectionField → reads row field; writes back (Step 7 concern)
 *
 * Surface: full-width row, label left (type-body, fg), Switch right.
 *   Min 56pt row height for hit target (UX doc §Inputs tier, Switch spec).
 *   trackColor: on = accent, off = divider.
 *   Light haptic on toggle (wired at Step 9 via feedback middleware; in Step 6
 *   the dispatch drives the state change, haptic fires from haptics middleware).
 *
 * Accessibility:
 *   - accessibilityRole="switch"
 *   - accessibilityLabel: node.accessibilityLabel ?? node.label
 *   - accessibilityState: {checked: currentValue}
 *
 * T-0006-095 / T-0006-096: snapshots at productive×focus + expressive×health
 * T-0006-101: toggle dispatches set with !current value
 * T-0006-102: 3 binding kinds render without error
 */
import React from 'react'
import {View, Text, Switch} from 'react-native'
import type {Node} from '@app-creator/protocol'
import {useTheme} from '../../theme/RendererThemeProvider.js'
import {useBinding} from '../../state/useBinding.js'
import {useRendererStateContext} from '../../state/useRendererState.js'

type SwitchNode = Extract<Node, {type: 'Switch'}>

export function SwitchRenderer({node}: {node: SwitchNode}) {
  const theme = useTheme()
  const {dispatch} = useRendererStateContext()

  const currentValue = useBinding<boolean>(node.valueBinding) ?? false

  function handleValueChange(next: boolean) {
    if (node.valueBinding.kind === 'state') {
      dispatch({type: 'set', target: node.valueBinding.slot, value: next})
    }
    // collectionField write is a Step 7 concern.
    // literal bindings are read-only — no dispatch.
  }

  const bodySpec = theme.type.body

  return (
    <View
      style={{
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: theme.spacing['space-md'],
      }}
    >
      {/* Label — VoiceOver reads via the Switch's accessibilityLabel below */}
      <Text
        style={{
          flex: 1,
          fontSize: bodySpec.size,
          lineHeight: bodySpec.lineHeight,
          fontWeight: '400',
          letterSpacing: bodySpec.letterSpacing,
          color: theme.fg,
          marginRight: theme.spacing['space-md'],
        }}
        accessibilityElementsHidden
      >
        {node.label}
      </Text>

      {/* iOS-native Switch — carries the a11y role, label, and checked state. */}
      <Switch
        value={currentValue}
        onValueChange={handleValueChange}
        trackColor={{false: theme.divider, true: theme.accent}}
        thumbColor={theme['bg-elevated']}
        accessibilityRole="switch"
        accessibilityLabel={node.accessibilityLabel ?? node.label}
        accessibilityState={{checked: currentValue}}
      />
    </View>
  )
}
