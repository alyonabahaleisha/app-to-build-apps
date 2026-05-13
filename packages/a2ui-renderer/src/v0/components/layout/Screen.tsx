/**
 * ScreenRenderer — top-level screen wrapper.
 *
 * Renders the screen's children with horizontal padding (stance-default or
 * explicit) and safe-area insets (top / bottom / both / none). One Screen
 * per rendered view; not nestable per protocol schema.
 *
 * Safe area is applied via react-native-safe-area-context's useSafeAreaInsets()
 * so the renderer doesn't depend on a <SafeAreaProvider> from the host
 * (the insets hook works under any SafeAreaProvider in the tree, including the
 * one apps/mobile wraps around the whole app).
 *
 * Horizontal padding comes from the screen's `padding` prop or the stance default.
 * Vertical padding is owned per-section; Screen applies no top/bottom padding
 * beyond safe area offsets.
 *
 * Props are typed against the Node union's Screen member (children: Node[])
 * rather than the schema's Screen type (children: unknown[]) to avoid casts.
 */
import React from 'react'
import {ScrollView, View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import type {Node} from '@app-creator/protocol'
import {useTheme, useStance} from '../../theme/RendererThemeProvider.js'
import {LAYOUT_DEFAULTS} from './defaults.js'
import {NodeRenderer} from '../NodeRenderer.js'

// ---------------------------------------------------------------------------
// Node type alias for Screen member of the Node union
// ---------------------------------------------------------------------------

type ScreenNode = Extract<Node, {type: 'Screen'}>

// ---------------------------------------------------------------------------
// Safe-area helper
// ---------------------------------------------------------------------------

type SafeAreaOption = 'top' | 'bottom' | 'both' | 'none'

function buildSafePadding(
  option: SafeAreaOption,
  insets: {top: number; bottom: number},
): {paddingTop: number; paddingBottom: number} {
  switch (option) {
    case 'top':
      return {paddingTop: insets.top, paddingBottom: 0}
    case 'bottom':
      return {paddingTop: 0, paddingBottom: insets.bottom}
    case 'both':
      return {paddingTop: insets.top, paddingBottom: insets.bottom}
    case 'none':
      return {paddingTop: 0, paddingBottom: 0}
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ScreenRenderer({node}: {node: ScreenNode}) {
  const theme = useTheme()
  const stance = useStance()
  const insets = useSafeAreaInsets()

  const paddingToken = node.padding ?? LAYOUT_DEFAULTS[stance].screenPadding
  const horizontalPadding = theme.spacing[paddingToken as keyof typeof theme.spacing] ?? 0

  const safeArea = node.safeArea ?? 'both'
  const safePadding = buildSafePadding(safeArea as SafeAreaOption, insets)

  return (
    <ScrollView
      style={{flex: 1, backgroundColor: theme.bg}}
      contentContainerStyle={{
        flexGrow: 1,
        paddingHorizontal: horizontalPadding,
        paddingTop: safePadding.paddingTop,
        paddingBottom: safePadding.paddingBottom,
      }}
      keyboardShouldPersistTaps="handled"
      accessibilityLabel={node.accessibilityLabel}
    >
      {node.children.map((child, index) => (
        <NodeRenderer key={child.id ?? index} node={child} />
      ))}
    </ScrollView>
  )
}
