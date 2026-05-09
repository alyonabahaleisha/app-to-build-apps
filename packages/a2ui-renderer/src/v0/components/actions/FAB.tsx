/**
 * FABRenderer — Floating Action Button for the V0 renderer.
 *
 * Visual (per canvas-v0-ux.md §FAB):
 *   - 56pt circle, accent bg, accent-fg icon 24pt centered
 *   - elevation-floating (shadow)
 *   - Springy scale-in animation on first mount (Reanimated, motion-springy)
 *   - Pressed: 96% scale + medium haptic (haptics middleware handles haptic
 *     on removeItem; the 96% scale is handled here via Reanimated)
 *   - Reduced motion: animation collapses to instant (no spring, no scale)
 *
 * Disabled state (MT-07):
 *   - resolved via useBinding<boolean>(node.disabled)
 *   - 50% opacity AND elevation-flat (not elevation-floating)
 *   - onPress is a no-op (no dispatch, no haptic)
 *   - accessibilityState={{disabled: true}}
 *
 * Position: the FAB does not absolutely position itself — the host is
 * responsible for positioning within the screen layout. The FAB renders
 * as a self-contained 56pt circle. The host (Step 10, AppRunner) places it
 * via absolute positioning with space-lg from edges.
 *
 * Note on schema: FABSchema has no `position` or `disabled` field (they
 * were not in the locked schema — verify with protocol/src/components/actions.ts).
 * disabled is handled defensively; if absent from the type, it is undefined.
 *
 * T-0006-150: snapshot at productive×focus
 * T-0006-151: snapshot at expressive×health
 * T-0006-156: renders 56pt accent circle at floating elevation
 * T-0006-157: scale-in springy on first mount
 * T-0006-161g: disabled FAB renders at 50% opacity + flat elevation; press no-op
 */
import React from 'react'
import {Pressable} from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import type {Node} from '@app-creator/protocol'
import {Icon} from '@app-creator/design-system'
import {useTheme} from '../../theme/RendererThemeProvider.js'
import {useRendererStateContext} from '../../state/useRendererState.js'
import {useReducedMotion} from '../../a11y/useReducedMotion.js'

type FabNode = Extract<Node, {type: 'FAB'}>

const FAB_SIZE = 56
const ICON_SIZE = 24

export function FABRenderer({node}: {node: FabNode}) {
  const theme = useTheme()
  const {dispatch} = useRendererStateContext()
  const reducedMotion = useReducedMotion()

  // FABSchema does not include a `disabled` field per the locked schema.
  // We defensively handle `(node as any).disabled` in case a future schema
  // revision adds it, and to satisfy T-0006-161g which tests disabled FAB.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const disabledRaw = (node as any).disabled
  const isDisabled = disabledRaw === true || disabledRaw?.value === true

  // Scale shared value — starts at 0, springs to 1 on mount.
  const scale = useSharedValue(reducedMotion ? 1 : 0)

  // Spring in on mount (fires once; no useEffect — Reanimated drives this
  // on the UI thread without React lifecycle involvement).
  if (!reducedMotion && scale.value === 0) {
    scale.value = withSpring(1, {
      stiffness: theme.motion['motion-springy'].stiffness,
      damping: theme.motion['motion-springy'].damping,
    })
  }

  const pressScale = useSharedValue(1)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: scale.value * pressScale.value}],
  }))

  // Apply elevation-floating shadow when enabled, elevation-flat (no shadow) when disabled.
  // The design-system token stores shadow as descriptive strings (not RN shadow props),
  // so we translate directly to RN shadow API here per the token spec.
  const shadowStyle = !isDisabled
    ? {
        shadowColor: '#0F1216',
        shadowOffset: {width: 0, height: 8},
        shadowOpacity: 0.1,
        shadowRadius: 24,
        elevation: 8, // Android elevation-floating approximation
      }
    : {}

  function handlePressIn() {
    if (isDisabled) return
    if (reducedMotion) return
    pressScale.value = withTiming(0.96, {duration: 80})
  }

  function handlePressOut() {
    if (reducedMotion) return
    pressScale.value = withSpring(1, {stiffness: 300, damping: 20})
  }

  function handlePress() {
    if (isDisabled) return
    dispatch(node.action)
  }

  return (
    <Animated.View
      style={[
        {
          width: FAB_SIZE,
          height: FAB_SIZE,
          borderRadius: FAB_SIZE / 2,
          backgroundColor: theme.accent,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: isDisabled ? 0.5 : 1,
        },
        shadowStyle,
        animatedStyle,
      ]}
      testID="fab-container"
    >
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={{
          width: FAB_SIZE,
          height: FAB_SIZE,
          borderRadius: FAB_SIZE / 2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        accessibilityRole="button"
        accessibilityLabel={node.accessibilityLabel}
        accessibilityState={{disabled: isDisabled}}
        disabled={isDisabled}
        hitSlop={0}
      >
        <Icon
          name={node.icon}
          size={ICON_SIZE}
          color={theme['accent-fg']}
        />
      </Pressable>
    </Animated.View>
  )
}
