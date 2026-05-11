/**
 * LoadingBubble — animated assistant bubble shown during SSE generation.
 *
 * Receives `phase: 'thinking' | 'building' | 'stalled'` from the
 * useGenerateMutation hook and renders the corresponding copy with a
 * crossfade transition. Three animated dots as a pulse indicator.
 *
 * Accessibility (Sable UX §"Screen 3 — A. Two-stage loading"):
 *   - accessibilityLiveRegion="polite" on the text so VoiceOver announces
 *     phase changes once.
 *   - Does NOT announce the stall transition (would chatter).
 *   - Reduced motion: crossfade only (dots become static).
 */
import {useEffect, useRef, useState} from 'react'
import {AccessibilityInfo, Animated, StyleSheet, Text, View} from 'react-native'

import {useAppShellTheme} from '#/theme/AppShellThemeProvider'
import {chatCopy} from '#/screens/Chat/copy'
// Re-export so callers don't need two imports.
export {isActivePhase} from '#/state/queries/generate'

type ActivePhase = 'thinking' | 'building' | 'stalled'

interface Props {
  phase: ActivePhase
}

function copyForPhase(phase: ActivePhase): string {
  if (phase === 'thinking') return chatCopy.loadingThinking
  if (phase === 'building') return chatCopy.loadingBuilding
  return chatCopy.loadingStalled
}

function announcementForPhase(phase: ActivePhase): string | null {
  if (phase === 'thinking') return chatCopy.announceThinking
  if (phase === 'building') return chatCopy.announceBuilding
  // Stall: per Sable, do NOT announce — would chatter.
  return null
}

const CROSSFADE_MS = 200
const DOT_DELAY_MS = 200
const DOT_ANIM_MS = 400

export function LoadingBubble({phase}: Props) {
  const theme = useAppShellTheme()
  const [reduced, setReduced] = useState(false)
  const opacity = useRef(new Animated.Value(1)).current
  const prevPhaseRef = useRef<ActivePhase>(phase)

  // Detect reduced-motion once on mount.
  useEffect(() => {
    let active = true
    AccessibilityInfo.isReduceMotionEnabled()
      .then(flag => {
        if (active) setReduced(flag)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  // Crossfade when phase changes.
  useEffect(() => {
    if (prevPhaseRef.current === phase) return
    prevPhaseRef.current = phase

    // Crossfade: fade out → update text (via phase prop) → fade in.
    Animated.sequence([
      Animated.timing(opacity, {
        toValue: 0,
        duration: CROSSFADE_MS / 2,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: CROSSFADE_MS / 2,
        useNativeDriver: true,
      }),
    ]).start()
  }, [phase, opacity])

  return (
    <View
      style={[
        styles.bubble,
        {backgroundColor: theme['bg-elevated'], borderRadius: theme.radii['radius-md']},
      ]}
    >
      <Animated.View style={{opacity, flexDirection: 'row', alignItems: 'center', gap: 8}}>
        <Text
          style={[
            {
              fontSize: theme.type.body.size,
              fontWeight: String(theme.type.body.weight) as '400',
              lineHeight: theme.type.body.lineHeight,
              color: theme.fg,
            },
          ]}
          accessibilityLiveRegion={
            // Announce thinking + building; not stall.
            announcementForPhase(phase) !== null ? 'polite' : 'none'
          }
          testID="loading-bubble-text"
        >
          {copyForPhase(phase)}
        </Text>
        <PulseDots reduced={reduced} />
      </Animated.View>
    </View>
  )
}

function PulseDots({reduced}: {reduced: boolean}) {
  const theme = useAppShellTheme()
  const dot1 = useRef(new Animated.Value(0.3)).current
  const dot2 = useRef(new Animated.Value(0.3)).current
  const dot3 = useRef(new Animated.Value(0.3)).current
  const animRef = useRef<Animated.CompositeAnimation | null>(null)

  useEffect(() => {
    if (reduced) {
      // Reduced motion: static dots at mid-opacity.
      dot1.setValue(0.5)
      dot2.setValue(0.5)
      dot3.setValue(0.5)
      return
    }

    function makeDot(anim: Animated.Value, delay: number) {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: DOT_ANIM_MS,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.3,
            duration: DOT_ANIM_MS,
            useNativeDriver: true,
          }),
        ]),
      )
    }

    const anim = Animated.parallel([
      makeDot(dot1, 0),
      makeDot(dot2, DOT_DELAY_MS),
      makeDot(dot3, DOT_DELAY_MS * 2),
    ])
    animRef.current = anim
    anim.start()

    return () => {
      anim.stop()
    }
  }, [reduced, dot1, dot2, dot3])

  const dotStyle = {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme['fg-muted'],
    marginHorizontal: 1,
  } as const

  return (
    <View style={{flexDirection: 'row', alignItems: 'center'}} testID="loading-dots">
      <Animated.View style={[dotStyle, {opacity: dot1}]} />
      <Animated.View style={[dotStyle, {opacity: dot2}]} />
      <Animated.View style={[dotStyle, {opacity: dot3}]} />
    </View>
  )
}

// Exported helper so test can derive phase display copy without importing
// the component itself.
export {copyForPhase}

// Re-export the active phase type for consumers.
export type {ActivePhase as LoadingBubblePhase}

const styles = StyleSheet.create({
  bubble: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '80%',
  },
})
