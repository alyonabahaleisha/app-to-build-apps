/**
 * ChipRenderer — filter/selection pill, non-interactive in V0.
 *
 * Per UX doc: Chip is non-interactive in V0 renderer. Selection state comes
 * from binding upstream; the renderer just shows the visual state.
 * Interactive behavior (action dispatch) is wired in Step 9 when actions land.
 *
 * Selected states:
 *   unselected → bg-elevated background, fg-muted text, divider border
 *   selected   → accent background, accent-fg text, no border
 *
 * Shape: radius-full (pill), space-sm vertical / space-md horizontal padding.
 * Type: type-caption (13pt). Icon: 16pt if present.
 *
 * Accessibility: accessibilityRole="text" + accessibilityLabel = text.
 * (non-interactive in V0 so we do not use 'button' role yet)
 *
 * T-0006-074 / T-0006-075: snapshots at productive×focus + expressive×health
 * T-0006-081: selected state inverts to accent/accent-fg
 */
import React from 'react'
import {View, Text} from 'react-native'
import type {Node} from '@app-creator/protocol'
import {Icon} from '@app-creator/design-system'
import {useTheme} from '../../theme/RendererThemeProvider.js'

type ChipNode = Extract<Node, {type: 'Chip'}>

export function ChipRenderer({node}: {node: ChipNode}) {
  const theme = useTheme()

  const selected = node.selected ?? false

  const backgroundColor = selected ? theme.accent : theme['bg-elevated']
  const textColor = selected ? theme['accent-fg'] : theme['fg-muted']
  const borderColor = selected ? 'transparent' : theme.divider
  const borderWidth = selected ? 0 : 1

  const captionSpec = theme.type.caption

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor,
        borderRadius: theme.radii['radius-full'],
        borderWidth,
        borderColor,
        paddingVertical: theme.spacing['space-sm'],
        paddingHorizontal: theme.spacing['space-md'],
        alignSelf: 'flex-start',
        gap: theme.spacing['space-xs'],
      }}
      accessibilityRole="text"
      accessibilityLabel={node.accessibilityLabel ?? node.text}
    >
      {node.icon ? (
        <Icon name={node.icon} size={16} color={textColor} />
      ) : null}
      <Text
        style={{
          fontSize: captionSpec.size,
          lineHeight: captionSpec.lineHeight,
          fontWeight: String(captionSpec.weight) as '400',
          letterSpacing: captionSpec.letterSpacing,
          color: textColor,
        }}
        accessibilityElementsHidden
      >
        {node.text}
      </Text>
    </View>
  )
}
