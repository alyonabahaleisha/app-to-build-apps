/**
 * ButtonRenderer — interactive primitive for the A2UI catalog.
 *
 * Pure function of {node, state, dispatch}. All interaction flows through
 * a single dispatch(node.action) call (§D of ADR-0003).
 *
 * Styling per Sable §A2UI Catalog Visual Treatment (line 401):
 *   primary     → bg.primary   + primaryFg
 *   secondary   → bg.subtle    + text.primary + border.subtle
 *   destructive → bg.destructive + destructiveFg
 *   padding: 12pt vertical / 20pt horizontal, radius: md
 *
 * Pressed state: opacity 0.92 — close enough to Sable's "8% darken via
 * overlay" without requiring an actual overlay component.
 *
 * Haptics: impactAsync(Light) from expo-haptics, wrapped in try/catch.
 * Simulators without haptic hardware throw; we must never let that propagate
 * to the user's interaction (Sable Notes-for-Colby #7, T-0003-065).
 * We do NOT await the haptic — the user's tap must not block on it.
 *
 * Button.action is required by the A2UI schema, so there is no "missing
 * action" code path — the schema enforces it at validation time.
 *
 * Accessibility (Sable Notes-for-Colby #9):
 *   accessibilityRole="button"
 *   accessibilityLabel = node.label (exact passthrough, no synthesis)
 */
import * as Haptics from 'expo-haptics'
import React from 'react'
import {Pressable, StyleSheet, Text} from 'react-native'

import {useRendererTheme} from '../theme/RendererThemeProvider'
import type {Dispatch, RendererTheme, RenderState} from '../types'

// -- Node type (mirrored from schema) -----------------------------------------

import type {A2UIAction} from '@app-creator/a2ui-schema'

export type A2UIButtonVariant = 'primary' | 'secondary' | 'destructive'

export type A2UIButtonNode = {
  id?: string
  type: 'Button'
  label: string
  action: A2UIAction
  variant?: A2UIButtonVariant
}

export interface NodeProps<T> {
  node: T
  state: RenderState
  dispatch: Dispatch
}

// -- Variant style builders ---------------------------------------------------

type VariantStyle = {
  backgroundColor: string
  color: string
  borderWidth?: number
  borderColor?: string
}

function buildVariantStyle(
  variant: A2UIButtonVariant,
  theme: RendererTheme,
): VariantStyle {
  switch (variant) {
    case 'secondary':
      return {
        backgroundColor: theme.palette.bg.subtle,
        color: theme.palette.text.primary,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.palette.border.subtle,
      }
    case 'destructive':
      return {
        backgroundColor: theme.palette.destructive,
        color: theme.palette.destructiveFg,
      }
    case 'primary':
    default:
      return {
        backgroundColor: theme.palette.primary,
        color: theme.palette.primaryFg,
      }
  }
}

// -- Component ----------------------------------------------------------------

export function ButtonRenderer({
  node,
  dispatch,
}: NodeProps<A2UIButtonNode>): React.ReactElement {
  const theme = useRendererTheme()

  // Defend against runtime-injected unknown variant (T-0003-068b):
  // variantStyles[unknownKey] would return undefined, crashing on .color.
  // Normalise to 'primary' before looking up — no throw, no invalid access.
  const safeVariant: A2UIButtonVariant =
    node.variant === 'primary' ||
    node.variant === 'secondary' ||
    node.variant === 'destructive'
      ? node.variant
      : 'primary'

  const variantStyle = buildVariantStyle(safeVariant, theme)

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={node.label}
      onPress={() => {
        // Fire haptic but do NOT await — tap must not block on haptic hardware.
        // Wrapped in try/catch: Haptics throws on simulators without haptic
        // hardware (Notes-for-Colby #7, T-0003-065).
        try {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        } catch {
          // Intentional no-op. Haptic failure must not prevent dispatch.
        }
        dispatch(node.action)
      }}
      style={({pressed}) => [
        styles.base,
        {
          backgroundColor: variantStyle.backgroundColor,
          borderRadius: theme.radius.md,
          borderWidth: variantStyle.borderWidth ?? 0,
          borderColor: variantStyle.borderColor ?? 'transparent',
        },
        pressed && styles.pressed,
      ]}>
      <Text style={[theme.typography.bodyStrong, {color: variantStyle.color}]}>
        {node.label}
      </Text>
    </Pressable>
  )
}

// -- Styles -------------------------------------------------------------------

const styles = StyleSheet.create({
  base: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.92,
  },
})
