/**
 * CaptionRenderer — small supporting text resolving to type-caption (13/14pt).
 *
 * Same color and weight options as Body. Default color: 'fg-muted'
 * (secondary text tone per UX doc — Captions are secondary by default).
 * Default weight: 'regular'. Default align: 'start'.
 *
 * Accessibility: accessibilityRole="text" (explicit per Roz note 3).
 *
 * T-0006-068 / T-0006-069: snapshots at productive×focus + expressive×health
 */
import React from 'react'
import {Text} from 'react-native'
import type {Node} from '@app-creator/protocol'
import {useTheme} from '../../theme/RendererThemeProvider.js'

type CaptionNode = Extract<Node, {type: 'Caption'}>

function resolveColor(
  color: CaptionNode['color'],
  theme: ReturnType<typeof useTheme>,
): string {
  switch (color) {
    case 'fg':
      return theme.fg
    case 'fg-faint':
      return theme['fg-faint']
    case 'success':
      return theme.success
    case 'warning':
      return theme.warning
    case 'danger':
      return theme.danger
    case 'accent':
      return theme.accent
    case 'fg-muted':
    default:
      // Default: fg-muted (secondary tone)
      return theme['fg-muted']
  }
}

export function CaptionRenderer({node}: {node: CaptionNode}) {
  const theme = useTheme()

  const typeSpec = theme.type.caption
  const color = resolveColor(node.color, theme)

  const fontWeight = node.weight === 'strong'
    ? ('600' as const)
    : ('400' as const)

  const align = node.align ?? 'start'
  const textAlign = align === 'start' ? 'left' : align === 'end' ? 'right' : 'center'

  return (
    <Text
      style={{
        fontSize: typeSpec.size,
        lineHeight: typeSpec.lineHeight,
        fontWeight,
        letterSpacing: typeSpec.letterSpacing,
        color,
        textAlign,
      }}
      accessibilityRole="text"
      accessibilityLabel={node.accessibilityLabel}
    >
      {node.text}
    </Text>
  )
}
