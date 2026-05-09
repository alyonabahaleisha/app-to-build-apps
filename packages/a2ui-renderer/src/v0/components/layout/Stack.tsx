/**
 * StackRenderer — vertical flex container.
 *
 * Stacks children vertically with a gap and optional alignment. Gap is
 * simulated via marginBottom on each child wrapper (except the last) for
 * consistent behavior with the spacing token system.
 *
 * Align prop maps to RN's `alignItems`:
 *   'start' → 'flex-start'
 *   'center' → 'center'
 *   'end' → 'flex-end'
 *   'stretch' → 'stretch' (default)
 */
import React from 'react'
import {View} from 'react-native'
import type {Node} from '@app-creator/protocol'
import {useTheme, useStance} from '../../theme/RendererThemeProvider.js'
import {LAYOUT_DEFAULTS} from './defaults.js'
import {NodeRenderer} from '../NodeRenderer.js'

type StackNode = Extract<Node, {type: 'Stack'}>

// Map Stack.align values to React Native flexbox values.
const ALIGN_MAP = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
} as const

export function StackRenderer({node}: {node: StackNode}) {
  const theme = useTheme()
  const stance = useStance()

  const gapToken = node.gap ?? LAYOUT_DEFAULTS[stance].stackGap
  const gapValue = theme.spacing[gapToken as keyof typeof theme.spacing] ?? 0

  const align = node.align ?? 'stretch'
  const {children} = node

  return (
    <View
      style={{
        flexDirection: 'column',
        alignItems: ALIGN_MAP[align],
      }}
      accessibilityLabel={node.accessibilityLabel}
    >
      {children.map((child, index) => (
        <View
          key={child.id ?? index}
          style={{marginBottom: index < children.length - 1 ? gapValue : 0}}
        >
          <NodeRenderer node={child} />
        </View>
      ))}
    </View>
  )
}
