/**
 * Skeleton — shimmer placeholder for loading states.
 *
 * Per Sable §Animation: linear gradient sweep, 1.5s loop. Reduced-motion
 * collapses to a static muted grey block (per ARCHITECTURE.md §12).
 *
 * App-shell only (§6). The animation is implemented with the RN-Animated
 * driver running native — keeps the JS bridge cool.
 *
 * ADR-0011 Step 5: migrated from M1 useTheme() → useAppShellTheme().
 */
import {useEffect, useRef, useState} from 'react'
import {AccessibilityInfo, Animated, StyleSheet, type ViewStyle} from 'react-native'

import {useAppShellTheme} from '#/theme/AppShellThemeProvider'

interface Props {
  width: number | `${number}%`
  height: number
  /** Optional border radius — defaults to theme.radii['radius-md']. */
  radius?: number
  style?: ViewStyle
  testID?: string
}

export function Skeleton({width, height, radius, style, testID}: Props) {
  const theme = useAppShellTheme()
  const [reducedMotion, setReducedMotion] = useState<boolean>(false)
  const opacity = useRef(new Animated.Value(0.4)).current

  useEffect(() => {
    let mounted = true
    void AccessibilityInfo.isReduceMotionEnabled()
      .then(v => {
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
      // Skeleton is decorative — exclude from screen-reader focus.
      accessible={false}
      style={[
        styles.base,
        {
          width,
          height,
          backgroundColor: theme['fg-faint'],
          borderRadius: radius ?? theme.radii['radius-md'],
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
