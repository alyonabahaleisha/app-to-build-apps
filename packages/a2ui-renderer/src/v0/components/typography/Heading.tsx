/**
 * HeadingRenderer — display text at 3 levels.
 *
 * Level mapping per canvas-v0-ux.md §Type roles:
 *   level 1 → type-role 'display' (32/40/600 productive; 36/44/500 expressive)
 *   level 2 → type-role 'h1'      (24/30/600 productive; 28/36/500 expressive)
 *   level 3 → type-role 'h2'      (18/24/600 productive; 22/30/500 expressive)
 *
 * Default level is 2 per UX doc. Color default is 'fg'.
 *
 * Accessibility: accessibilityRole="header" + accessibilityLevel so iOS
 * VoiceOver announces the heading at the correct semantic level.
 *
 * T-0006-064 / T-0006-065: snapshots at productive×focus + expressive×health
 * T-0006-078: Heading levels 1/2/3 resolve to display/h1/h2 type roles
 * T-0006-084: empty text rejected at schema parse
 */
import React from 'react'
import {Text} from 'react-native'
import type {Node} from '@app-creator/protocol'
import {useTheme} from '../../theme/RendererThemeProvider.js'

type HeadingNode = Extract<Node, {type: 'Heading'}>

// Level → type-role name lookup.
const LEVEL_TO_TYPE_ROLE = {
  1: 'display',
  2: 'h1',
  3: 'h2',
} as const

// Color → theme token name lookup.
// Heading schema only has an implicit 'fg' default (no explicit color prop in
// the schema per display.ts review). We render text in theme.fg always.
// If the schema adds a color prop in a future step, this is the extension point.

export function HeadingRenderer({node}: {node: HeadingNode}) {
  const theme = useTheme()

  const level = node.level ?? 2
  const typeRole = LEVEL_TO_TYPE_ROLE[level]
  const typeSpec = theme.type[typeRole]

  const align = node.align ?? 'start'
  const textAlign = align === 'start' ? 'left' : align === 'end' ? 'right' : 'center'

  return (
    <Text
      style={{
        fontSize: typeSpec.size,
        lineHeight: typeSpec.lineHeight,
        fontWeight: String(typeSpec.weight) as '400' | '500' | '600',
        letterSpacing: typeSpec.letterSpacing,
        color: theme.fg,
        textAlign,
      }}
      accessibilityRole="header"
      // aria-level is the W3C/React Native aria prop for heading level.
      // accessibilityLevel is not in the RN TextProps type surface — use aria-level.
      aria-level={level}
      accessibilityLabel={node.accessibilityLabel ?? node.text}
    >
      {node.text}
    </Text>
  )
}
