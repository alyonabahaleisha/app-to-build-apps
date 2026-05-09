/**
 * NoNav — single-screen renderer for specs with navigation: 'none'.
 *
 * The simplest nav pattern: no navigation surface whatsoever.
 * Body fills available height. Suitable for calculators, tip splitters,
 * single-form tools.
 *
 * Per UX doc §Internal Nav Patterns "Pattern 1: none":
 *   No internal nav surface. Body fills available height.
 *
 * T-0006-162: Renderer with navigation:'none' mounts NoNav with single screen.
 * T-0006-172c: navigate(target) on 'none' pattern calls host.onNavigationError('navigate-on-none-nav')
 *              — this is handled by the navigation middleware (getNav() returns null here).
 */
import React from 'react'
import {View} from 'react-native'
import type {Spec} from '@app-creator/protocol'
import {NodeRenderer} from '../components/NodeRenderer.js'

export type NoNavProps = {
  spec: Spec
}

export function NoNav({spec}: NoNavProps) {
  const screen = spec.screens[0]
  // Schema validates at least 1 screen for 'none' nav; defensive guard satisfies TS.
  if (!screen) return null

  return (
    <View style={{flex: 1}}>
      <NodeRenderer node={screen.root} />
    </View>
  )
}
