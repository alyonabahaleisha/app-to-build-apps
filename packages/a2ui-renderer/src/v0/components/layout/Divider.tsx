/**
 * DividerRenderer — horizontal separator.
 *
 * V1 Phase 1 Step 1 (T-0009-018, T-0009-019, T-0009-025, T-0009-026, T-0009-243).
 *
 * Visual (per canvas-v1-catalog-expansion-phase1-ux.md §Divider):
 *   - No label: horizontal line at `divider` color, full width minus inset.
 *   - With label: line + centered label in `type-micro`, `fg-muted`, padded `space-md`.
 *   - Hairline = 1pt height; thick = 2pt.
 *   - Inset 'start' = 16pt left padding; 'both' = 16pt both sides.
 *
 * Stance:
 *   - Productive: space-md vertical margin.
 *   - Expressive: space-lg vertical margin.
 *
 * Accessibility:
 *   - No label: accessibilityRole="none" (decorative — VoiceOver skips).
 *   - With label: accessibilityRole="text", accessibilityLabel={label}.
 */
import React from 'react'
import {View, Text} from 'react-native'
import type {Node} from '@app-creator/protocol'
import {useTheme, useStance} from '../../theme/RendererThemeProvider.js'

type DividerNode = Extract<Node, {type: 'Divider'}>

const INSET_VALUE = 16

export function DividerRenderer({node}: {node: DividerNode}) {
  const theme = useTheme()
  const stance = useStance()

  const weight = node.weight ?? 'hairline'
  const lineHeight = weight === 'thick' ? 2 : 1
  const inset = node.inset ?? 'none'

  const marginVertical = theme.spacing[stance === 'expressive' ? 'space-lg' : 'space-md']

  const paddingLeft = inset === 'start' || inset === 'both' ? INSET_VALUE : 0
  const paddingRight = inset === 'both' ? INSET_VALUE : 0

  const microStyle = theme.type.micro

  if (node.label) {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginVertical,
          paddingLeft,
          paddingRight,
        }}
        accessibilityRole="text"
        accessibilityLabel={node.accessibilityLabel ?? node.label}
      >
        <View style={{flex: 1, height: lineHeight, backgroundColor: theme.divider}} />
        <Text
          style={{
            fontSize: microStyle.size,
            lineHeight: microStyle.lineHeight,
            fontWeight: String(microStyle.weight) as '400' | '500' | '600',
            letterSpacing: microStyle.letterSpacing,
            color: theme['fg-muted'],
            marginHorizontal: theme.spacing['space-md'],
          }}
          accessibilityElementsHidden
        >
          {node.label}
        </Text>
        <View style={{flex: 1, height: lineHeight, backgroundColor: theme.divider}} />
      </View>
    )
  }

  return (
    <View
      style={{
        height: lineHeight,
        backgroundColor: theme.divider,
        marginVertical,
        marginLeft: paddingLeft,
        marginRight: paddingRight,
      }}
      accessibilityRole="none"
    />
  )
}
