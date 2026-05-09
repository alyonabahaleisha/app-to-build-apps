/**
 * ButtonRenderer — primary interaction component for the V0 renderer.
 *
 * Variants (per canvas-v0-ux.md §Button):
 *   primary     → accent bg, accent-fg text, radius-md. Light haptic on press.
 *   secondary   → bg-elevated bg, fg text, divider border 1pt. No haptic (set).
 *   destructive → danger bg, white text. Medium haptic (handled by haptics middleware).
 *   text        → transparent bg, accent text. No haptic.
 *
 * Sizes enforce minimum heights (per T-0006-153 / ADR-0006 Step 9 ACs):
 *   sm → 32pt
 *   md → 44pt (default)
 *   lg → 56pt
 *
 * Disabled state:
 *   - Resolved via useBinding<boolean>(node.disabled) (BooleanBinding)
 *   - 50% opacity on the container
 *   - onPress is a no-op (no dispatch, no haptic)
 *   - accessibilityState={{disabled: true}}
 *
 * Icon:
 *   - Optional leading or trailing icon via node.icon / node.iconPosition
 *   - Rendered via <Icon> from @app-creator/design-system
 *   - Size matches text: sm=16, md=20, lg=24
 *
 * fullWidth:
 *   - When true, button stretches to container width (alignSelf: 'stretch').
 *
 * Haptics are fired by the haptics middleware upstream when the dispatched
 * action arrives. The component itself does not call expo-haptics directly.
 *
 * T-0006-148: snapshot at productive×focus
 * T-0006-149: snapshot at expressive×health
 * T-0006-152: variants render correct theme colors
 * T-0006-153: sizes enforce 32/44/56 pt heights
 * T-0006-154: disabled binding resolves; press is no-op
 * T-0006-155: press dispatches action verb
 */
import React from 'react'
import {Pressable, Text, View} from 'react-native'
import type {Node} from '@app-creator/protocol'
import {Icon} from '@app-creator/design-system'
import {useTheme} from '../../theme/RendererThemeProvider.js'
import {useBinding} from '../../state/useBinding.js'
import {useRendererStateContext} from '../../state/useRendererState.js'

type ButtonNode = Extract<Node, {type: 'Button'}>

// Minimum heights per size (pt).
const HEIGHT_BY_SIZE = {sm: 32, md: 44, lg: 56} as const

// Icon size per button size.
const ICON_SIZE_BY_SIZE = {sm: 16, md: 20, lg: 24} as const

type IconSizeT = 16 | 20 | 24

export function ButtonRenderer({node}: {node: ButtonNode}) {
  const theme = useTheme()
  const {dispatch} = useRendererStateContext()

  const variant = node.variant ?? 'primary'
  const size = node.size ?? 'md'
  const minHeight = HEIGHT_BY_SIZE[size]
  const iconSize = ICON_SIZE_BY_SIZE[size] as IconSizeT
  const iconPosition = node.iconPosition ?? 'leading'

  // Resolve disabled binding (BooleanBinding | undefined).
  const disabledRaw = useBinding<boolean>(
    node.disabled ?? {kind: 'literal', value: false},
  )
  const isDisabled = disabledRaw ?? false

  // Variant-resolved colors.
  const variantStyle = resolveVariantStyle(variant, theme)

  const bodySpec = theme.type.body
  const captionSpec = theme.type.caption

  // Font spec by size: sm → caption, md/lg → body
  const textSpec = size === 'sm' ? captionSpec : bodySpec

  function handlePress() {
    if (isDisabled) return
    dispatch(node.action)
  }

  const iconColor = variantStyle.textColor

  const hasIcon = !!node.icon

  return (
    <Pressable
      onPress={handlePress}
      style={({pressed}) => ({
        minHeight,
        borderRadius: theme.radii['radius-md'],
        backgroundColor: pressed && !isDisabled
          ? variantStyle.pressedBg ?? variantStyle.bg
          : variantStyle.bg,
        borderWidth: variantStyle.borderWidth ?? 0,
        borderColor: variantStyle.borderColor,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: theme.spacing['space-md'],
        paddingVertical: theme.spacing['space-sm'],
        opacity: isDisabled ? 0.5 : (pressed ? 0.9 : 1),
        alignSelf: node.fullWidth ? 'stretch' : 'flex-start',
      })}
      accessibilityRole="button"
      accessibilityLabel={node.accessibilityLabel ?? node.label}
      accessibilityState={{disabled: isDisabled}}
      disabled={isDisabled}
    >
      {/* Leading icon */}
      {hasIcon && iconPosition === 'leading' ? (
        <View style={{marginRight: theme.spacing['space-xs']}}>
          <Icon
            name={node.icon!}
            size={iconSize}
            color={iconColor}
          />
        </View>
      ) : null}

      {/* Label */}
      <Text
        style={{
          fontSize: textSpec.size,
          lineHeight: textSpec.lineHeight,
          fontWeight: '600',
          letterSpacing: textSpec.letterSpacing,
          color: variantStyle.textColor,
        }}
        numberOfLines={1}
        allowFontScaling
      >
        {node.label}
      </Text>

      {/* Trailing icon */}
      {hasIcon && iconPosition === 'trailing' ? (
        <View style={{marginLeft: theme.spacing['space-xs']}}>
          <Icon
            name={node.icon!}
            size={iconSize}
            color={iconColor}
          />
        </View>
      ) : null}
    </Pressable>
  )
}

// ---------------------------------------------------------------------------
// resolveVariantStyle — maps variant name to concrete colors from the theme.
// ---------------------------------------------------------------------------

type VariantStyle = {
  bg: string
  pressedBg?: string
  textColor: string
  borderWidth?: number
  borderColor?: string
}

function resolveVariantStyle(
  variant: ButtonNode['variant'],
  theme: ReturnType<typeof useTheme>,
): VariantStyle {
  switch (variant) {
    case 'primary':
    default:
      return {
        bg: theme.accent,
        pressedBg: theme.accent, // darken overlay applied via opacity
        textColor: theme['accent-fg'],
      }
    case 'secondary':
      return {
        bg: theme['bg-elevated'],
        pressedBg: theme['bg-elevated'],
        textColor: theme.fg,
        borderWidth: 1,
        borderColor: theme.divider,
      }
    case 'destructive':
      return {
        bg: theme.danger,
        textColor: '#FFFFFF',
      }
    case 'text':
      return {
        bg: 'transparent',
        pressedBg: 'transparent',
        textColor: theme.accent,
      }
  }
}
