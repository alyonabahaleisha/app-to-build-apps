/**
 * RatingInputRenderer — star or scale rating.
 *
 * Glyphs: 'star' (default), 'heart', 'flame', 'circle'.
 * Each glyph maps to a Unicode character for filled/unfilled rendering.
 * scale: 5 (default) or 10 glyphs. allowHalf: supports 0.5-step values.
 *
 * Tap on glyph N sets value to N. Tap on already-selected glyph clears (→ 0).
 * allowHalf: left half = N-0.5 step, right half = N step.
 *
 * Accessibility:
 *   - Wrapper: accessibilityRole="adjustable"
 *   - accessibilityValue: {min: 0, max: scale, now: value, text: "N of scale"}
 *   - VoiceOver swipe up/down: increment/decrement by 1 (or 0.5 if allowHalf)
 *
 * Visual:
 *   - Row of scale glyphs (24pt productive / 28pt expressive), space-sm gap.
 *   - Filled (≤ value): accent. Unfilled (> value): divider.
 *   - Tap animation: scale 1.0 → 1.15 (unless reducedMotion).
 *
 * V1 Phase 1 Step 2 — ADR-0009
 * T-0009-048..050, T-0009-059 (snapshot), T-0009-063, T-0009-064
 */
import React, {useState} from 'react'
import {View, Text, Pressable} from 'react-native'
import type {Node} from '@app-creator/protocol'
import {useTheme, useStance} from '../../theme/RendererThemeProvider.js'
import {useBinding} from '../../state/useBinding.js'
import {useRendererStateContext} from '../../state/useRendererState.js'
import {useReducedMotion} from '../../a11y/useReducedMotion.js'

type RatingInputNode = Extract<Node, {type: 'RatingInput'}>
type Glyph = NonNullable<RatingInputNode['glyph']>

// ---------------------------------------------------------------------------
// § Glyph maps (Unicode fallbacks — no custom icons needed in tests)
// ---------------------------------------------------------------------------

const FILLED_GLYPH: Record<Glyph, string> = {
  star: '★',
  heart: '♥',
  flame: '🔥',
  circle: '●',
}

const EMPTY_GLYPH: Record<Glyph, string> = {
  star: '☆',
  heart: '♡',
  flame: '○',
  circle: '○',
}

const GLYPH_SIZE_PRODUCTIVE = 24
const GLYPH_SIZE_EXPRESSIVE = 28

// ---------------------------------------------------------------------------
// § Renderer
// ---------------------------------------------------------------------------

export function RatingInputRenderer({node}: {node: RatingInputNode}) {
  const theme = useTheme()
  const stance = useStance()
  const {dispatch} = useRendererStateContext()
  const reducedMotion = useReducedMotion()

  const scale = node.scale ?? 5
  const glyph: Glyph = node.glyph ?? 'star'
  const allowHalf = node.allowHalf ?? false
  const glyphSize = stance === 'expressive' ? GLYPH_SIZE_EXPRESSIVE : GLYPH_SIZE_PRODUCTIVE

  const boundValue = useBinding<number>(node.valueBinding)
  const currentValue = boundValue ?? 0

  // Pressed glyph index for scale animation.
  const [pressedIndex, setPressedIndex] = useState<number | null>(null)

  function handleTap(n: number, half: boolean) {
    if (node.valueBinding.kind !== 'state') return

    let next: number
    if (allowHalf && half) {
      next = currentValue === n - 0.5 ? 0 : n - 0.5
    } else {
      next = currentValue === n ? 0 : n
    }

    dispatch({type: 'set', target: node.valueBinding.slot, value: next})
  }

  function handleVoiceOverIncrement() {
    if (node.valueBinding.kind !== 'state') return
    const step = allowHalf ? 0.5 : 1
    const next = Math.min(scale, currentValue + step)
    dispatch({type: 'set', target: node.valueBinding.slot, value: next})
  }

  function handleVoiceOverDecrement() {
    if (node.valueBinding.kind !== 'state') return
    const step = allowHalf ? 0.5 : 1
    const next = Math.max(0, currentValue - step)
    dispatch({type: 'set', target: node.valueBinding.slot, value: next})
  }

  const captionSpec = theme.type.caption
  const a11yLabel = node.accessibilityLabel ?? node.label

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

      {/* Glyph row — wrapper is the adjustable unit */}
      <View
        style={{flexDirection: 'row', gap: theme.spacing['space-xs']}}
        accessibilityRole="adjustable"
        accessibilityLabel={a11yLabel}
        accessibilityValue={{
          min: 0,
          max: scale,
          now: currentValue,
          text: `${currentValue} of ${scale}`,
        }}
        accessible
        onAccessibilityAction={event => {
          if (event.nativeEvent.actionName === 'increment') handleVoiceOverIncrement()
          if (event.nativeEvent.actionName === 'decrement') handleVoiceOverDecrement()
        }}
        testID={`ratinginput-container-${node.id}`}
      >
        {Array.from({length: scale}, (_, i) => {
          const n = i + 1
          const isFilled = currentValue >= n
          const isHalfFilled = allowHalf && currentValue >= n - 0.5 && currentValue < n
          const isPressed = pressedIndex === i && !reducedMotion

          return (
            <Pressable
              key={n}
              onPressIn={() => setPressedIndex(i)}
              onPressOut={() => setPressedIndex(null)}
              onPress={() => handleTap(n, false)}
              style={{
                width: glyphSize + 20, // 44pt minimum hit target
                height: glyphSize + 20,
                alignItems: 'center',
                justifyContent: 'center',
                transform: isPressed ? [{scale: 1.15}] : [{scale: 1.0}],
              }}
              accessibilityRole="button"
              accessibilityLabel={`${n} ${glyph}`}
              accessibilityState={{selected: currentValue === n}}
              testID={`ratinginput-glyph-${n}-${node.id}`}
            >
              <Text
                style={{
                  fontSize: glyphSize,
                  color: isFilled || isHalfFilled ? theme.accent : theme.divider,
                }}
              >
                {isFilled ? FILLED_GLYPH[glyph] : isHalfFilled ? FILLED_GLYPH[glyph] : EMPTY_GLYPH[glyph]}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}
