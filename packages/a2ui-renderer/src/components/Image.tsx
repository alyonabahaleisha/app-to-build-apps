/**
 * ImageRenderer — image display primitive for the A2UI catalog.
 *
 * Pure function of {node, state, dispatch}.
 *
 * Styling per Sable §A2UI Catalog Visual Treatment:
 *   aspectRatio provided → locked (T-0003-047, T-0003-050)
 *   aspectRatio absent   → maxHeight: 240pt with bg.subtle letterbox (T-0003-048)
 *
 * `alt` → accessibilityLabel (T-0003-049).
 * radius: md applied per Sable line 400.
 *
 * Malformed / unreachable URLs do NOT throw — RN's Image renders a
 * broken-image placeholder natively (T-0003-050b). The onError handler is
 * a no-op intentionally; we never want a bad URL to trip the render-error
 * boundary (per ADR §F).
 */
import React from 'react'
import {Image, View} from 'react-native'

import {useRendererTheme} from '../theme/RendererThemeProvider'
import type {Dispatch, RenderState} from '../types'

// -- Node type (mirrored from schema) -----------------------------------------

export type A2UIImageNode = {
  id?: string
  type: 'Image'
  src: string
  aspectRatio?: number
  alt?: string
}

export interface NodeProps<T> {
  node: T
  state: RenderState
  dispatch: Dispatch
}

// -- Component ----------------------------------------------------------------

export function ImageRenderer({node}: NodeProps<A2UIImageNode>): React.ReactElement {
  const theme = useRendererTheme()

  if (node.aspectRatio !== undefined) {
    // Locked aspect ratio — container fills available width.
    return (
      <Image
        source={{uri: node.src}}
        accessibilityLabel={node.alt}
        style={{
          width: '100%',
          aspectRatio: node.aspectRatio,
          borderRadius: theme.radius.md,
        }}
        onError={() => {
          // Intentional no-op: bad URLs render RN's broken-image placeholder.
          // Do NOT rethrow — must not trip the render-error boundary (T-0003-050b).
        }}
      />
    )
  }

  // No aspectRatio — letterbox with bg.subtle background, maxHeight 240pt.
  return (
    <View
      style={{
        backgroundColor: theme.palette.bg.subtle,
        borderRadius: theme.radius.md,
        overflow: 'hidden',
        maxHeight: 240,
      }}>
      <Image
        source={{uri: node.src}}
        accessibilityLabel={node.alt}
        style={{
          width: '100%',
          height: 240,
          resizeMode: 'contain',
        }}
        onError={() => {
          // Intentional no-op (T-0003-050b).
        }}
      />
    </View>
  )
}
