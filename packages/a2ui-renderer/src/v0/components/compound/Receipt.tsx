/**
 * ReceiptRenderer — itemized receipt with dotted-leader rendering.
 *
 * V1 Phase 1 Step 5 (T-0009-116..120, T-0009-130, T-0009-135, T-0009-237).
 *
 * Visual (per ADR-0009 Step 5):
 *   - Each item: label … amount (dotted leader in between).
 *   - iOS borderStyle: 'dotted' is unreliable (Sable UX note) — renderer
 *     falls back to repeated '.' characters between label and amount (T-0009-135).
 *   - Footer: subtotal, optional tax, optional tip, total (with a hairline separator).
 *
 * Amount formatting:
 *   Intl.NumberFormat('en-US', {style: 'currency', currency}).
 *   Currency defaults to 'USD' when not specified.
 *
 * Math validation (receipt_total_mismatch warning):
 *   The cross-ref validator in Step 8 emits the warning when
 *   |subtotal + tax + tip − total| > 1 cent. Step 5 renders the data
 *   as-is without validation (T-0009-118/119/120/237 are wired via
 *   validateCrossRefs in Step 8). This renderer is display-only.
 *
 * Accessibility:
 *   accessibilityRole="text" on root wrapper.
 *
 * T-0009-118: clean math (subtotal + tax + tip === total)
 * T-0009-119: 1 cent tolerance (within ±1 cent is clean)
 * T-0009-120: 5 cent mismatch → receipt_total_mismatch warning (Step 8)
 * T-0009-130: snapshots at productive×focus + expressive×health
 * T-0009-135: dotted-leader via repeated '.' characters
 * T-0009-237: no tax/no tip — subtotal === total is clean
 */
import React from 'react'
import {View, Text} from 'react-native'
import type {Node} from '@app-creator/protocol'
import {useTheme} from '../../theme/RendererThemeProvider.js'

type ReceiptNode = Extract<Node, {type: 'Receipt'}>
type ReceiptItem = ReceiptNode['items'][number]

// Number of dot characters for the dotted leader.
// Fixed-width approach: renders a repeated dot string as a flex-spacer.
// T-0009-135: iOS borderStyle: 'dotted' is unreliable — use '.' chars.
const LEADER_DOTS = '...................................................................'

// Resolve NumberBinding to a numeric value.
// Only 'literal' bindings can be resolved without RendererState.
function resolveNumber(
  binding: ReceiptNode['subtotal'],
): number | null {
  if (binding.kind === 'literal') return binding.value
  return null
}

// Format cents as currency string.
function formatAmount(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(cents / 100)
  } catch {
    return `${currency} ${(cents / 100).toFixed(2)}`
  }
}

function ReceiptItemRow({
  item,
  currency,
  theme,
}: {
  item: ReceiptItem
  currency: string
  theme: ReturnType<typeof useTheme>
}) {
  const captionSpec = theme.type.caption
  const amount = resolveNumber(item.amount) ?? 0
  const formattedAmount = formatAmount(amount, currency)
  const label = item.quantity ? `${item.label} ×${item.quantity}` : item.label

  return (
    <View
      style={{flexDirection: 'row', alignItems: 'baseline', marginBottom: 2}}
      accessibilityElementsHidden
    >
      <Text
        style={{
          fontSize: captionSpec.size,
          lineHeight: captionSpec.lineHeight,
          color: theme.fg,
          flexShrink: 1,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
      {/* Dotted leader — T-0009-135: repeated '.' chars (iOS 'dotted' borderStyle unreliable) */}
      <Text
        style={{
          fontSize: captionSpec.size,
          lineHeight: captionSpec.lineHeight,
          color: theme['fg-muted'],
          flex: 1,
          overflow: 'hidden',
          marginHorizontal: 2,
        }}
        numberOfLines={1}
      >
        {LEADER_DOTS}
      </Text>
      <Text
        style={{
          fontSize: captionSpec.size,
          lineHeight: captionSpec.lineHeight,
          color: theme.fg,
        }}
      >
        {formattedAmount}
      </Text>
    </View>
  )
}

function SummaryRow({
  label,
  value,
  currency,
  isTotal,
  theme,
}: {
  label: string
  value: number
  currency: string
  isTotal?: boolean
  theme: ReturnType<typeof useTheme>
}) {
  const captionSpec = theme.type.caption
  const bodySpec = theme.type.body
  const typeSpec = isTotal ? bodySpec : captionSpec

  return (
    <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: isTotal ? 4 : 2}}>
      <Text
        style={{
          fontSize: typeSpec.size,
          lineHeight: typeSpec.lineHeight,
          fontWeight: isTotal ? '600' : (String(typeSpec.weight) as '400'),
          color: isTotal ? theme.fg : theme['fg-muted'],
        }}
        accessibilityElementsHidden
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: typeSpec.size,
          lineHeight: typeSpec.lineHeight,
          fontWeight: isTotal ? '600' : (String(typeSpec.weight) as '400'),
          color: isTotal ? theme.fg : theme['fg-muted'],
        }}
        accessibilityElementsHidden
      >
        {formatAmount(value, currency)}
      </Text>
    </View>
  )
}

export function ReceiptRenderer({node}: {node: ReceiptNode}) {
  const theme = useTheme()

  const currency = node.currency ?? 'USD'
  const subtotal = resolveNumber(node.subtotal) ?? 0
  const tax = node.tax ? resolveNumber(node.tax) ?? 0 : null
  const tip = node.tip ? resolveNumber(node.tip) ?? 0 : null
  const total = resolveNumber(node.total) ?? 0

  const a11yLabel =
    node.accessibilityLabel ??
    `Receipt with ${node.items.length} item${node.items.length !== 1 ? 's' : ''}, total ${formatAmount(total, currency)}`

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={a11yLabel}
      style={{
        paddingHorizontal: theme.spacing['space-md'],
        paddingVertical: theme.spacing['space-sm'],
      }}
    >
      {/* Item rows */}
      {node.items.map((item, index) => (
        <ReceiptItemRow
          key={index}
          item={item}
          currency={currency}
          theme={theme}
        />
      ))}

      {/* Divider before footer */}
      <View
        style={{
          height: 1,
          backgroundColor: theme.divider,
          marginVertical: theme.spacing['space-xs'],
        }}
        accessibilityElementsHidden
      />

      {/* Footer: subtotal, optional tax, optional tip, total */}
      <SummaryRow label="Subtotal" value={subtotal} currency={currency} theme={theme} />
      {tax !== null ? (
        <SummaryRow label="Tax" value={tax} currency={currency} theme={theme} />
      ) : null}
      {tip !== null ? (
        <SummaryRow label="Tip" value={tip} currency={currency} theme={theme} />
      ) : null}

      {/* Total divider */}
      <View
        style={{
          height: 1,
          backgroundColor: theme.divider,
          marginVertical: theme.spacing['space-xs'],
        }}
        accessibilityElementsHidden
      />

      <SummaryRow label="Total" value={total} currency={currency} isTotal theme={theme} />
    </View>
  )
}
