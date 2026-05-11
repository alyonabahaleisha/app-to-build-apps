/**
 * ErrorStateRenderer — centered error display with optional retry CTA.
 *
 * V1 Phase 1 Step 4 — Lists & Data tier expansion.
 *
 * Structural twin of EmptyStateRenderer. Differences:
 *   - Default icon: 'alert-triangle' in warning color (EmptyState uses accent)
 *   - accessibilityRole="alert" on the container (announces immediately to VoiceOver)
 *
 * Visual (per canvas-v1-catalog-expansion-phase1-ux.md §ErrorState):
 *   - 48pt icon in warning color, centered in 88pt circle on bg-elevated
 *   - space-lg below circle
 *   - headline: type-h2, fg
 *   - body (optional): type-body, fg-muted
 *   - action button (optional): full-width secondary Pressable
 *
 * Accessibility:
 *   - Container: accessibilityRole="alert" (T-0009-102)
 *   - headline: accessibilityRole="header"
 *   - action: accessibilityRole="button"
 *
 * Stance: stance-neutral (same visual in productive and expressive)
 *
 * T-0009-102: accessibilityRole="alert" present
 * T-0009-103: action renders retry button
 * T-0009-104: default icon is 'alert-triangle' in warning color
 * T-0009-108: snapshots at productive×focus + expressive×health
 */
import React from 'react'
import {Pressable, Text, View} from 'react-native'
import type {Node} from '@app-creator/protocol'
import {Icon} from '@app-creator/design-system'
import {useTheme} from '../../theme/RendererThemeProvider.js'
import {useRendererStateContext} from '../../state/useRendererState.js'

type ErrorStateNode = Extract<Node, {type: 'ErrorState'}>

const DEFAULT_ICON = 'alert-triangle' as const
// Icon component accepts 16|20|24|32 — use 32 as closest to the UX-doc 48pt spec.
// The 88pt circle provides visual weight; the actual glyph renders at 32pt.
const ICON_SIZE = 32 as const
const CIRCLE_SIZE = 88

export function ErrorStateRenderer({node}: {node: ErrorStateNode}) {
  const theme = useTheme()
  const {dispatch} = useRendererStateContext()
  const h2Spec = theme.type.h2
  const bodySpec = theme.type.body
  const captionSpec = theme.type.caption

  const iconName = node.icon ?? DEFAULT_ICON

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
      accessibilityRole="alert"
      accessibilityLabel={
        node.accessibilityLabel ??
        [node.headline, node.body, node.actionLabel].filter(Boolean).join('. ')
      }
    >
      {/* Icon circle — warning tone distinguishes ErrorState from EmptyState */}
      <View
        style={{
          width: CIRCLE_SIZE,
          height: CIRCLE_SIZE,
          borderRadius: CIRCLE_SIZE / 2,
          backgroundColor: theme['bg-elevated'],
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: theme.spacing['space-lg'],
        }}
      >
        <Icon
          name={iconName}
          size={ICON_SIZE}
          color={theme.warning}
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
            backgroundColor: theme['bg-elevated'],
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
