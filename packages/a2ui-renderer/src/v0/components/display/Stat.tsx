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
import React, {useMemo} from 'react'
import {View, Text} from 'react-native'
import type {Node} from '@app-creator/protocol'
import {useTheme} from '../../theme/RendererThemeProvider.js'
import {useBinding} from '../../state/useBinding.js'
import type {Binding} from '../../state/useBinding.js'

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
function buildA11yLabel(resolvedValue: string, node: StatNode): string {
  const parts: string[] = [resolvedValue]
  if (node.label) parts.push(node.label)
  if (node.delta && node.deltaTone && node.deltaTone !== 'neutral') {
    parts.push(`trending ${node.deltaTone === 'positive' ? 'up' : 'down'}`)
  }
  return parts.join(', ')
}

export function StatRenderer({node}: {node: StatNode}) {
  const theme = useTheme()

  // Always call useBinding to satisfy rules-of-hooks. When no valueBinding is
  // present, use a stable literal binding derived from node.value so the hook
  // is never skipped. The XOR refine on StatSchema guarantees exactly one is set.
  const fallbackBinding = useMemo<Binding<string>>(
    () => ({kind: 'literal', value: node.value ?? ''}),
    [node.value],
  )
  const binding: Binding<string | number> = node.valueBinding ?? fallbackBinding
  const boundValue = useBinding<string | number>(binding)
  const resolvedValue = String(boundValue ?? '')

  // The schema Stat has no 'size' prop — it was in the UX brief but the protocol
  // uses 'value', 'label', 'delta', 'deltaTone', 'align'. Value type defaults to h1.
  const valueTypeSpec = theme.type['h1']
  const labelTypeSpec = theme.type.caption
  const deltaTypeSpec = theme.type.micro

  const toneColor = deltaToneColor(node.deltaTone, theme)

  const a11yLabel = node.accessibilityLabel ?? buildA11yLabel(resolvedValue, node)

  const align = node.align ?? 'start'
  const textAlign = align === 'start' ? 'left' : 'center'

  const isEmpty = resolvedValue === ''

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={a11yLabel}
    >
      {/* Value — or empty-state label when binding resolves to null/undefined */}
      {isEmpty ? (
        <Text
          style={{
            fontSize: labelTypeSpec.size,
            lineHeight: labelTypeSpec.lineHeight,
            fontWeight: String(labelTypeSpec.weight) as '400',
            letterSpacing: labelTypeSpec.letterSpacing,
            color: theme['fg-muted'],
            fontStyle: 'italic',
            textAlign,
          }}
          accessibilityElementsHidden
        >
          {node.emptyLabel ?? 'Not yet tracked'}
        </Text>
      ) : (
        <Text
          style={{
            fontSize: valueTypeSpec.size,
            lineHeight: valueTypeSpec.lineHeight,
            fontWeight: String(valueTypeSpec.weight) as '600',
            letterSpacing: valueTypeSpec.letterSpacing,
            color: theme.fg,
            textAlign,
          }}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
          accessibilityElementsHidden
        >
          {resolvedValue}
        </Text>
      )}

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
