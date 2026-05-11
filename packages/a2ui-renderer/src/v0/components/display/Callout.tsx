/**
 * CalloutRenderer — highlighted info block for tips, warnings, success confirmations.
 *
 * V1 Phase 1 Step 3 (T-0009-080..085, T-0009-087, T-0009-242).
 *
 * Visual (per canvas-v1-catalog-expansion-phase1-ux.md §Callout):
 *   - Card-shaped with left border in the variant's accent color.
 *   - Productive: hairline left border (1pt), tight padding (space-md).
 *   - Expressive: thicker left border (4pt), more padding (space-lg).
 *   - Leading: variant icon, 20pt, in variant's color.
 *   - Center: headline `type-body` + 600 weight; body `type-caption` `fg-muted`.
 *   - Trailing (if action): text button in variant's color.
 *
 * Variant defaults:
 *   info    → icon: 'info',            color: accent,   tint: accent 6%
 *   success → icon: 'check-circle',    color: success,  tint: success 6%
 *   warning → icon: 'alert-triangle',  color: warning,  tint: warning 6%
 *   tip     → icon: 'sparkles',        color: accent,   tint: bg-elevated (no tint)
 *   danger  → icon: 'x-circle',        color: danger,   tint: danger 6%
 *
 * Accessibility:
 *   - accessibilityRole="alert" for warning/danger.
 *   - accessibilityRole="text" for info/success/tip.
 *   - accessibilityLabel="{variant}: {headline}. {body}. {action.label}"
 *   - Action button: separate pressable, accessibilityRole="button".
 *
 * No useEffect — all state is derived from node props.
 *
 * T-0009-080: 5 variants render with correct icon defaults
 * T-0009-081: warning → accessibilityRole="alert"
 * T-0009-082: info → accessibilityRole="text"
 * T-0009-083: with action → renders trailing button
 * T-0009-084: tip → bg-elevated (no tint)
 * T-0009-085: info → accent tint at 6%
 * T-0009-087: snapshot at productive×focus + expressive×health
 * T-0009-242: danger → accessibilityRole="alert"
 */
import React from 'react'
import {View, Text, Pressable} from 'react-native'
import type {Node} from '@app-creator/protocol'
import {Icon} from '@app-creator/design-system'
import {tintColor} from '@app-creator/design-system'
import {useTheme, useStance} from '../../theme/RendererThemeProvider.js'
import {useRendererStateContext} from '../../state/useRendererState.js'

type CalloutNode = Extract<Node, {type: 'Callout'}>
type CalloutVariant = CalloutNode['variant']

// Default icon per variant.
const VARIANT_ICON: Record<NonNullable<CalloutVariant>, string> = {
  info: 'info',
  success: 'check-circle',
  warning: 'alert-triangle',
  tip: 'sparkles',
  danger: 'x-circle',
} as const

const ICON_SIZE = 20

export function CalloutRenderer({node}: {node: CalloutNode}) {
  const theme = useTheme()
  const stance = useStance()
  const {dispatch} = useRendererStateContext()

  const variant = node.variant ?? 'info'

  // Variant-resolved color and background tint.
  const {variantColor, bgTint} = resolveVariantColors(variant, theme)

  // Stance-driven border width and padding.
  const borderWidth = stance === 'expressive' ? 4 : 1
  const padding = theme.spacing[stance === 'expressive' ? 'space-lg' : 'space-md']

  const iconName = node.icon ?? VARIANT_ICON[variant]

  // Accessibility role: alert for warning/danger, text for others.
  const a11yRole = variant === 'warning' || variant === 'danger' ? 'alert' : 'text'

  // Auto-generate accessibilityLabel from node props.
  const labelParts = [
    `${variant}: ${node.headline}`,
    node.body ?? '',
    node.action ? node.action.label : '',
  ].filter(Boolean)
  const a11yLabel = node.accessibilityLabel ?? labelParts.join('. ')

  const bodySpec = theme.type.body
  const captionSpec = theme.type.caption

  function handleActionPress() {
    if (node.action) {
      dispatch(node.action.action)
    }
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding,
        backgroundColor: bgTint,
        borderRadius: theme.radii['radius-md'],
        borderLeftWidth: borderWidth,
        borderLeftColor: variantColor,
        overflow: 'hidden',
      }}
      accessibilityRole={a11yRole}
      accessibilityLabel={a11yLabel}
    >
      {/* Leading icon */}
      <View style={{marginRight: theme.spacing['space-sm'], paddingTop: 2}}>
        <Icon name={iconName as Parameters<typeof Icon>[0]['name']} size={ICON_SIZE} color={variantColor} />
      </View>

      {/* Content column */}
      <View style={{flex: 1}}>
        <Text
          style={{
            fontSize: bodySpec.size,
            lineHeight: bodySpec.lineHeight,
            fontWeight: '600',
            letterSpacing: bodySpec.letterSpacing,
            color: theme.fg,
          }}
          numberOfLines={2}
        >
          {node.headline}
        </Text>

        {node.body ? (
          <Text
            style={{
              fontSize: captionSpec.size,
              lineHeight: captionSpec.lineHeight,
              color: theme['fg-muted'],
              marginTop: theme.spacing['space-xs'],
            }}
          >
            {node.body}
          </Text>
        ) : null}
      </View>

      {/* Trailing action button */}
      {node.action ? (
        <Pressable
          onPress={handleActionPress}
          style={{marginLeft: theme.spacing['space-sm']}}
          accessibilityRole="button"
          accessibilityLabel={node.action.label}
        >
          <Text
            style={{
              fontSize: captionSpec.size,
              lineHeight: captionSpec.lineHeight,
              fontWeight: '600',
              color: variantColor,
            }}
          >
            {node.action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}

// ---------------------------------------------------------------------------
// resolveVariantColors — maps variant → concrete color + background tint.
// ---------------------------------------------------------------------------

type VariantColors = {
  variantColor: string
  bgTint: string
}

function resolveVariantColors(
  variant: NonNullable<CalloutVariant>,
  theme: ReturnType<typeof useTheme>,
): VariantColors {
  switch (variant) {
    case 'info':
      return {
        variantColor: theme.accent,
        bgTint: tintColor(theme.accent, 0.06),
      }
    case 'success':
      return {
        variantColor: theme.success,
        bgTint: tintColor(theme.success, 0.06),
      }
    case 'warning':
      return {
        variantColor: theme.warning,
        bgTint: tintColor(theme.warning, 0.06),
      }
    case 'tip':
      return {
        variantColor: theme.accent,
        bgTint: theme['bg-elevated'],
      }
    case 'danger':
      return {
        variantColor: theme.danger,
        bgTint: tintColor(theme.danger, 0.06),
      }
  }
}
