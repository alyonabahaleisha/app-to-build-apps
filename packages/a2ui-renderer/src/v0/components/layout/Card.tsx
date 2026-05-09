/**
 * CardRenderer — visual container with elevation, padding, and border radius.
 *
 * Elevation maps to iOS shadow props (V0 is iOS-only per ADR §context).
 * The design system stores shadow recipes as CSS strings; this component
 * translates the elevation token to React Native shadow style properties
 * using the primary shadow from each recipe:
 *
 *   flat     → no shadow
 *   raised   → 0 1px 2px rgba(15,18,22,0.06) — shadowRadius:1, opacity:0.06
 *   floating → 0 8px 24px rgba(15,18,22,0.10) — shadowRadius:8, opacity:0.10
 *
 * Both stances use the same shadow recipes (per canvas-v0-ux.md §Elevation).
 * Defaults (padding, radius) are stance-aware per LAYOUT_DEFAULTS.
 *
 * T-0006-061: elevation resolves to correct shadow recipe per stance.
 */
import React from 'react'
import {View} from 'react-native'
import type {Node} from '@app-creator/protocol'
import {useTheme, useStance} from '../../theme/RendererThemeProvider.js'
import {LAYOUT_DEFAULTS} from './defaults.js'
import {NodeRenderer} from '../NodeRenderer.js'

type CardNode = Extract<Node, {type: 'Card'}>

// ---------------------------------------------------------------------------
// Shadow recipes — translated from CSS to RN iOS shadow props.
// Values derived from canvas-v0-ux.md §Elevation and design-system tokens.
// ---------------------------------------------------------------------------
export const SHADOW_RECIPES = {
  flat: {
    shadowColor: 'transparent',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  raised: {
    // Primary shadow: 0 1px 2px rgba(15, 18, 22, 0.06)
    shadowColor: 'rgb(15, 18, 22)',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  floating: {
    // Primary shadow: 0 8px 24px rgba(15, 18, 22, 0.10)
    shadowColor: 'rgb(15, 18, 22)',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
  },
} as const

export function CardRenderer({node}: {node: CardNode}) {
  const theme = useTheme()
  const stance = useStance()
  const defaults = LAYOUT_DEFAULTS[stance]

  const elevation = node.elevation ?? 'raised'
  const shadow = SHADOW_RECIPES[elevation]

  const paddingToken = node.padding ?? defaults.cardPadding
  const paddingValue = theme.spacing[paddingToken as keyof typeof theme.spacing] ?? 0

  // Radius: schema uses full token name ('radius-md', 'radius-lg', etc.).
  // Defaults from LAYOUT_DEFAULTS are also full token names.
  const radiusToken = node.radius ?? defaults.cardRadius
  const radiusValue = theme.radii[radiusToken as keyof typeof theme.radii] ?? 0

  return (
    <View
      style={{
        backgroundColor: theme['bg-elevated'],
        padding: paddingValue,
        borderRadius: radiusValue,
        ...shadow,
      }}
      accessibilityLabel={node.accessibilityLabel}
    >
      {node.children.map((child, index) => (
        <NodeRenderer key={child.id ?? index} node={child} />
      ))}
    </View>
  )
}
