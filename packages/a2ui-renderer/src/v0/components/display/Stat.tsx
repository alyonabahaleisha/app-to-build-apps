/**
 * StatRenderer — big-number display with optional delta indicator.
 *
 * Structure (top→bottom):
 *   value — type-h1 or display depending on size; default 'md' → h1
 *   label — type-caption, fg-muted
 *   delta — type-micro, tone-colored: positive→success, negative→danger,
 *            neutral→fg-muted. Icon: ↑ up, ↓ down, → flat.
 *
 * Size → type role:
 *   'sm' → h2, 'md' → h1, 'lg' → display
 *
 * Accessibility: accessibilityRole="text" on the outer wrapper;
 * accessibilityLabel combines value + label + trend for a single VoiceOver read.
 * e.g. "5 tasks today, trending up"
 *
 * T-0006-070 / T-0006-071: snapshots at productive×focus + expressive×health
 * T-0006-079: delta-tone resolves correctly
 * T-0006-085: no delta prop → no delta block rendered
 */
import React from 'react'
import {View, Text} from 'react-native'
import type {Node} from '@app-creator/protocol'
import {useTheme} from '../../theme/RendererThemeProvider.js'

type StatNode = Extract<Node, {type: 'Stat'}>

// Delta tone → theme token
function deltaToneColor(
  deltaTone: StatNode['deltaTone'],
  theme: ReturnType<typeof useTheme>,
): string {
  switch (deltaTone) {
    case 'positive':
      return theme.success
    case 'negative':
      return theme.danger
    case 'neutral':
    default:
      return theme['fg-muted']
  }
}

// Build a simple accessibility label combining all visible information.
function buildA11yLabel(node: StatNode): string {
  const parts: string[] = [String(node.value)]
  if (node.label) parts.push(node.label)
  if (node.delta && node.deltaTone && node.deltaTone !== 'neutral') {
    parts.push(`trending ${node.deltaTone === 'positive' ? 'up' : 'down'}`)
  }
  return parts.join(', ')
}

export function StatRenderer({node}: {node: StatNode}) {
  const theme = useTheme()

  // The schema Stat has no 'size' prop — it was in the UX brief but the protocol
  // uses 'value', 'label', 'delta', 'deltaTone', 'align'. Value type defaults to h1.
  const valueTypeSpec = theme.type['h1']
  const labelTypeSpec = theme.type.caption
  const deltaTypeSpec = theme.type.micro

  const toneColor = deltaToneColor(node.deltaTone, theme)

  const a11yLabel = node.accessibilityLabel ?? buildA11yLabel(node)

  const align = node.align ?? 'start'
  const textAlign = align === 'start' ? 'left' : 'center'

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={a11yLabel}
    >
      {/* Value */}
      <Text
        style={{
          fontSize: valueTypeSpec.size,
          lineHeight: valueTypeSpec.lineHeight,
          fontWeight: String(valueTypeSpec.weight) as '600',
          letterSpacing: valueTypeSpec.letterSpacing,
          color: theme.fg,
          textAlign,
        }}
        accessibilityElementsHidden
      >
        {String(node.value)}
      </Text>

      {/* Label */}
      {node.label ? (
        <Text
          style={{
            fontSize: labelTypeSpec.size,
            lineHeight: labelTypeSpec.lineHeight,
            fontWeight: String(labelTypeSpec.weight) as '400',
            letterSpacing: labelTypeSpec.letterSpacing,
            color: theme['fg-muted'],
            textAlign,
          }}
          accessibilityElementsHidden
        >
          {node.label}
        </Text>
      ) : null}

      {/* Delta */}
      {node.delta !== undefined ? (
        <Text
          style={{
            fontSize: deltaTypeSpec.size,
            lineHeight: deltaTypeSpec.lineHeight,
            fontWeight: String(deltaTypeSpec.weight) as '500',
            letterSpacing: deltaTypeSpec.letterSpacing,
            color: toneColor,
            textAlign,
          }}
          accessibilityElementsHidden
        >
          {node.delta}
        </Text>
      ) : null}
    </View>
  )
}
