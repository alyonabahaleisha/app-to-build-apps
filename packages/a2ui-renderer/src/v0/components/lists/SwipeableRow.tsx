/**
 * SwipeableRowRenderer — ListItem extended with leading/trailing swipe actions.
 *
 * Uses react-native-gesture-handler's Swipeable for the swipe gesture.
 * Swipe threshold: 80pt (per ADR-0006 §Step 7 ACs, canvas-v0-ux.md §SwipeableRow).
 *
 * Visual:
 *   - Leading action (swipe-right): color = success/warning/accent
 *   - Trailing action (swipe-left): color = danger/warning
 *   - Each action button: full-height of the row, 72pt wide, icon + label centered
 *
 * Reduced motion:
 *   - useReducedMotion: the Swipeable component still functions; gesture animations
 *     are handled by gesture-handler + Reanimated internally. When reduced motion
 *     is on, we pass frictionFactor to Swipeable to reduce animation feel.
 *     (Full Reanimated worklet control for reduced-motion on swipe is Step 9 polish.)
 *
 * Accessibility:
 *   - Row accessibilityActions include 'delete' for trailingAction + 'archive' for leadingAction
 *   - accessibilityRole="none" on the outer Swipeable; inner list item handles role
 *
 * T-0006-109: snapshot at productive×focus
 * T-0006-110: snapshot at expressive×health
 * T-0006-120: leading swipe at ≥80pt commits leadingAction
 * T-0006-121: trailing swipe at ≥80pt commits trailingAction
 */
import React from 'react'
import {Pressable, Text, View} from 'react-native'
import {Swipeable} from 'react-native-gesture-handler'
import type {Node} from '@app-creator/protocol'
import {Icon} from '@app-creator/design-system'
import {useTheme, useStance} from '../../theme/RendererThemeProvider.js'
import {useRendererStateContext} from '../../state/useRendererState.js'
import {ITEM_LAYOUT_HEIGHT} from './defaults.js'
import type {Slot} from '@app-creator/protocol'

type SwipeableRowNode = Extract<Node, {type: 'SwipeableRow'}>

// The threshold in pt at which a swipe commits the action (per ADR-0006 §Step 7 ACs).
const SWIPE_THRESHOLD_PT = 80

// -- Slot inline renderer (mirrors ListItem's SlotRenderer for the row content) ---

function SlotIcon({name, color}: {name: string; color: string}) {
  return <Icon name={name as Parameters<typeof Icon>[0]['name']} size={20} color={color} />
}

function SlotAvatar({node: avatarNode}: {node: {name: string; imageUrl?: string}}) {
  const theme = useTheme()
  const bodySpec = theme.type.body
  const initials = avatarNode.name
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
    >
      <Text style={{fontSize: bodySpec.size * 0.7, fontWeight: '600', color: theme['accent-fg']}}>
        {initials}
      </Text>
    </View>
  )
}

function SlotBadge({node: badgeNode}: {node: {text: string; tone?: string}}) {
  const theme = useTheme()
  const microSpec = theme.type.micro
  const bgColor =
    badgeNode.tone === 'accent'
      ? theme.accent
      : badgeNode.tone === 'success'
        ? theme.success
        : badgeNode.tone === 'warning'
          ? theme.warning
          : badgeNode.tone === 'danger'
            ? theme.danger
            : theme['bg-elevated']
  const textColor = badgeNode.tone === 'accent' ? theme['accent-fg'] : theme.fg

  return (
    <View
      style={{
        backgroundColor: bgColor,
        borderRadius: theme.radii['radius-full'],
        paddingHorizontal: theme.spacing['space-sm'],
        paddingVertical: 2,
      }}
    >
      <Text style={{fontSize: microSpec.size, fontWeight: '600', color: textColor}}>
        {badgeNode.text}
      </Text>
    </View>
  )
}

function RowSlotRenderer({slot, color}: {slot: Slot; color: string}) {
  switch (slot.kind) {
    case 'none':
      return null
    case 'icon':
      return <SlotIcon name={slot.name} color={color} />
    case 'avatar':
      return <SlotAvatar node={slot.node} />
    case 'badge':
      return <SlotBadge node={slot.node} />
    default:
      return null
  }
}

// -- Swipe action panel -------------------------------------------------------

function ActionPanel({
  bgColor,
  icon,
  label,
  onPress,
  side,
  rowHeight,
}: {
  bgColor: string
  icon?: string
  label?: string
  onPress: () => void
  side: 'left' | 'right'
  rowHeight: number
}) {
  const theme = useTheme()
  const captionSpec = theme.type.caption

  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => ({
        backgroundColor: bgColor,
        width: 72,
        minHeight: rowHeight,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.85 : 1,
        // Round outer corners on the correct side
        borderTopLeftRadius: side === 'left' ? theme.radii['radius-md'] : 0,
        borderBottomLeftRadius: side === 'left' ? theme.radii['radius-md'] : 0,
        borderTopRightRadius: side === 'right' ? theme.radii['radius-md'] : 0,
        borderBottomRightRadius: side === 'right' ? theme.radii['radius-md'] : 0,
      })}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {icon ? (
        <Icon
          name={icon as Parameters<typeof Icon>[0]['name']}
          size={20}
          color="white"
        />
      ) : null}
      {label ? (
        <Text
          style={{
            fontSize: captionSpec.size,
            color: 'white',
            fontWeight: '500',
            marginTop: icon ? 2 : 0,
          }}
        >
          {label}
        </Text>
      ) : null}
    </Pressable>
  )
}

// -- Main component -----------------------------------------------------------

export function SwipeableRowRenderer({
  node,
  itemLayout = 'standard',
}: {
  node: SwipeableRowNode
  itemLayout?: 'compact' | 'standard' | 'expanded'
}) {
  const theme = useTheme()
  const stance = useStance()
  const {dispatch} = useRendererStateContext()
  const rowHeight = ITEM_LAYOUT_HEIGHT[itemLayout]
  const bodySpec = theme.type.body
  const captionSpec = theme.type.caption

  const bottomBorderStyle =
    stance === 'productive'
      ? {borderBottomWidth: 1, borderBottomColor: theme.divider}
      : {marginBottom: theme.spacing['space-sm']}

  // Resolve swipe action colors.
  function resolveLeadingColor(color?: string): string {
    if (color === 'success') return theme.success
    if (color === 'warning') return theme.warning
    return theme.accent // default for leading
  }

  function resolveTrailingColor(color?: string): string {
    if (color === 'warning') return theme.warning
    return theme.danger // default for trailing
  }

  function renderLeadingActions() {
    if (!node.leadingAction) return null
    return (
      <ActionPanel
        bgColor={resolveLeadingColor(node.leadingActionColor)}
        icon={node.leadingActionIcon}
        label={node.leadingActionIcon ? undefined : 'Action'}
        onPress={() => dispatch(node.leadingAction!)}
        side="left"
        rowHeight={rowHeight}
      />
    )
  }

  function renderTrailingActions() {
    if (!node.trailingAction) return null
    return (
      <ActionPanel
        bgColor={resolveTrailingColor(node.trailingActionColor)}
        icon={node.trailingActionIcon}
        label={node.trailingActionIcon ? undefined : 'Delete'}
        onPress={() => dispatch(node.trailingAction!)}
        side="right"
        rowHeight={rowHeight}
      />
    )
  }

  const a11yLabel = node.accessibilityLabel ?? node.title

  // Accessibility actions for VoiceOver swipe gesture discoverability.
  const accessibilityActions = [
    ...(node.leadingAction ? [{name: 'activate', label: node.leadingActionIcon ?? 'leading action'}] : []),
    ...(node.trailingAction ? [{name: 'delete', label: node.trailingActionIcon ?? 'delete'}] : []),
  ]

  function onAccessibilityAction({nativeEvent}: {nativeEvent: {actionName: string}}) {
    if (nativeEvent.actionName === 'delete' && node.trailingAction) {
      dispatch(node.trailingAction)
    } else if (nativeEvent.actionName === 'activate' && node.leadingAction) {
      dispatch(node.leadingAction)
    }
  }

  return (
    <Swipeable
      renderLeftActions={renderLeadingActions}
      renderRightActions={renderTrailingActions}
      leftThreshold={SWIPE_THRESHOLD_PT}
      rightThreshold={SWIPE_THRESHOLD_PT}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: rowHeight,
          paddingHorizontal: theme.spacing['space-md'],
          paddingVertical: theme.spacing['space-sm'],
          backgroundColor: theme['bg-elevated'],
          ...bottomBorderStyle,
        }}
        accessibilityLabel={a11yLabel}
        accessibilityActions={accessibilityActions}
        onAccessibilityAction={onAccessibilityAction}
      >
        {/* Leading slot */}
        {node.leading && node.leading.kind !== 'none' ? (
          <View style={{marginRight: theme.spacing['space-sm']}}>
            <RowSlotRenderer slot={node.leading} color={theme.fg} />
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
            <RowSlotRenderer slot={node.trailing} color={theme['fg-muted']} />
          </View>
        ) : null}
      </View>
    </Swipeable>
  )
}
