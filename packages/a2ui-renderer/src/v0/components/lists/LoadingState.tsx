/**
 * LoadingStateRenderer — skeleton shimmer rows mimicking ListItem shape.
 *
 * Visual (per canvas-v0-ux.md §Lists tier §LoadingState):
 *   - `lines` skeleton rows (default 3, max 20)
 *   - Each row mimics a standard 56pt ListItem with a shimmer effect
 *   - Shimmer: 1.5s loop, divider-color block fading to bg-elevated (Reanimated)
 *   - Reduced motion: static gray blocks (useReducedMotion → no animation)
 *
 * Accessibility:
 *   - Container: accessibilityLabel="Loading"
 *   - Individual shimmer rows are aria-hidden (decorative loading animation)
 *
 * The shimmer uses Reanimated's withRepeat + withSequence so it runs on the UI
 * thread. When useReducedMotion() returns true, the animation is skipped and
 * blocks render as static gray.
 *
 * T-0006-115: snapshot at productive×focus
 * T-0006-116: snapshot at expressive×health
 * T-0006-123: LoadingState shows shimmer; reduced-motion shows static gray
 */
import React from 'react'
import {View} from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import type {Node} from '@app-creator/protocol'
import {useTheme} from '../../theme/RendererThemeProvider.js'
import {useReducedMotion} from '../../a11y/useReducedMotion.js'

type LoadingStateNode = Extract<Node, {type: 'LoadingState'}>

const DEFAULT_LINES = 3
const SHIMMER_DURATION_MS = 750  // each half-cycle: divider → bg-elevated → divider

function ShimmerBlock({
  width,
  height,
  style,
  reducedMotion,
  theme,
}: {
  width: string | number
  height: number
  style?: object
  reducedMotion: boolean
  theme: ReturnType<typeof useTheme>
}) {
  // Start opacity animation immediately.
  const opacity = useSharedValue(reducedMotion ? 1 : 0.4)

  // Animate shimmer only when reduced motion is off.
  // The animation is started unconditionally but stays at 0.4 (still value)
  // when reducedMotion is true — no visual change, no worklet scheduling.
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }))

  // Start shimmer loop on mount if not in reduced-motion mode.
  // We use useMemo-like approach: schedule once on first render via
  // Reanimated's shared value worklet. There is no useEffect here —
  // withRepeat runs on the UI thread without React lifecycle involvement.
  if (!reducedMotion) {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.8, {duration: SHIMMER_DURATION_MS}),
        withTiming(0.4, {duration: SHIMMER_DURATION_MS}),
      ),
      -1, // infinite
      false, // do not reverse (sequence handles direction)
    )
  }

  return (
    <Animated.View
      testID="shimmer-block"
      style={[
        {
          width,
          height,
          backgroundColor: theme.divider,
          borderRadius: theme.radii['radius-sm'],
        },
        style,
        animatedStyle,
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  )
}

export function LoadingStateRenderer({node}: {node: LoadingStateNode}) {
  const theme = useTheme()
  const reducedMotion = useReducedMotion()
  const lines = node.lines ?? DEFAULT_LINES

  return (
    <View
      accessibilityLabel={node.accessibilityLabel ?? 'Loading'}
    >
      {Array.from({length: lines}).map((_, i) => (
        <View
          key={i}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            minHeight: 56,
            paddingHorizontal: theme.spacing['space-md'],
            paddingVertical: theme.spacing['space-sm'],
          }}
        >
          {/* Leading avatar placeholder */}
          <ShimmerBlock
            width={36}
            height={36}
            style={{borderRadius: 18, marginRight: theme.spacing['space-sm']}}
            reducedMotion={reducedMotion}
            theme={theme}
          />

          {/* Content column */}
          <View style={{flex: 1, gap: theme.spacing['space-xs']}}>
            {/* Title line */}
            <ShimmerBlock
              width="60%"
              height={14}
              reducedMotion={reducedMotion}
              theme={theme}
            />
            {/* Subtitle line */}
            <ShimmerBlock
              width="40%"
              height={12}
              reducedMotion={reducedMotion}
              theme={theme}
            />
          </View>
        </View>
      ))}
    </View>
  )
}
