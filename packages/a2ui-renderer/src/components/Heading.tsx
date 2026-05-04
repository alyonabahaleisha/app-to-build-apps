/**
 * HeadingRenderer — display primitive for the A2UI catalog.
 *
 * Pure function of {node, state, dispatch}. Maps heading level to typography
 * and spacing tokens from RendererThemeProvider.
 *
 * Styling per Sable §A2UI Catalog Visual Treatment:
 *   level 1 → display style (28pt / 700) + padding-top: lg (24pt)
 *   level 2 → heading1   (22pt / 700) + padding-top: md (16pt)
 *   level 3 → heading2   (18pt / 600) + padding-top: sm  (8pt)
 *
 * Missing `level` defaults to 1 (T-0003-042).
 * Out-of-range `level` (bypassed Zod via `as any`) also defaults to 1 (T-0003-050c).
 *
 * Always carries accessibilityRole="header" (T-0003-039).
 */
import React from 'react'
import {Text} from 'react-native'

import {useRendererTheme} from '../theme/RendererThemeProvider'
import type {Dispatch, RenderState} from '../types'

// -- Node type (mirrored from schema) -----------------------------------------

export type A2UIHeadingNode = {
  id?: string
  type: 'Heading'
  text: string
  level?: 1 | 2 | 3
}

export interface NodeProps<T> {
  node: T
  state: RenderState
  dispatch: Dispatch
}

// -- Component ----------------------------------------------------------------

export function HeadingRenderer({node}: NodeProps<A2UIHeadingNode>): React.ReactElement {
  const theme = useRendererTheme()

  // Default to level 1; also clamp any out-of-range value (T-0003-042, T-0003-050c).
  const level: 1 | 2 | 3 =
    node.level === 1 || node.level === 2 || node.level === 3 ? node.level : 1

  const typography =
    level === 1
      ? theme.typography.display
      : level === 2
        ? theme.typography.heading1
        : theme.typography.heading2

  const paddingTop =
    level === 1
      ? theme.spacing.lg
      : level === 2
        ? theme.spacing.md
        : theme.spacing.sm

  return (
    <Text
      accessibilityRole="header"
      style={[typography, {color: theme.palette.text.primary, paddingTop}]}>
      {node.text}
    </Text>
  )
}
