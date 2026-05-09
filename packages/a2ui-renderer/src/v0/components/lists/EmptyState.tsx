/**
 * EmptyStateRenderer — centered empty state for lists with zero rows.
 *
 * Visual (per canvas-v0-ux.md §Lists tier § EmptyState):
 *   - 48pt icon in fg-muted, centered in 88pt radius-full circle on bg-tinted background
 *   - space-lg below the circle
 *   - headline: type-h2, fg
 *   - body (optional): type-body, fg-muted
 *   - action button (optional): full-width Button (secondary variant — Step 9 owns Button;
 *     here we render a Pressable to avoid a forward-reference into the actions tier)
 *
 * Accessibility:
 *   - headline: accessibilityRole="header"
 *   - action: accessibilityRole="button", accessibilityHint = actionLabel
 *   - reduced motion: no animation changes (EmptyState is static)
 *
 * T-0006-113: snapshot at productive×focus
 * T-0006-114: snapshot at expressive×health
 * T-0006-122: renders when collection has zero rows (tested in List.test.tsx)
 */
import React from 'react'
import {Pressable, Text, View} from 'react-native'
import type {Node} from '@app-creator/protocol'
import {Icon} from '@app-creator/design-system'
import {useTheme, useStance} from '../../theme/RendererThemeProvider.js'
import {useRendererStateContext} from '../../state/useRendererState.js'
import {LIST_DEFAULTS} from './defaults.js'

type EmptyStateNode = Extract<Node, {type: 'EmptyState'}>

export function EmptyStateRenderer({node}: {node: EmptyStateNode}) {
  const theme = useTheme()
  const stance = useStance()
  const defaults = LIST_DEFAULTS[stance]
  const {dispatch} = useRendererStateContext()
  const h2Spec = theme.type.h2
  const bodySpec = theme.type.body
  const captionSpec = theme.type.caption

  function handleAction() {
    if (node.action) {
      dispatch(node.action)
    }
  }

  return (
    <View
      style={{
        alignItems: 'center',
        paddingHorizontal: theme.spacing['space-lg'],
        paddingVertical: theme.spacing['space-xl'],
      }}
      accessibilityLabel={node.accessibilityLabel ?? node.headline}
    >
      {/* Icon circle */}
      <View
        style={{
          width: defaults.emptyCircleSize,
          height: defaults.emptyCircleSize,
          borderRadius: defaults.emptyCircleSize / 2,
          backgroundColor: theme.bg,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: theme.spacing['space-lg'],
        }}
      >
        <Icon
          name={node.icon}
          size={defaults.emptyIconSize as 32 | 16 | 20 | 24}
          color={theme['fg-muted']}
        />
      </View>

      {/* Headline */}
      <Text
        style={{
          fontSize: h2Spec.size,
          lineHeight: h2Spec.lineHeight,
          fontWeight: '600',
          letterSpacing: h2Spec.letterSpacing,
          color: theme.fg,
          textAlign: 'center',
          marginBottom: node.body ? theme.spacing['space-sm'] : 0,
        }}
        accessibilityRole="header"
      >
        {node.headline}
      </Text>

      {/* Body (optional) */}
      {node.body ? (
        <Text
          style={{
            fontSize: bodySpec.size,
            lineHeight: bodySpec.lineHeight,
            color: theme['fg-muted'],
            textAlign: 'center',
            marginBottom: node.actionLabel ? theme.spacing['space-lg'] : 0,
          }}
        >
          {node.body}
        </Text>
      ) : null}

      {/* Action button (optional) — secondary-style full-width Pressable */}
      {node.actionLabel && node.action ? (
        <Pressable
          onPress={handleAction}
          style={({pressed}) => ({
            width: '100%',
            minHeight: 44,
            backgroundColor: pressed ? theme['bg-elevated'] : theme['bg-elevated'],
            borderRadius: theme.radii['radius-md'],
            borderWidth: 1,
            borderColor: theme.divider,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: theme.spacing['space-md'],
            paddingVertical: theme.spacing['space-sm'],
            opacity: pressed ? 0.8 : 1,
          })}
          accessibilityRole="button"
          accessibilityLabel={node.actionLabel}
          accessibilityHint={node.actionLabel}
        >
          <Text
            style={{
              fontSize: captionSpec.size,
              lineHeight: captionSpec.lineHeight,
              fontWeight: '500',
              color: theme.fg,
            }}
          >
            {node.actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}
