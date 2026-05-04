/**
 * ListRenderer — vertical stack with optional separator lines.
 *
 * Pure function of {node, state, dispatch}.
 *
 * Default: items stacked with `md` gap (theme.spacing.md = 16).
 * separator:true: 1px `bg.subtle` Views interleaved between items; gap = 0.
 *
 * No accessibilityRole — List is a layout primitive. Children carry their
 * own roles.
 *
 * Children use key={i} (positional addressing, same rationale as Container).
 */
import React from 'react'
import {View} from 'react-native'

import type {A2UINode} from '@app-creator/a2ui-schema'

import {useRendererTheme} from '../theme/RendererThemeProvider'
import type {Dispatch, RenderState} from '../types'
import {NodeRenderer} from '../render'

// -- Node type ----------------------------------------------------------------

export type A2UIListNode = {
  id?: string
  type: 'List'
  items: A2UINode[]
  separator?: boolean
}

export interface NodeProps<T> {
  node: T
  state: RenderState
  dispatch: Dispatch
}

// -- Component ----------------------------------------------------------------

export function ListRenderer({
  node,
  state,
  dispatch,
}: NodeProps<A2UIListNode>): React.ReactElement {
  const theme = useRendererTheme()
  const useSeparator = node.separator === true

  const containerStyle = {
    gap: useSeparator ? 0 : theme.spacing.md,
  }

  const separatorStyle = {
    height: 1,
    backgroundColor: theme.palette.bg.subtle,
  }

  if (useSeparator) {
    // Interleave 1px separator Views between items.
    // A list of N items produces N-1 separators.
    const children: React.ReactNode[] = []
    node.items.forEach((item, i) => {
      children.push(
        <NodeRenderer key={`item-${i}`} node={item} state={state} dispatch={dispatch} />,
      )
      if (i < node.items.length - 1) {
        children.push(<View key={`sep-${i}`} style={separatorStyle} />)
      }
    })
    return <View style={containerStyle}>{children}</View>
  }

  return (
    <View style={containerStyle}>
      {node.items.map((item, i) => (
        <NodeRenderer key={i} node={item} state={state} dispatch={dispatch} />
      ))}
    </View>
  )
}
