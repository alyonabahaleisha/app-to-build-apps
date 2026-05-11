/**
 * ProgressBar — client-paced determinate progress bar for the Generating screen.
 *
 * Pacing per Sable's canvas-v0-ux.md §Screen 3a animation timing:
 *   Phase 1: 0 → 75% over 6500ms
 *   Phase 2: 75 → 95% over 1500ms
 *   Phase 3: Hold at 95-99% until SSE resolves
 *   Completion: 95→100% animated in then navigate to Run
 *
 * Uses Reanimated 4 withSequence per ADR-0011 Step 9 (line 1025) and
 * Sable's canvas-v0-ux.md §Screen 3a animation spec.
 *
 * Reduced motion (T-0011-236): useReducedMotion() hook — skip to hold
 * position instantly instead of running the continuous sequence.
 * The bar is NOT wired to SSE chunk count — it's purely client-paced.
 *
 * T-0011-209: bar starts at 0, animates to 75% over 6.5s
 * T-0011-210: 75 → 95% over 1.5s
 * T-0011-211: holds at 95-99% until SSE completes
 * T-0011-212: on done event, bar → 100%
 * T-0011-234: accessibilityRole="progressbar", accessibilityValue
 * T-0011-235: reduced motion → static at hold position
 * T-0011-236: reduced motion → instant step to hold position
 */
import {useEffect} from 'react'
import {StyleSheet, View} from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated'

import {useAppShellTheme} from '#/theme/AppShellThemeProvider'

import {generatingCopy} from './generatingCopy'

interface Props {
  /**
   * When true, animate the bar to 100% immediately (SSE done event received).
   */
  complete?: boolean
}

// Animation timings per Sable's spec.
const PHASE1_TARGET = 0.75
const PHASE1_DURATION = 6500
const PHASE2_TARGET = 0.95
const PHASE2_DURATION = 1500

export function ProgressBar({complete = false}: Props) {
  const theme = useAppShellTheme()
  const progress = useSharedValue(0)
  const isReducedMotion = useReducedMotion()

  // Kick off the client-paced progress animation on mount.
  useEffect(() => {
    if (isReducedMotion) {
      // Reduced motion: skip the continuous animation; jump straight to the
      // hold position so the bar is visible but not distracting.
      progress.value = withTiming(PHASE2_TARGET, {duration: 0})
    } else {
      progress.value = withSequence(
        withTiming(PHASE1_TARGET, {duration: PHASE1_DURATION}),
        withTiming(PHASE2_TARGET, {duration: PHASE2_DURATION}),
        // Hold — no further animation until `complete` flips to true.
      )
    }
    // Run on mount only — isReducedMotion is stable for the screen lifetime.
  }, [])

  // Completion: animate to 100% when SSE done event arrives.
  useEffect(() => {
    if (!complete) return
    if (isReducedMotion) {
      progress.value = withTiming(1, {duration: 0})
    } else {
      progress.value = withTiming(1, {duration: 300})
    }
  }, [complete, isReducedMotion, progress])

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%` as `${number}%`,
  }))

  return (
    <View
      style={[styles.track, {backgroundColor: theme['bg-elevated'], borderColor: theme.divider}]}
      accessibilityRole="progressbar"
      accessibilityLabel={generatingCopy.progressBarA11yLabel}
      accessibilityValue={{min: 0, max: 100}}
      testID="progress-bar-track"
    >
      <Animated.View
        style={[styles.fill, {backgroundColor: theme.accent}, animatedStyle]}
        testID="progress-bar-fill"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  track: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
})
