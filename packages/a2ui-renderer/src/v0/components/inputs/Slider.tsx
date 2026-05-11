/**
 * SliderRenderer — range input with step, value badge, and haptic feedback.
 *
 * Uses Reanimated 4 for the thumb drag animation and spring spring on release.
 * Haptics: light on grab, medium on each step crossing (via expo-haptics mock in tests).
 * Reduced motion: scale animation disabled; value badge appears/disappears instantly.
 *
 * Value badge: floats 8pt above thumb when showValue=true; follows thumb during drag.
 * Format: 'integer' (default), 'decimal' (1 decimal place), 'percent' ("%").
 *
 * Accessibility:
 *   - accessibilityRole="adjustable" on the thumb/track
 *   - accessibilityLabel: node.accessibilityLabel ?? node.label
 *   - accessibilityValue: {min, max, now, text: formattedValue}
 *   - VoiceOver swipe up/down: increment/decrement by step (T-0009-046)
 *
 * Visual:
 *   - Track: 4pt tall (expressive: 6pt), radius-full.
 *   - Filled left of thumb: accent. Unfilled right: divider.
 *   - Thumb: 24pt circle (expressive: 28pt), bg-elevated, 1pt divider border.
 *   - Min/max labels below track ends in type-micro, fg-faint.
 *
 * V1 Phase 1 Step 2 — ADR-0009
 * T-0009-044..047, T-0009-059 (snapshot), T-0009-046 (a11y)
 */
import React, {useRef, useState} from 'react'
import {View, Text, PanResponder, StyleSheet} from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated'
import type {Node} from '@app-creator/protocol'
import {useTheme, useStance} from '../../theme/RendererThemeProvider.js'
import {useBinding} from '../../state/useBinding.js'
import {useRendererStateContext} from '../../state/useRendererState.js'
import {useReducedMotion} from '../../a11y/useReducedMotion.js'

type SliderNode = Extract<Node, {type: 'Slider'}>

// ---------------------------------------------------------------------------
// § Value formatting
// ---------------------------------------------------------------------------

export function formatSliderValue(value: number, format: SliderNode['format']): string {
  const resolved = format ?? 'integer'
  if (resolved === 'percent') return `${Math.round(value)}%`
  if (resolved === 'decimal') return value.toFixed(1)
  return String(Math.round(value))
}

// ---------------------------------------------------------------------------
// § Haptics (guarded import)
// ---------------------------------------------------------------------------

let Haptics: {
  impactAsync: (style: 'Light' | 'Medium') => Promise<void>
} | null = null

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Haptics = require('expo-haptics')
} catch {
  // expo-haptics not available in test environment.
}

function hapticLight() {
  Haptics?.impactAsync('Light').catch(() => undefined)
}

function hapticMedium() {
  Haptics?.impactAsync('Medium').catch(() => undefined)
}

// ---------------------------------------------------------------------------
// § Track layout constants
// ---------------------------------------------------------------------------

const THUMB_SIZE_PRODUCTIVE = 24
const THUMB_SIZE_EXPRESSIVE = 28
const TRACK_HEIGHT_PRODUCTIVE = 4
const TRACK_HEIGHT_EXPRESSIVE = 6

// ---------------------------------------------------------------------------
// § Renderer
// ---------------------------------------------------------------------------

export function SliderRenderer({node}: {node: SliderNode}) {
  const theme = useTheme()
  const stance = useStance()
  const {dispatch} = useRendererStateContext()
  const reducedMotion = useReducedMotion()

  const thumbSize = stance === 'expressive' ? THUMB_SIZE_EXPRESSIVE : THUMB_SIZE_PRODUCTIVE
  const trackHeight = stance === 'expressive' ? TRACK_HEIGHT_EXPRESSIVE : TRACK_HEIGHT_PRODUCTIVE

  const min = node.min
  const max = node.max
  const step = node.step ?? 1
  const showValue = node.showValue !== false // default true
  const format = node.format

  const boundValue = useBinding<number>(node.valueBinding)
  const currentValue = boundValue ?? min

  // Track width measured on layout.
  const [trackWidth, setTrackWidth] = useState(300)
  // Current committed value.
  const [committed, setCommitted] = useState(currentValue)

  // Reanimated shared value for thumb position (0..1).
  const thumbPos = useSharedValue((currentValue - min) / Math.max(max - min, 1))

  // Last step the haptic fired on (to avoid firing multiple times at the same step).
  const lastStepRef = useRef(Math.round((currentValue - min) / step) * step + min)

  // Sync thumbPos when external binding changes.
  const prevBoundRef = useRef(currentValue)
  if (prevBoundRef.current !== currentValue) {
    prevBoundRef.current = currentValue
    thumbPos.value = (currentValue - min) / Math.max(max - min, 1)
    setCommitted(currentValue)
  }

  function snapToStep(raw: number): number {
    if (step <= 0) return raw
    const snapped = Math.round((raw - min) / step) * step + min
    return Math.max(min, Math.min(max, snapped))
  }

  function posToValue(pos01: number): number {
    const raw = min + pos01 * (max - min)
    return snapToStep(raw)
  }

  function dispatchValue(value: number) {
    setCommitted(value)
    if (node.valueBinding.kind === 'state') {
      dispatch({type: 'set', target: node.valueBinding.slot, value})
    }
  }

  // PanResponder for thumb drag.
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        hapticLight()
        lastStepRef.current = committed
      },
      onPanResponderMove: (_evt, gestureState) => {
        const dx = gestureState.dx
        const newPos = Math.max(0, Math.min(1, thumbPos.value + dx / trackWidth))
        thumbPos.value = newPos

        const newValue = posToValue(newPos)
        // Haptic on step crossing.
        if (newValue !== lastStepRef.current) {
          hapticMedium()
          lastStepRef.current = newValue
          runOnJS(setCommitted)(newValue)
        }
      },
      onPanResponderRelease: () => {
        const finalValue = posToValue(thumbPos.value)
        // Spring to snapped position.
        if (!reducedMotion) {
          thumbPos.value = withSpring((finalValue - min) / Math.max(max - min, 1), {
            damping: 20,
            stiffness: 200,
          })
        } else {
          thumbPos.value = (finalValue - min) / Math.max(max - min, 1)
        }
        runOnJS(dispatchValue)(finalValue)
      },
    }),
  ).current

  // Animated style for the thumb.
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      {translateX: thumbPos.value * trackWidth - thumbSize / 2},
    ],
  }))

  // Animated style for the filled track portion.
  const filledStyle = useAnimatedStyle(() => ({
    width: `${thumbPos.value * 100}%` as unknown as number,
  }))

  const formattedValue = formatSliderValue(committed, format)
  const a11yLabel = node.accessibilityLabel ?? node.label

  function handleVoiceOverIncrement() {
    const next = Math.min(max, committed + step)
    const pos = (next - min) / Math.max(max - min, 1)
    thumbPos.value = pos
    dispatchValue(next)
  }

  function handleVoiceOverDecrement() {
    const prev = Math.max(min, committed - step)
    const pos = (prev - min) / Math.max(max - min, 1)
    thumbPos.value = pos
    dispatchValue(prev)
  }

  const captionSpec = theme.type.caption
  const microSpec = theme.type.micro

  return (
    <View>
      {/* Label */}
      <Text
        style={{
          fontSize: captionSpec.size,
          lineHeight: captionSpec.lineHeight,
          fontWeight: '400',
          letterSpacing: captionSpec.letterSpacing,
          color: theme['fg-muted'],
          marginBottom: theme.spacing['space-xs'],
        }}
        accessibilityElementsHidden
      >
        {node.label}
      </Text>

      {/* Track + Thumb container */}
      <View
        style={{paddingVertical: 12}} // 44pt minimum hit target (invisible padding)
        accessibilityRole="adjustable"
        accessibilityLabel={a11yLabel}
        accessibilityValue={{
          min,
          max,
          now: committed,
          text: formattedValue,
        }}
        accessible
        onAccessibilityAction={event => {
          if (event.nativeEvent.actionName === 'increment') handleVoiceOverIncrement()
          if (event.nativeEvent.actionName === 'decrement') handleVoiceOverDecrement()
        }}
        testID={`slider-container-${node.id}`}
      >
        {/* Track */}
        <View
          style={{
            height: trackHeight,
            borderRadius: 999,
            backgroundColor: theme.divider,
            position: 'relative',
          }}
          onLayout={e => setTrackWidth(e.nativeEvent.layout.width)}
        >
          {/* Filled portion (left of thumb) */}
          <Animated.View
            style={[
              {
                height: trackHeight,
                borderRadius: 999,
                backgroundColor: theme.accent,
                position: 'absolute',
                left: 0,
                top: 0,
              },
              filledStyle,
            ]}
          />
        </View>

        {/* Thumb */}
        <Animated.View
          style={[
            {
              width: thumbSize,
              height: thumbSize,
              borderRadius: thumbSize / 2,
              backgroundColor: theme['bg-elevated'],
              borderWidth: 1,
              borderColor: theme.divider,
              position: 'absolute',
              top: 12 - thumbSize / 2 + trackHeight / 2,
              shadowColor: '#000',
              shadowOffset: {width: 0, height: 1},
              shadowOpacity: 0.15,
              shadowRadius: 2,
              elevation: 2,
            },
            thumbStyle,
          ]}
          {...panResponder.panHandlers}
          testID={`slider-thumb-${node.id}`}
        />

        {/* Value badge */}
        {showValue && (
          <Animated.View
            style={[
              {
                position: 'absolute',
                top: -28,
                backgroundColor: theme.accent,
                borderRadius: theme.radii['radius-sm'],
                paddingHorizontal: 6,
                paddingVertical: 2,
                minWidth: 28,
                alignItems: 'center',
              },
              thumbStyle,
            ]}
            testID={`slider-badge-${node.id}`}
          >
            <Text
              style={{
                fontSize: microSpec.size,
                fontWeight: '600',
                color: theme['accent-fg'],
              }}
            >
              {formattedValue}
            </Text>
          </Animated.View>
        )}
      </View>

      {/* Min/max labels */}
      <View style={styles.minMaxRow}>
        <Text style={{fontSize: microSpec.size, color: theme['fg-faint']}}>
          {formatSliderValue(min, format)}
        </Text>
        <Text style={{fontSize: microSpec.size, color: theme['fg-faint']}}>
          {formatSliderValue(max, format)}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  minMaxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
})
