/**
 * TextRenderer — body copy primitive for the A2UI catalog.
 *
 * Pure function of {node, state, dispatch}.
 *
 * Styling per Sable §A2UI Catalog Visual Treatment:
 *   default       → body (16pt / 400) + text.primary
 *   weight:'bold' → bodyStrong (16pt / 600)
 *   color:'muted' → text.muted
 *   color:'destructive' → text.destructive
 *
 * `color:'primary'` (the Zod enum allows it) resolves to text.primary — same
 * as the default, so no special branch needed.
 *
 * No accessibilityRole — plain body text carries none per RN accessibility
 * conventions (screen readers read it as static text automatically).
 */
import React from 'react'
import {Text} from 'react-native'

import {useRendererTheme} from '../theme/RendererThemeProvider'
import type {Dispatch, RenderState} from '../types'

// -- Node type (mirrored from schema) -----------------------------------------

export type A2UITextNode = {
  id?: string
  type: 'Text'
  text: string
  weight?: 'normal' | 'bold'
  color?: 'primary' | 'muted' | 'destructive'
}

export interface NodeProps<T> {
  node: T
  state: RenderState
  dispatch: Dispatch
}

// -- Component ----------------------------------------------------------------

export function TextRenderer({node}: NodeProps<A2UITextNode>): React.ReactElement {
  const theme = useRendererTheme()

  const typography = node.weight === 'bold' ? theme.typography.bodyStrong : theme.typography.body

  const color =
    node.color === 'muted'
      ? theme.palette.text.muted
      : node.color === 'destructive'
        ? theme.palette.text.destructive
        : theme.palette.text.primary

  return <Text style={[typography, {color}]}>{node.text}</Text>
}
