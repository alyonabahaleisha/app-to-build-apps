/**
 * FirstRunCoachmark — speech-bubble coachmark anchored to the meatball.
 *
 * Per canvas-v0-ux.md §First-Time-User Coachmark + ADR-0011 Step 10 note 8:
 *   - Triggered on first Run-mode mount per user (across all tools)
 *   - Stored in expo-secure-store via coachmarkStorage
 *   - Appears 600ms after RunScreen mount
 *   - Auto-dismisses after 8s
 *   - Dismisses on: tap-outside, "Got it", meatball tap
 *   - Reduced motion: instant appear, no slide
 *
 * Position: absolute, below meatball, passed as layout coordinates.
 *
 * T-0011-261..T-0011-271.
 */
import {useCallback, useEffect, useRef, useState} from 'react'
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutRectangle,
} from 'react-native'

import {markCoachmarkSeen} from '#/lib/coachmarkStorage'
import {useAppShellTheme} from '#/theme/AppShellThemeProvider'
import {runCopy} from './copy'

const APPEAR_DELAY_MS = 600
const AUTO_DISMISS_MS = 8_000

interface FirstRunCoachmarkProps {
  /** Layout of the meatball button — used to anchor the bubble. */
  meatballLayout: LayoutRectangle | null
  /** Called when the coachmark is dismissed for any reason. */
  onDismiss: () => void
  /** Whether to show (driven by parent after checking SecureStore). */
  visible: boolean
}

export function FirstRunCoachmark({meatballLayout, onDismiss, visible}: FirstRunCoachmarkProps) {
  const theme = useAppShellTheme()
  const [shown, setShown] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Check reduced motion once.
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion)
  }, [])

  // Appear after 600ms delay (or instantly in reduced motion).
  useEffect(() => {
    if (!visible) {
      setShown(false)
      return
    }

    const delay = reducedMotion ? 0 : APPEAR_DELAY_MS
    timerRef.current = setTimeout(() => {
      setShown(true)
    }, delay)

    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
    }
  }, [visible, reducedMotion])

  // Auto-dismiss after 8s.
  useEffect(() => {
    if (!shown) return

    autoDismissRef.current = setTimeout(() => {
      handleDismiss()
    }, AUTO_DISMISS_MS)

    return () => {
      if (autoDismissRef.current !== null) clearTimeout(autoDismissRef.current)
    }
  }, [shown])

  const handleDismiss = useCallback(() => {
    setShown(false)
    if (autoDismissRef.current !== null) clearTimeout(autoDismissRef.current)
    void markCoachmarkSeen()
    onDismiss()
  }, [onDismiss])

  if (!shown) return null

  // Position below the meatball (fall back to a sensible default if layout
  // hasn't fired yet — happens in tests where layout events don't run).
  const top = meatballLayout ? meatballLayout.y + meatballLayout.height + 8 : 52
  const right = 8

  return (
    <>
      {/* Tap-outside dismissal layer */}
      <Pressable
        style={StyleSheet.absoluteFillObject}
        onPress={handleDismiss}
        accessibilityElementsHidden
        testID="coachmark-backdrop"
      />

      {/* Speech bubble */}
      <View
        style={[
          styles.bubble,
          {
            top,
            right,
            backgroundColor: theme['bg-elevated'],
            shadowColor: theme.fg,
          },
        ]}
        accessibilityViewIsModal
        accessibilityLabel={runCopy.coachmarkA11y}
        accessibilityLiveRegion="polite"
        testID="run-coachmark"
      >
        {/* Tail pointing up at meatball */}
        <View style={[styles.tail, {borderBottomColor: theme['bg-elevated']}]} />

        <Text
          style={[
            styles.body,
            {
              fontSize: theme.type.body.size,
              fontWeight: String(theme.type.body.weight) as '400',
              lineHeight: theme.type.body.lineHeight,
              color: theme.fg,
            },
          ]}
        >
          {runCopy.coachmarkBody}
        </Text>

        <Pressable
          onPress={handleDismiss}
          accessibilityRole="button"
          accessibilityLabel={runCopy.coachmarkGotIt}
          hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}
          testID="coachmark-got-it"
        >
          <Text
            style={{
              fontSize: theme.type.body.size,
              color: theme.accent,
              fontWeight: '600',
              marginTop: 8,
            }}
          >
            {runCopy.coachmarkGotIt}
          </Text>
        </Pressable>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    width: 240,
    borderRadius: 12,
    padding: 16,
    // elevation-floating per Sable
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    zIndex: 100,
  },
  tail: {
    position: 'absolute',
    top: -8,
    right: 20,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  body: {},
})
