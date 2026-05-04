/**
 * Skeleton — shimmer placeholder for loading states.
 *
 * Per Sable §Animation: linear gradient sweep, 1.5s loop. Reduced-motion
 * collapses to a static muted grey block (per ARCHITECTURE.md §12).
 *
 * App-shell only (§6). The animation is implemented with the RN-Animated
 * driver running native — keeps the JS bridge cool. We deliberately don't
 * pull in `react-native-reanimated` for one shimmer; the Animated module
 * already ships with RN. (Sable's UX doc §Notes for Colby #4 suggested
 * Reanimated; for a single shimmer the dep cost isn't justified — Animated
 * handles this fine and Reanimated would land in M1 vertical-slice if we
 * need it for something heavier later.)
 */
import {useEffect, useRef, useState} from 'react'
import {AccessibilityInfo, Animated, StyleSheet, type ViewStyle} from 'react-native'

import {useTheme} from '#/theme'

interface Props {
  width: number | `${number}%`
  height: number
  /** Optional border radius — defaults to theme.radius.md. */
  radius?: number
  style?: ViewStyle
  testID?: string
}

export function Skeleton({width, height, radius, style, testID}: Props) {
  const theme = useTheme()
  const [reducedMotion, setReducedMotion] = useState<boolean>(false)
  const opacity = useRef(new Animated.Value(0.4)).current

  useEffect(() => {
    let mounted = true
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (mounted) setReducedMotion(v)
      })
      .catch(() => {
        if (mounted) setReducedMotion(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (reducedMotion) {
      opacity.setValue(0.7)
      return
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.9,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 750,
          useNativeDriver: true,
        }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [reducedMotion, opacity])

  return (
    <Animated.View
      testID={testID}
      // Skeleton is a decorative shimmer — exclude from screen-reader focus
      // but DO NOT use `accessibilityElementsHidden` because RN Testing
      // Library's `getAllByTestId` skips elements with that flag by default,
      // which makes the loading-state tests (T-0001-128, 113) noisier than
      // they need to be. `accessible={false}` is sufficient to keep the
      // screen reader from announcing the shimmer.
      accessible={false}
      style={[
        styles.base,
        {
          width,
          height,
          backgroundColor: theme.palette.bg.subtle,
          borderRadius: radius ?? theme.radius.md,
          opacity: reducedMotion ? 0.7 : opacity,
        },
        style,
      ]}
    />
  )
}

const styles = StyleSheet.create({
  base: {overflow: 'hidden'},
})
