/**
 * ContainerRenderer — layout primitive for the A2UI catalog.
 *
 * Pure function of {node, state, dispatch}. Maps spec values to RN flexbox
 * via theme tokens from RendererThemeProvider.
 *
 * No accessibilityRole — Container is layout-only. Children carry their own
 * roles (T-0003-038).
 *
 * Children use key={i} (index-as-key). A2UI children are positionally
 * addressed in the spec; appending a child at the end does not change the
 * identity of existing children at earlier indices (T-0003-038c).
 */
import React from 'react'
import {View} from 'react-native'

import type {A2UINode} from '@app-creator/a2ui-schema'

import {useRendererTheme} from '../theme/RendererThemeProvider'
import type {Dispatch, RenderState} from '../types'

// NodeRenderer is in render.tsx — imported here to keep ContainerRenderer
// self-contained without creating a circular dependency. render.tsx imports
// ContainerRenderer via the switch; ContainerRenderer calls NodeRenderer.
// We break the cycle by using a lazy require inside the component body, but
// the cleaner approach is to extract NodeRenderer into its own module.
// For Step 2 we inline the import from render.tsx — TypeScript allows this
// because there is no actual circular *value* dependency (just type-level).
import {NodeRenderer} from '../render'

// -- Flex-value maps ----------------------------------------------------------

const ALIGN_MAP: Record<
  NonNullable<A2UIContainerNode['align']>,
  'flex-start' | 'center' | 'flex-end' | 'stretch'
> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
}

const JUSTIFY_MAP: Record<
  NonNullable<A2UIContainerNode['justify']>,
  'flex-start' | 'center' | 'flex-end' | 'space-between'
> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
}

// -- Node type (mirrored from the schema A2UINode union) ----------------------

export type A2UIContainerNode = {
  id?: string
  type: 'Container'
  direction: 'row' | 'column'
  children: A2UINode[]
  padding?: 'none' | 'sm' | 'md' | 'lg'
  gap?: 'none' | 'sm' | 'md' | 'lg'
  align?: 'start' | 'center' | 'end' | 'stretch'
  justify?: 'start' | 'center' | 'end' | 'between'
}

export interface NodeProps<T> {
  node: T
  state: RenderState
  dispatch: Dispatch
}

// -- Component ----------------------------------------------------------------

export function ContainerRenderer({
  node,
  state,
  dispatch,
}: NodeProps<A2UIContainerNode>): React.ReactElement {
  const theme = useRendererTheme()

  const paddingKey = node.padding ?? 'none'
  const gapKey = node.gap ?? 'none'

  const style = {
    flexDirection: node.direction,
    padding: paddingKey === 'none' ? 0 : theme.spacing[paddingKey],
    gap: gapKey === 'none' ? 0 : theme.spacing[gapKey],
    alignItems: node.align ? ALIGN_MAP[node.align] : undefined,
    justifyContent: node.justify ? JUSTIFY_MAP[node.justify] : undefined,
  }

  return (
    <View style={style}>
      {node.children.map((child, i) => (
        <NodeRenderer key={i} node={child} state={state} dispatch={dispatch} />
      ))}
    </View>
  )
}
