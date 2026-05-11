/**
 * TransactionRowRenderer — single-line financial transaction display.
 *
 * V1 Phase 1 Step 5 (T-0009-111..115, T-0009-129, T-0009-134).
 *
 * Visual (per ADR-0009 Step 5):
 *   - Two-line layout: merchant (body, fg) + date (caption, fg-muted) on left.
 *   - Formatted amount on right.
 *   - Positive amount → success color (inflow).
 *   - Negative amount → fg (NOT danger — explicit ADR-0009 AC item 2).
 *   - Optional categoryIcon in 32pt circle with subtle accent-tint background.
 *
 * Amount formatting:
 *   Intl.NumberFormat('en-US', {style: 'currency', currency}) — T-0009-114.
 *   Currency defaults to 'USD' when not specified (matches MoneyField pattern).
 *
 * Accessibility:
 *   accessibilityRole="text" on root; accessibilityLabel combines merchant,
 *   amount, and date for a single VoiceOver read.
 *
 * T-0009-112: positive amount → success color
 * T-0009-113: negative amount → fg (NOT danger)
 * T-0009-114: amount formatted via Intl.NumberFormat
 * T-0009-115: categoryIcon renders in 32pt circle
 * T-0009-129: snapshots at productive×focus + expressive×health
 */
import React from 'react'
import {View, Text} from 'react-native'
import type {Node} from '@app-creator/protocol'
import {Icon} from '@app-creator/design-system'
import {useTheme} from '../../theme/RendererThemeProvider.js'

type TransactionRowNode = Extract<Node, {type: 'TransactionRow'}>

// Icon circle diameter per ADR-0009 Step 5 AC (T-0009-115).
const ICON_CIRCLE_SIZE = 32
const ICON_SIZE = 16

// Resolve the literal value from a NumberBinding.
// Only 'literal' bindings can be resolved without RendererState.
// 'state' and 'collectionField' bindings return null (renders as 0).
function resolveAmount(
  amount: TransactionRowNode['amount'],
): number | null {
  if (amount.kind === 'literal') return amount.value
  return null
}

// Format amount (in cents) as currency string.
// Positive = inflow (+), negative = outflow (−).
// Intl.NumberFormat('en-US', {style: 'currency', currency}) per T-0009-114.
function formatAmount(cents: number, currency: string): string {
  const dollars = cents / 100
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(dollars)
  } catch {
    // Fallback for unsupported or invalid currency codes.
    return `${currency} ${dollars.toFixed(2)}`
  }
}

export function TransactionRowRenderer({node}: {node: TransactionRowNode}) {
  const theme = useTheme()

  const currency = node.currency ?? 'USD'
  const rawAmount = resolveAmount(node.amount)
  const cents = rawAmount ?? 0
  const isPositive = cents >= 0

  // T-0009-112: positive → success. T-0009-113: negative → fg (NOT danger).
  const amountColor = isPositive ? theme.success : theme.fg

  const formattedAmount = formatAmount(cents, currency)

  const bodySpec = theme.type.body
  const captionSpec = theme.type.caption

  const a11yLabel =
    node.accessibilityLabel ??
    `${node.merchant}, ${formattedAmount}, ${node.date}`

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={a11yLabel}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: theme.spacing['space-sm'],
        paddingHorizontal: theme.spacing['space-md'],
      }}
    >
      {/* Optional category icon in 32pt circle */}
      {node.categoryIcon ? (
        <View
          style={{
            width: ICON_CIRCLE_SIZE,
            height: ICON_CIRCLE_SIZE,
            borderRadius: ICON_CIRCLE_SIZE / 2,
            backgroundColor: theme.accent + '1A', // ~10% tint
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: theme.spacing['space-sm'],
          }}
          accessibilityElementsHidden
        >
          <Icon
            name={node.categoryIcon}
            size={ICON_SIZE}
            color={theme.accent}
          />
        </View>
      ) : null}

      {/* Left column: merchant + date */}
      <View style={{flex: 1}}>
        <Text
          style={{
            fontSize: bodySpec.size,
            lineHeight: bodySpec.lineHeight,
            fontWeight: String(bodySpec.weight) as '400',
            color: theme.fg,
          }}
          numberOfLines={1}
          accessibilityElementsHidden
        >
          {node.merchant}
        </Text>
        <Text
          style={{
            fontSize: captionSpec.size,
            lineHeight: captionSpec.lineHeight,
            fontWeight: String(captionSpec.weight) as '400',
            color: theme['fg-muted'],
          }}
          numberOfLines={1}
          accessibilityElementsHidden
        >
          {node.date}
        </Text>
      </View>

      {/* Right: formatted amount */}
      <Text
        style={{
          fontSize: bodySpec.size,
          lineHeight: bodySpec.lineHeight,
          fontWeight: String(bodySpec.weight) as '400',
          color: amountColor,
          marginLeft: theme.spacing['space-sm'],
        }}
        accessibilityElementsHidden
      >
        {formattedAmount}
      </Text>
    </View>
  )
}
