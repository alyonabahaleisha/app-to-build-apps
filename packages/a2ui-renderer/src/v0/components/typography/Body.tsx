/**
 * BodyRenderer — paragraph text resolving to type-body (16pt).
 *
 * Weight variants: 'regular' (400) | 'strong' (600).
 * Color variants resolve from theme tokens:
 *   'fg', 'fg-muted', 'fg-faint', 'success', 'warning', 'danger', 'accent'
 * Default color: 'fg'. Default weight: 'regular'.
 *
 * Text alignment: 'start' | 'center' | 'end', default 'start'.
 *
 * Accessibility: accessibilityRole="text" (explicit, as per Roz note 3 —
 * makes the role unambiguous even though RN defaults Text to 'text' semantics).
 *
 * T-0006-066 / T-0006-067: snapshots at productive×focus + expressive×health
 */
import React from 'react'
import {Text} from 'react-native'
import type {Node} from '@app-creator/protocol'
import {useTheme} from '../../theme/RendererThemeProvider.js'

type BodyNode = Extract<Node, {type: 'Body'}>

// Map the 7 allowed color values to ResolvedTheme keys.
// 'fg-muted' and 'fg-faint' use bracket notation since they contain hyphens.
function resolveColor(
  color: BodyNode['color'],
  theme: ReturnType<typeof useTheme>,
): string {
  switch (color) {
    case 'fg-muted':
      return theme['fg-muted']
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
    case 'fg':
    default:
      return theme.fg
  }
}

export function BodyRenderer({node}: {node: BodyNode}) {
  const theme = useTheme()

  const typeSpec = theme.type.body
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
