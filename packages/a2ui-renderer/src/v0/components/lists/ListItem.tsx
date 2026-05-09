/**
 * ListItemRenderer — a single row within a List.
 *
 * Visual (per canvas-v0-ux.md §Lists tier §ListItem):
 *   - Height: compact 44pt, standard 56pt (default), expanded 80pt
 *   - Horizontal padding: space-md
 *   - Bottom border: 1pt divider (productive) / space-sm gap (expressive)
 *   - Leading slot: none | icon | avatar | badge — rendered left of title
 *   - Title: type-body, fg
 *   - Subtitle (optional): type-caption, fg-muted
 *   - Trailing slot: none | icon | avatar | badge — rendered right of content
 *   - tapAction: dispatches action, press state: 100ms 92% opacity, light haptic (haptic via middleware)
 *
 * Slot rendering:
 *   - 'none': no element
 *   - 'icon': <Icon name={slot.name} size={20} color={theme.fg} />
 *   - 'avatar': inline Avatar circle (32pt) with fallback initials
 *   - 'badge': inline Badge pill
 *
 * Accessibility:
 *   - accessibilityRole="button" if tapAction is present, "text" otherwise
 *   - accessibilityLabel: node.accessibilityLabel ?? title (subtitle appended)
 *   - Minimum 44pt touch target
 *
 * T-0006-111: snapshot at productive×focus
 * T-0006-112: snapshot at expressive×health
 * T-0006-119: leading/trailing slot kinds render correctly
 */
import React from 'react'
import {Pressable, Text, View} from 'react-native'
import type {Node} from '@app-creator/protocol'
import {Icon} from '@app-creator/design-system'
import {useTheme, useStance} from '../../theme/RendererThemeProvider.js'
import {useRendererStateContext} from '../../state/useRendererState.js'
import {ITEM_LAYOUT_HEIGHT} from './defaults.js'
import type {Slot} from '@app-creator/protocol'

type ListItemNode = Extract<Node, {type: 'ListItem'}>

// -- Slot sub-components ------------------------------------------------------

function SlotIcon({name, color}: {name: string; color: string}) {
  return <Icon name={name as Parameters<typeof Icon>[0]['name']} size={20} color={color} />
}

function SlotAvatar({node}: {node: {name: string; imageUrl?: string}}) {
  const theme = useTheme()
  const bodySpec = theme.type.body
  // Simple initials avatar — matches Avatar display-tier logic without importing it
  // (avoiding a cross-tier import; this is the slot inline variant).
  const initials = node.name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')
  return (
    <View
      style={{
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: theme.accent,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      accessibilityLabel={node.name}
    >
      <Text
        style={{
          fontSize: bodySpec.size * 0.7,
          fontWeight: '600',
          color: theme['accent-fg'],
        }}
      >
        {initials}
      </Text>
    </View>
  )
}

function SlotBadge({node}: {node: {text: string; tone?: string}}) {
  const theme = useTheme()
  const microSpec = theme.type.micro
  // Inline badge pill — matches Badge display-tier visual without importing it.
  const bgColor =
    node.tone === 'accent'
      ? theme.accent
      : node.tone === 'success'
        ? theme.success
        : node.tone === 'warning'
          ? theme.warning
          : node.tone === 'danger'
            ? theme.danger
            : theme['bg-elevated']
  const textColor = node.tone === 'accent' ? theme['accent-fg'] : theme.fg

  return (
    <View
      style={{
        backgroundColor: bgColor,
        borderRadius: theme.radii['radius-full'],
        paddingHorizontal: theme.spacing['space-sm'],
        paddingVertical: 2,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontSize: microSpec.size,
          fontWeight: '600',
          color: textColor,
        }}
      >
        {node.text}
      </Text>
    </View>
  )
}

function SlotRenderer({slot, color}: {slot: Slot; color: string}) {
  switch (slot.kind) {
    case 'none':
      return null
    case 'icon':
      return <SlotIcon name={slot.name} color={color} />
    case 'avatar':
      return <SlotAvatar node={slot.node} />
    case 'badge':
      return <SlotBadge node={slot.node} />
    default: {
      // TypeScript exhaustiveness — should never reach here.
      return null
    }
  }
}

// -- Main component -----------------------------------------------------------

export function ListItemRenderer({
  node,
  itemLayout = 'standard',
  hideBottomBorder = false,
}: {
  node: ListItemNode
  itemLayout?: 'compact' | 'standard' | 'expanded'
  hideBottomBorder?: boolean
}) {
  const theme = useTheme()
  const stance = useStance()
  const {dispatch} = useRendererStateContext()
  const rowHeight = ITEM_LAYOUT_HEIGHT[itemLayout]
  const bodySpec = theme.type.body
  const captionSpec = theme.type.caption

  const isInteractive = node.tapAction != null
  const a11yLabel = node.accessibilityLabel ?? [node.title, node.subtitle].filter(Boolean).join(', ')
  const bottomBorderStyle = stance === 'productive' && !hideBottomBorder
    ? {borderBottomWidth: 1, borderBottomColor: theme.divider}
    : stance === 'expressive' && !hideBottomBorder
      ? {marginBottom: theme.spacing['space-sm']}
      : {}

  function handlePress() {
    if (node.tapAction) {
      dispatch(node.tapAction)
    }
  }

  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: rowHeight,
        paddingHorizontal: theme.spacing['space-md'],
        paddingVertical: theme.spacing['space-sm'],
        ...bottomBorderStyle,
      }}
    >
      {/* Leading slot */}
      {node.leading && node.leading.kind !== 'none' ? (
        <View style={{marginRight: theme.spacing['space-sm']}}>
          <SlotRenderer slot={node.leading} color={theme.fg} />
        </View>
      ) : null}

      {/* Content */}
      <View style={{flex: 1}}>
        <Text
          style={{
            fontSize: bodySpec.size,
            lineHeight: bodySpec.lineHeight,
            color: theme.fg,
          }}
          numberOfLines={1}
        >
          {node.title}
        </Text>
        {node.subtitle ? (
          <Text
            style={{
              fontSize: captionSpec.size,
              lineHeight: captionSpec.lineHeight,
              color: theme['fg-muted'],
            }}
            numberOfLines={1}
          >
            {node.subtitle}
          </Text>
        ) : null}
      </View>

      {/* Trailing slot */}
      {node.trailing && node.trailing.kind !== 'none' ? (
        <View style={{marginLeft: theme.spacing['space-sm']}}>
          <SlotRenderer slot={node.trailing} color={theme['fg-muted']} />
        </View>
      ) : null}
    </View>
  )

  if (isInteractive) {
    return (
      <Pressable
        onPress={handlePress}
        style={({pressed}) => ({opacity: pressed ? 0.92 : 1})}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
      >
        {content}
      </Pressable>
    )
  }

  return (
    <View
      accessibilityLabel={a11yLabel}
    >
      {content}
    </View>
  )
}
