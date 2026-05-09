/**
 * BadgeRenderer — small status pill with tone-tinted background.
 *
 * Tone → background / foreground mapping:
 *   neutral → divider bg, fg text
 *   accent  → accent bg, accent-fg text
 *   success → success bg (10% opacity tint), success fg
 *   warning → warning bg (10% opacity tint), warning fg
 *   danger  → danger bg (10% opacity tint), danger fg
 *
 * For success/warning/danger we don't have pre-built tint tokens, so we
 * render the full color at 15% opacity for background and the full color
 * for text — readable and consistent with iOS convention for status pills.
 *
 * Shape: radius-sm (6pt), horizontal padding space-sm (8pt).
 * Type: type-micro (11pt/500).
 *
 * Accessibility: accessibilityRole="text" + accessibilityLabel = text.
 *
 * T-0006-072 / T-0006-073: snapshots at productive×focus + expressive×health
 * T-0006-080: tone enum renders correct background tint
 */
import React from 'react'
import {View, Text} from 'react-native'
import type {Node} from '@app-creator/protocol'
import {useTheme} from '../../theme/RendererThemeProvider.js'

type BadgeNode = Extract<Node, {type: 'Badge'}>

type ToneStyles = {
  backgroundColor: string
  color: string
}

function resolveToneStyles(
  tone: BadgeNode['tone'],
  theme: ReturnType<typeof useTheme>,
): ToneStyles {
  switch (tone) {
    case 'accent':
      return {backgroundColor: theme.accent, color: theme['accent-fg']}
    case 'success':
      // Tinted background: success color at 15% opacity over bg-elevated
      return {backgroundColor: theme.success + '26', color: theme.success}
    case 'warning':
      return {backgroundColor: theme.warning + '26', color: theme.warning}
    case 'danger':
      return {backgroundColor: theme.danger + '26', color: theme.danger}
    case 'neutral':
    default:
      return {backgroundColor: theme.divider, color: theme['fg-muted']}
  }
}

export function BadgeRenderer({node}: {node: BadgeNode}) {
  const theme = useTheme()
  const {backgroundColor, color} = resolveToneStyles(node.tone, theme)

  const microSpec = theme.type.micro

  return (
    <View
      style={{
        backgroundColor,
        borderRadius: theme.radii['radius-sm'],
        paddingHorizontal: theme.spacing['space-sm'],
        paddingVertical: theme.spacing['space-xs'],
        alignSelf: 'flex-start',
      }}
      accessibilityRole="text"
      accessibilityLabel={node.accessibilityLabel ?? node.text}
    >
      <Text
        style={{
          fontSize: microSpec.size,
          lineHeight: microSpec.lineHeight,
          fontWeight: String(microSpec.weight) as '500',
          letterSpacing: microSpec.letterSpacing,
          color,
        }}
        accessibilityElementsHidden
      >
        {node.text}
      </Text>
    </View>
  )
}
