/**
 * CounterRenderer — A2UI Counter component.
 *
 * Visual layout per Sable §A2UI Catalog Visual Treatment (line 404):
 *   Three-element row:
 *     − button  (secondary variant, square 44pt)
 *     value     (heading2 style, center, min-width 60pt)
 *     + button  (secondary variant, square 44pt)
 *   Label above the row (caption style, text.muted).
 *
 * State reads from state[node.id] as a number; defaults to node.min ?? 0 when
 * no entry exists (T-0003-070).
 *
 * Dispatch:
 *   + → dispatch({type:'increment', targetId:node.id, by:node.step ?? 1})
 *   − → dispatch({type:'decrement', targetId:node.id, by:node.step ?? 1})
 * The hook's counterBoundsMap enriches the action with min/max (§I.1 of
 * ADR-0003). The component does NOT pass min/max in the action — bounds belong
 * to the spec, not the dispatch surface.
 *
 * Disabled state at boundary (Sable line 404, ADR §I):
 *   At value === max: + is disabled (no-op press + accessibilityState.disabled).
 *   At value === min: − is disabled symmetrically.
 *
 * Accessibility (Sable line 322):
 *   accessibilityLabel = "<label>, current value <n>"
 *   accessibilityActions = [{name:'increment'}, {name:'decrement'}]
 *
 * Haptics: light impact on inc/dec, wrapped in try/catch (per Step 4 pattern).
 * Simulators without haptic hardware throw; we must never let that propagate.
 *
 * NO scale animation in M1 — ADR Step 5 explicitly defers this to Phase 2.
 * Value updates instantly (Notes-for-Colby #7).
 */
import * as Haptics from 'expo-haptics'
import React from 'react'
import {Pressable, StyleSheet, Text, View} from 'react-native'

import {useRendererTheme} from '../theme/RendererThemeProvider'
import type {Dispatch, RenderState} from '../types'

// -- Node type ----------------------------------------------------------------

export type A2UICounterNode = {
  type: 'Counter'
  id: string
  label: string
  min?: number
  max?: number
  step?: number
}

export interface CounterNodeProps {
  node: A2UICounterNode
  state: RenderState
  dispatch: Dispatch
}

// -- Component ----------------------------------------------------------------

export function CounterRenderer({node, state, dispatch}: CounterNodeProps): React.ReactElement {
  const theme = useRendererTheme()

  const rawValue = state[node.id]
  // Numeric state read; default to node.min ?? 0 when undefined (T-0003-070).
  const value: number = typeof rawValue === 'number' ? rawValue : (node.min ?? 0)

  const by = node.step ?? 1
  const atMin = node.min !== undefined && value <= node.min
  const atMax = node.max !== undefined && value >= node.max

  function fireHaptic() {
    // Do NOT await — tap must not block on haptic hardware.
    // Wrapped in try/catch: Haptics throws on simulators without haptic
    // hardware (Notes-for-Colby #7, T-0003-081).
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    } catch {
      // Intentional no-op. Haptic failure must not prevent dispatch.
    }
  }

  function handleDecrement() {
    if (atMin) return
    fireHaptic()
    dispatch({type: 'decrement', targetId: node.id, by})
  }

  function handleIncrement() {
    if (atMax) return
    fireHaptic()
    dispatch({type: 'increment', targetId: node.id, by})
  }

  const secondaryStyle = {
    backgroundColor: theme.palette.bg.subtle,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.palette.border.subtle,
  }

  return (
    <View
      accessibilityLabel={`${node.label}, current value ${value}`}
      accessibilityActions={[{name: 'increment'}, {name: 'decrement'}]}
      onAccessibilityAction={event => {
        if (event.nativeEvent.actionName === 'increment') handleIncrement()
        if (event.nativeEvent.actionName === 'decrement') handleDecrement()
      }}
    >
      {/* Label row above the counter */}
      <Text style={[theme.typography.caption, {color: theme.palette.text.muted}]}>
        {node.label}
      </Text>

      {/* Three-element row: − | value | + */}
      <View style={styles.row}>
        {/* Decrement button — square 44pt, secondary variant */}
        <Pressable
          onPress={handleDecrement}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${node.label}`}
          accessibilityState={{disabled: atMin}}
          style={({pressed}) => [
            styles.stepButton,
            secondaryStyle,
            {borderRadius: theme.radius.md},
            pressed && !atMin && styles.pressed,
            atMin && styles.disabledButton,
          ]}
        >
          <Text
            style={[
              theme.typography.bodyStrong,
              {color: atMin ? theme.palette.text.muted : theme.palette.text.primary},
            ]}
          >
            −
          </Text>
        </Pressable>

        {/* Value display — heading2 style, centered, min-width 60pt */}
        <View style={styles.valueContainer}>
          <Text
            style={[
              theme.typography.heading2,
              {color: theme.palette.text.primary, textAlign: 'center'},
            ]}
          >
            {value}
          </Text>
        </View>

        {/* Increment button — square 44pt, secondary variant */}
        <Pressable
          onPress={handleIncrement}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${node.label}`}
          accessibilityState={{disabled: atMax}}
          style={({pressed}) => [
            styles.stepButton,
            secondaryStyle,
            {borderRadius: theme.radius.md},
            pressed && !atMax && styles.pressed,
            atMax && styles.disabledButton,
          ]}
        >
          <Text
            style={[
              theme.typography.bodyStrong,
              {color: atMax ? theme.palette.text.muted : theme.palette.text.primary},
            ]}
          >
            +
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

// -- Styles -------------------------------------------------------------------

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  valueContainer: {
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.92,
  },
  disabledButton: {
    opacity: 0.4,
  },
})
