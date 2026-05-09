/**
 * RowRenderer — horizontal flex container.
 *
 * Lays out children horizontally with gap (simulated via marginRight on each
 * child wrapper except the last), alignment, justification, and optional
 * wrapping.
 *
 * Prop mappings to RN flexbox:
 *   align: 'start' → 'flex-start', 'center', 'end' → 'flex-end'
 *   justify: 'start' → 'flex-start', 'center', 'end' → 'flex-end',
 *             'space-between', 'space-around'
 *   wrap: true → 'wrap', false → 'nowrap'
 */
import React from 'react'
import {View} from 'react-native'
import type {Node} from '@app-creator/protocol'
import {useTheme, useStance} from '../../theme/RendererThemeProvider.js'
import {LAYOUT_DEFAULTS} from './defaults.js'
import {NodeRenderer} from '../NodeRenderer.js'

type RowNode = Extract<Node, {type: 'Row'}>

const ALIGN_MAP = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
} as const

const JUSTIFY_MAP = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  'space-between': 'space-between',
  'space-around': 'space-around',
} as const

export function RowRenderer({node}: {node: RowNode}) {
  const theme = useTheme()
  const stance = useStance()

  const gapToken = node.gap ?? LAYOUT_DEFAULTS[stance].rowGap
  const gapValue = theme.spacing[gapToken as keyof typeof theme.spacing] ?? 0

  const align = node.align ?? 'center'
  const justify = node.justify ?? 'start'
  const wrap = node.wrap ?? false
  const {children} = node

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: ALIGN_MAP[align],
        justifyContent: JUSTIFY_MAP[justify],
        flexWrap: wrap ? 'wrap' : 'nowrap',
      }}
      accessibilityLabel={node.accessibilityLabel}
    >
      {children.map((child, index) => (
        <View
          key={child.id ?? index}
          style={{marginRight: index < children.length - 1 ? gapValue : 0}}
        >
          <NodeRenderer node={child} />
        </View>
      ))}
    </View>
  )
}
