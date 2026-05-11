/**
 * Toast — single toast at a time, dismissible by tap. Slide-down + fade
 * (collapses to opacity-only when reduced-motion is on, per ARCHITECTURE.md
 * §12 + UX doc §Animation).
 *
 * Owned by `ToastProvider`; not used directly by screens.
 *
 * ADR-0011 Step 5: migrated from M1 useTheme() → useAppShellTheme().
 */
import {useEffect, useRef, useState} from 'react'
import {AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {useAppShellTheme} from '#/theme/AppShellThemeProvider'

export type ToastVariant = 'default' | 'error'

interface Props {
  message: string
  variant: ToastVariant
  onDismiss: () => void
}

const SLIDE_DISTANCE = 16
const ANIMATION_MS = 250

export function Toast({message, variant, onDismiss}: Props) {
  const theme = useAppShellTheme()
  const insets = useSafeAreaInsets()
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    let mounted = true
    AccessibilityInfo.isReduceMotionEnabled()
      .then(flag => {
        if (mounted) setReduced(flag)
      })
      .catch(() => {
        // Defensive — if the platform refuses, assume motion-okay.
      })
    return () => {
      mounted = false
    }
  }, [])

  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(reduced ? 0 : -SLIDE_DISTANCE)).current

  useEffect(() => {
    const anims = reduced
      ? [
          Animated.timing(opacity, {
            toValue: 1,
            duration: ANIMATION_MS,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ]
      : [
          Animated.parallel([
            Animated.timing(opacity, {
              toValue: 1,
              duration: ANIMATION_MS,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(translateY, {
              toValue: 0,
              duration: ANIMATION_MS,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
        ]
    Animated.parallel(anims).start()
  }, [opacity, translateY, reduced])

  const bg = variant === 'error' ? theme.danger : theme['bg-elevated']
  const fg = variant === 'error' ? theme['accent-fg'] : theme.fg
  const borderColor = variant === 'error' ? theme.danger : theme.divider

  return (
    <Animated.View pointerEvents="box-none" style={[styles.host, {paddingTop: insets.top + 8}]}>
      <Animated.View style={{opacity, transform: [{translateY}]}}>
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={`Dismiss notification: ${message}`}
          accessibilityLiveRegion="polite"
          style={[
            styles.toast,
            {
              backgroundColor: bg,
              borderColor,
              borderRadius: theme.radii['radius-md'],
            },
          ]}
          testID="toast"
        >
          <Text
            style={[
              styles.text,
              {
                fontSize: theme.type.body.size,
                fontWeight: String(theme.type.body.weight) as '400',
                lineHeight: theme.type.body.lineHeight,
                color: fg,
              },
            ]}
          >
            {message}
          </Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 0,
    alignItems: 'stretch',
  },
  toast: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: {textAlign: 'left'},
})
