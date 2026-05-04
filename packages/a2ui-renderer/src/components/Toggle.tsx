/**
 * ToggleRenderer — A2UI Toggle component.
 *
 * Visual layout per Sable §A2UI Catalog Visual Treatment (line 403) and
 * Notes-for-Colby #3:
 *   RN Switch in a row container with min-height 56pt.
 *   Label on the left (body style, text.primary), switch on the right.
 *   Full-width row.
 *   trackColor: palette.primary when on, border.strong when off.
 *
 * State reads from state[node.id] as boolean; defaults to node.defaultValue ?? false.
 * Non-boolean state is handled defensively:
 *   - non-boolean → coerce to false + warn-logs a2ui_toggle_type_mismatch
 *     (T-0003-095). Payload MUST NOT include the actual value (PII rule §G-4).
 *
 * Missing id (T-0003-095b):
 *   If node.id is falsy (forced via `as any` bypass of Zod validation), render
 *   a disabled Switch + warn-log a2ui_toggle_missing_id. Does NOT throw — the
 *   Error Boundary must not trip on schema violations introduced post-validation.
 *
 * Dispatch:
 *   onValueChange(nextBool) → dispatch({type:'set', targetId: node.id, value: nextBool})
 *
 * Accessibility:
 *   accessibilityRole="switch" (T-0003-094)
 *   accessibilityLabel = node.label
 */
import React from 'react'
import {StyleSheet, Switch, Text, View} from 'react-native'

import {useRendererLogger} from '../logger/RendererLoggerProvider'
import {useRendererTheme} from '../theme/RendererThemeProvider'
import type {Dispatch, RenderState} from '../types'

// -- Node type ----------------------------------------------------------------

export type A2UIToggleNode = {
  type: 'Toggle'
  id: string
  label: string
  defaultValue?: boolean
}

export interface ToggleNodeProps {
  node: A2UIToggleNode
  state: RenderState
  dispatch: Dispatch
}

// -- Component ----------------------------------------------------------------

export function ToggleRenderer({
  node,
  state,
  dispatch,
}: ToggleNodeProps): React.ReactElement {
  const theme = useRendererTheme()
  const logger = useRendererLogger()

  // Missing id guard (T-0003-095b): schema requires id, but post-validation
  // mutations or test-harness `as any` casts can bypass that. Render a disabled
  // switch rather than crash or trip the Error Boundary.
  if (!node.id) {
    logger.warn('a2ui_toggle_missing_id', {})
    return (
      <View style={styles.row}>
        <Text style={[theme.typography.body, {color: theme.palette.text.primary, flex: 1}]}>
          {node.label}
        </Text>
        <Switch
          value={false}
          disabled={true}
          accessibilityRole="switch"
          accessibilityLabel={node.label}
          trackColor={{true: theme.palette.primary, false: theme.palette.border.strong}}
          onValueChange={() => undefined}
        />
      </View>
    )
  }

  // Defensive state read:
  // - boolean → use directly (T-0003-092).
  // - non-boolean → coerce to false + warn-log (T-0003-095).
  //   Payload MUST NOT include the actual value (PII rule §G-4).
  const rawValue = state[node.id]
  let displayValue: boolean
  if (typeof rawValue === 'boolean') {
    displayValue = rawValue
  } else if (rawValue === undefined) {
    // No state entry yet → fall back to node.defaultValue ?? false (T-0003-092).
    displayValue = node.defaultValue ?? false
  } else {
    // Non-boolean value found — coerce to false + warn-log.
    logger.warn('a2ui_toggle_type_mismatch', {
      id: node.id,
      expectedType: 'boolean',
      actualType: typeof rawValue,
      // NOTE: actual value intentionally omitted — §G-4 PII rule.
    })
    displayValue = false
  }

  return (
    <View style={styles.row}>
      <Text style={[theme.typography.body, {color: theme.palette.text.primary, flex: 1}]}>
        {node.label}
      </Text>
      <Switch
        value={displayValue}
        accessibilityRole="switch"
        accessibilityLabel={node.label}
        trackColor={{true: theme.palette.primary, false: theme.palette.border.strong}}
        onValueChange={(nextBool: boolean) => {
          dispatch({type: 'set', targetId: node.id, value: nextBool})
        }}
      />
    </View>
  )
}

// -- Styles -------------------------------------------------------------------

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    width: '100%',
  },
})
