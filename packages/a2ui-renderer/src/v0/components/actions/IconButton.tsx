/**
 * IconButtonRenderer — compact icon-only button for headers and toolbars.
 *
 * V1 Phase 1 Step 1 (T-0009-026..034).
 *
 * Visual (per canvas-v1-catalog-expansion-phase1-ux.md §IconButton):
 *   - Circular tap area (`radius-full`).
 *   - Variant treatments:
 *     primary    → `accent` background, `accent-fg` icon.
 *     secondary  → `bg-elevated` background with 1pt `divider` border, `fg` icon.
 *     ghost      → transparent background (no border), `fg` icon. (Default)
 *     destructive→ `danger` icon, transparent background. (Tints `danger` 8% on press.)
 *   - Press: 10% darker for primary, 6% tint for secondary/ghost/destructive.
 *   - Disabled: 50% opacity, no haptic.
 *
 * Sizes (icon diameter / minimum hit target):
 *   sm → 24pt icon / 44pt hit target
 *   md → 32pt icon / 44pt hit target (default)
 *   lg → 44pt icon / 56pt hit target
 *
 * accessibilityLabel is required — icon alone is not labeled.
 *
 * Haptics are fired by the haptics middleware when the dispatched action
 * arrives. The component itself does not call expo-haptics directly.
 *
 * T-0009-026: snapshot at productive×focus
 * T-0009-027: snapshot at expressive×health
 * T-0009-028: all variants render correct theme colors
 * T-0009-029: sizes enforce correct hit target dimensions
 * T-0009-030: disabled binding resolves; press is no-op
 * T-0009-031: press dispatches action verb
 */
import React from 'react'
import {Pressable, View} from 'react-native'
import type {Node} from '@app-creator/protocol'
import {Icon} from '@app-creator/design-system'
import {useTheme} from '../../theme/RendererThemeProvider.js'
import {useBinding} from '../../state/useBinding.js'
import {useRendererStateContext} from '../../state/useRendererState.js'

type IconButtonNode = Extract<Node, {type: 'IconButton'}>

// Circular icon container diameter per button size.
// sm → 24pt container, md → 32pt container, lg → 44pt container.
const ICON_CONTAINER_BY_SIZE = {sm: 24, md: 32, lg: 44} as const
// Hit target (minimum pressable area) per size — always ≥ 44pt.
const HIT_TARGET_BY_SIZE = {sm: 44, md: 44, lg: 56} as const
// Icon glyph size (the SVG) per button size. Must be in {16, 20, 24, 32} (Icon union).
const ICON_GLYPH_BY_SIZE = {sm: 16, md: 20, lg: 24} as const

type IconGlyphSize = 16 | 20 | 24

export function IconButtonRenderer({node}: {node: IconButtonNode}) {
  const theme = useTheme()
  const {dispatch} = useRendererStateContext()

  const variant = node.variant ?? 'ghost'
  const size = node.size ?? 'md'
  const iconContainer = ICON_CONTAINER_BY_SIZE[size]
  const hitTarget = HIT_TARGET_BY_SIZE[size]
  const iconGlyphSize = ICON_GLYPH_BY_SIZE[size] as IconGlyphSize

  // Resolve disabled binding (BooleanBinding | undefined).
  const disabledRaw = useBinding<boolean>(
    node.disabled ?? {kind: 'literal', value: false},
  )
  const isDisabled = disabledRaw ?? false

  const {iconColor, bg, pressedBg, borderWidth, borderColor} = resolveVariantStyle(
    variant,
    theme,
  )

  function handlePress() {
    if (isDisabled) return
    dispatch(node.action)
  }

  return (
    <Pressable
      onPress={handlePress}
      style={{
        width: hitTarget,
        height: hitTarget,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: isDisabled ? 0.5 : 1,
      }}
      accessibilityRole="button"
      accessibilityLabel={node.accessibilityLabel}
      accessibilityState={{disabled: isDisabled}}
      disabled={isDisabled}
    >
      {({pressed}) => (
        <View
          style={{
            width: iconContainer,
            height: iconContainer,
            borderRadius: theme.radii['radius-full'],
            backgroundColor: pressed && !isDisabled ? pressedBg : bg,
            borderWidth: borderWidth ?? 0,
            borderColor: borderColor ?? 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={node.icon} size={iconGlyphSize} color={iconColor} />
        </View>
      )}
    </Pressable>
  )
}

// ---------------------------------------------------------------------------
// resolveVariantStyle — maps variant → concrete colors from the theme.
// ---------------------------------------------------------------------------

type VariantStyle = {
  bg: string
  pressedBg: string
  iconColor: string
  borderWidth?: number
  borderColor?: string
}

function resolveVariantStyle(
  variant: IconButtonNode['variant'],
  theme: ReturnType<typeof useTheme>,
): VariantStyle {
  switch (variant) {
    case 'primary':
      return {
        bg: theme.accent,
        pressedBg: theme.accent, // opacity on container drives the press tint
        iconColor: theme['accent-fg'],
      }
    case 'secondary':
      return {
        bg: theme['bg-elevated'],
        pressedBg: theme['bg-elevated'],
        iconColor: theme.fg,
        borderWidth: 1,
        borderColor: theme.divider,
      }
    case 'destructive':
      return {
        bg: 'transparent',
        pressedBg: theme.danger + '14', // danger at ~8% alpha
        iconColor: theme.danger,
      }
    case 'ghost':
    default:
      return {
        bg: 'transparent',
        pressedBg: theme['bg-elevated'],
        iconColor: theme.fg,
      }
  }
}
