/**
 * ChipRenderer — filter/selection pill, tappable when action is present.
 *
 * Selected states:
 *   unselected → bg-elevated background, fg-muted text, divider border
 *   selected   → accent background, accent-fg text, no border
 *
 * Shape: radius-full (pill), space-sm vertical / space-md horizontal padding.
 * Type: type-caption (13pt). Icon: 16pt if present.
 *
 * Accessibility:
 *   interactive → accessibilityRole="button"
 *   static      → accessibilityRole="text"
 *
 * T-0006-074 / T-0006-075: snapshots at productive×focus + expressive×health
 * T-0006-081: selected state inverts to accent/accent-fg
 */
import React from 'react'
import {View, Text, Pressable} from 'react-native'
import type {Node} from '@app-creator/protocol'
import {Icon} from '@app-creator/design-system'
import {useTheme} from '../../theme/RendererThemeProvider.js'
import {useRendererStateContext} from '../../state/useRendererState.js'

type ChipNode = Extract<Node, {type: 'Chip'}>

export function ChipRenderer({node}: {node: ChipNode}) {
  const theme = useTheme()
  const {dispatch} = useRendererStateContext()

  const selected = node.selected ?? false

  const backgroundColor = selected ? theme.accent : theme['bg-elevated']
  const textColor = selected ? theme['accent-fg'] : theme['fg-muted']
  const borderColor = selected ? 'transparent' : theme.divider
  const borderWidth = selected ? 0 : 1

  const captionSpec = theme.type.caption

  const isInteractive = node.action != null

  function handlePress() {
    if (node.action) {
      dispatch(node.action)
    }
  }

  const chipStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor,
    borderRadius: theme.radii['radius-full'],
    borderWidth,
    borderColor,
    paddingVertical: theme.spacing['space-sm'],
    paddingHorizontal: theme.spacing['space-md'],
    alignSelf: 'flex-start' as const,
    gap: theme.spacing['space-xs'],
  }

  const chipContent = (
    <>
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
    </>
  )

  if (isInteractive) {
    return (
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={node.accessibilityLabel ?? node.text}
        style={({pressed}) => ({...chipStyle, opacity: pressed ? 0.85 : 1})}
      >
        {chipContent}
      </Pressable>
    )
  }

  return (
    <View
      style={chipStyle}
      accessibilityRole="text"
      accessibilityLabel={node.accessibilityLabel ?? node.text}
    >
      {chipContent}
    </View>
  )
}
