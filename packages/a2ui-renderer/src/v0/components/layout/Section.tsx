/**
 * SectionRenderer — vertical content group with optional title and caption.
 *
 * Renders a labeled section: optional title in `type-h2` + `fg`, optional
 * caption in `type-caption` + `fg-muted`, then children stacked vertically.
 * Padding is the stance default (space-md productive, space-lg expressive)
 * unless overridden by the `padding` prop.
 */
import React from 'react'
import {View, Text} from 'react-native'
import type {Node} from '@app-creator/protocol'
import {useTheme, useStance} from '../../theme/RendererThemeProvider.js'
import {LAYOUT_DEFAULTS} from './defaults.js'
import {NodeRenderer} from '../NodeRenderer.js'
import type {TextStyle} from 'react-native'

type SectionNode = Extract<Node, {type: 'Section'}>

export function SectionRenderer({node}: {node: SectionNode}) {
  const theme = useTheme()
  const stance = useStance()

  const paddingToken = node.padding ?? LAYOUT_DEFAULTS[stance].sectionPadding
  const paddingValue = theme.spacing[paddingToken as keyof typeof theme.spacing] ?? 0

  const titleStyle = theme.type.h2
  const captionStyle = theme.type.caption

  return (
    <View
      style={{paddingVertical: paddingValue}}
      accessibilityLabel={node.accessibilityLabel}
    >
      {node.title != null && (
        <Text
          style={{
            fontSize: titleStyle.size,
            lineHeight: titleStyle.lineHeight,
            fontWeight: String(titleStyle.weight) as TextStyle['fontWeight'],
            letterSpacing: titleStyle.letterSpacing,
            color: theme.fg,
            marginBottom: 4,
          }}
          accessibilityRole="header"
        >
          {node.title}
        </Text>
      )}
      {node.caption != null && (
        <Text
          style={{
            fontSize: captionStyle.size,
            lineHeight: captionStyle.lineHeight,
            fontWeight: String(captionStyle.weight) as TextStyle['fontWeight'],
            letterSpacing: captionStyle.letterSpacing,
            color: theme['fg-muted'],
            marginBottom: 8,
          }}
        >
          {node.caption}
        </Text>
      )}
      {node.children.map((child, index) => (
        <NodeRenderer key={child.id ?? index} node={child} />
      ))}
    </View>
  )
}
