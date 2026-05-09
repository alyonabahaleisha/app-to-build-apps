/**
 * AvatarRenderer — circular initials fallback avatar.
 *
 * V0 has no imageUrl rendering — initials from `name` only (privacy / no
 * remote URLs). The schema has imageUrl optional but the renderer ignores
 * it in V0 per ADR Step 5 "NB: V0 has no image source".
 *
 * Initials: take up to first 2 characters from `name` after splitting on
 * whitespace. "Alex Johnson" → "AJ", "José" → "JO" won't split to 2 —
 * just first char: "J". Single-word names get 1-2 uppercase chars.
 *
 * Size → diameter:
 *   sm → 24pt, md → 32pt, lg → 48pt (per canvas-v0-ux.md §Avatar)
 *
 * Background: accent at 15% opacity tint. Text: accent color.
 * Shape: radius-full (circle).
 *
 * Accessibility: accessibilityRole="image" + meaningful accessibilityLabel.
 * e.g. "Avatar for Alex" from name field.
 *
 * T-0006-076 / T-0006-077: snapshots at productive×focus + expressive×health
 * T-0006-082: initials fallback when imageUrl absent
 * T-0006-083: size enum enforces correct dimensions
 */
import React from 'react'
import {View, Text} from 'react-native'
import type {Node} from '@app-creator/protocol'
import {useTheme} from '../../theme/RendererThemeProvider.js'

type AvatarNode = Extract<Node, {type: 'Avatar'}>

const SIZE_TO_DIAMETER = {
  sm: 24,
  md: 32,
  lg: 48,
} as const

// Derive initials from a name string: up to 2 uppercase chars from words.
// "Alex Johnson" → "AJ", "María" → "M", "O'Brien" → "OB" (hyphen split too).
function deriveInitials(name: string): string {
  const words = name.trim().split(/[\s'-]+/).filter(Boolean)
  const first = words[0]
  const second = words[1]
  if (words.length === 0 || first === undefined) return '?'
  if (words.length === 1 || second === undefined) {
    return first.slice(0, 2).toUpperCase()
  }
  const firstChar = first[0] ?? ''
  const secondChar = second[0] ?? ''
  return (firstChar + secondChar).toUpperCase()
}

export function AvatarRenderer({node}: {node: AvatarNode}) {
  const theme = useTheme()

  const size = node.size ?? 'md'
  const diameter = SIZE_TO_DIAMETER[size]
  const initials = deriveInitials(node.name)

  // Font size scales with diameter: roughly 40% of diameter.
  const fontSize = Math.round(diameter * 0.38)

  const a11yLabel = node.accessibilityLabel ?? `Avatar for ${node.name}`

  return (
    <View
      style={{
        width: diameter,
        height: diameter,
        borderRadius: theme.radii['radius-full'],
        backgroundColor: theme.accent + '26',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      accessibilityRole="image"
      accessibilityLabel={a11yLabel}
    >
      <Text
        style={{
          fontSize,
          fontWeight: '600',
          color: theme.accent,
          lineHeight: diameter,
          includeFontPadding: false,
          textAlignVertical: 'center',
        }}
        accessibilityElementsHidden
      >
        {initials}
      </Text>
    </View>
  )
}
