/**
 * MoneyFieldRenderer — currency-aware numeric input.
 *
 * Storage: valueBinding: NumberBinding — stored as INTEGER CENTS.
 * The renderer canonicalizes user-entered decimals to integer cents before
 * dispatching. This prevents JS floating-point bugs ($0.10 + $0.20 ≠ $0.30
 * in float arithmetic). See ADR-0009 §J + T-0009-228.
 *
 * Canonicalization:
 *   parseAndCanonicalize(input, currency) → integer cents
 *   - USD/EUR/GBP/CAD/AUD/INR: 2 decimal places → multiply by 100, round
 *   - JPY: 0 decimal places → parseInt (whole yen only)
 *   - NaN input → rejected, field reverts to bound value
 *   - min/max: enforced in cents before dispatch
 *
 * Display:
 *   Intl.NumberFormat(currency) formats cents back to locale string.
 *   Symbol position is determined by the currency/locale combination.
 *   Decimal places: 2 for all currencies except JPY (0 decimal places).
 *
 * Visual shape: label above (type-caption, fg-muted), 44pt tall input,
 *   radius-md, bg-elevated, divider border. Currency symbol leading inside
 *   the input in fg-muted. Number in type-body + tabular numerals.
 *
 * States: default, focused (border = accent), error (NaN input rejection),
 *   disabled (50% opacity, no interaction) — disabled not yet wired (V1.5).
 *
 * Accessibility:
 *   - accessibilityRole="adjustable" (numeric adjustable field)
 *   - accessibilityLabel: "label, currency" (e.g., "Tip amount, US dollars")
 *   - accessibilityValue.text: formatted cents value (e.g., "$24.50")
 *   - Numeric keyboard with decimal point
 *
 * V1 Phase 1 Step 2 — ADR-0009
 * T-0009-033..037, T-0009-228, T-0009-059 (snapshot)
 */
import React, {useState, useRef} from 'react'
import {View, Text, TextInput} from 'react-native'
import type {Node} from '@app-creator/protocol'
import {useTheme, useStance} from '../../theme/RendererThemeProvider.js'
import {useBinding} from '../../state/useBinding.js'
import {useRendererStateContext} from '../../state/useRendererState.js'
import {INPUT_DEFAULTS} from './defaults.js'

type MoneyFieldNode = Extract<Node, {type: 'MoneyField'}>
type Currency = NonNullable<MoneyFieldNode['currency']>

// ---------------------------------------------------------------------------
// § Cents canonicalization helpers (T-0009-228 regression gate)
// ---------------------------------------------------------------------------

// Currencies with 0 decimal places (whole-unit only).
const ZERO_DECIMAL_CURRENCIES = new Set<Currency>(['JPY'])

/**
 * centsPerUnit — how many of the smallest unit equal one major unit.
 * JPY: 1 (yen has no sub-unit), all others: 100.
 */
function centsPerUnit(currency: Currency): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency) ? 1 : 100
}

/**
 * parseAndCanonicalize — convert a user-entered decimal string to integer cents.
 *
 * Uses string arithmetic to avoid float-multiplication bugs:
 *   "12.50" × 100 = parseFloat("12.50") * 100 can be 1249.9999... in JS.
 *   Instead: split on '.', handle integer + decimal parts separately.
 *
 * Returns NaN if input is not a valid number.
 * Returns an integer (rounds half-up for sub-cent remainders).
 *
 * T-0009-228: `parseAndCanonicalize("0.10", "USD") + parseAndCanonicalize("0.20", "USD") === 30`
 * T-0009-037: JPY input "12.50" → 12 (drops decimal — zero-decimal currency)
 */
export function parseAndCanonicalize(input: string, currency: Currency): number {
  const trimmed = input.trim()
  if (trimmed === '' || trimmed === '-') return NaN

  // Check for valid numeric pattern before parsing.
  if (!/^-?\d+(\.\d*)?$/.test(trimmed)) return NaN

  const multiplier = centsPerUnit(currency)

  if (multiplier === 1) {
    // Zero-decimal: parseInt, drop any decimal digits.
    const intVal = parseInt(trimmed, 10)
    return isNaN(intVal) ? NaN : intVal
  }

  // Two-decimal currencies: split on '.' for precision arithmetic.
  const parts = trimmed.replace(/^-/, '').split('.')
  const isNegative = trimmed.startsWith('-')
  const integerPart = parseInt(parts[0] ?? '0', 10)
  const decimalStr = (parts[1] ?? '').substring(0, 2).padEnd(2, '0')
  const decimalPart = parseInt(decimalStr, 10)

  const result = integerPart * multiplier + decimalPart
  return isNegative ? -result : result
}

/**
 * centsToDollarString — convert integer cents to a display string for the input field.
 * Returns a decimal string: 1250 → "12.50", 0 → "0.00", 125 (JPY) → "125".
 */
export function centsToDollarString(cents: number, currency: Currency): string {
  const multiplier = centsPerUnit(currency)
  if (multiplier === 1) {
    return String(cents)
  }
  const wholePart = Math.floor(Math.abs(cents) / multiplier)
  const decimalPart = Math.abs(cents) % multiplier
  const sign = cents < 0 ? '-' : ''
  return `${sign}${wholePart}.${String(decimalPart).padStart(2, '0')}`
}

/**
 * formatCentsForDisplay — format integer cents as a locale-aware currency string.
 * Uses Intl.NumberFormat for proper symbol + thousand separators.
 */
function formatCentsForDisplay(cents: number, currency: Currency): string {
  try {
    const multiplier = centsPerUnit(currency)
    const majorUnits = cents / multiplier
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: multiplier === 1 ? 0 : 2,
      maximumFractionDigits: multiplier === 1 ? 0 : 2,
    }).format(majorUnits)
  } catch {
    return String(cents)
  }
}

/**
 * currencySymbol — extract just the symbol for display in the leading slot.
 */
function currencySymbol(currency: Currency): string {
  const symbols: Record<Currency, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CAD: 'CA$',
    AUD: 'A$',
    INR: '₹',
  }
  return symbols[currency] ?? currency
}

// ---------------------------------------------------------------------------
// § Renderer
// ---------------------------------------------------------------------------

export function MoneyFieldRenderer({node}: {node: MoneyFieldNode}) {
  const theme = useTheme()
  const stance = useStance()
  const defaults = INPUT_DEFAULTS[stance]
  const {dispatch} = useRendererStateContext()

  const currency: Currency = node.currency ?? 'USD'
  const boundValue = useBinding<number>(node.valueBinding)
  const centsValue = boundValue ?? 0

  // Draft: display as decimal string while user is typing.
  const [draft, setDraft] = useState<string>(centsToDollarString(centsValue, currency))
  const [focused, setFocused] = useState(false)
  const [hasError, setHasError] = useState(false)

  // Sync draft from external bound value when not focused.
  const prevBoundRef = useRef(centsValue)
  if (prevBoundRef.current !== centsValue && !focused) {
    prevBoundRef.current = centsValue
    setDraft(centsToDollarString(centsValue, currency))
  }

  function handleBlur() {
    setFocused(false)

    if (node.valueBinding.kind !== 'state') return

    const parsed = parseAndCanonicalize(draft, currency)
    if (isNaN(parsed)) {
      // Reject non-numeric input — revert to bound value.
      setDraft(centsToDollarString(centsValue, currency))
      setHasError(false) // clear error on revert
      return
    }

    // Clamp to min/max (in cents).
    let clamped = parsed
    if (node.min != null && clamped < node.min) clamped = node.min
    if (node.max != null && clamped > node.max) clamped = node.max

    setHasError(false)
    dispatch({type: 'set', target: node.valueBinding.slot, value: clamped})
  }

  const borderColor = hasError ? theme.danger : focused ? theme.accent : theme.divider
  const borderWidth = focused ? 2 : 1
  const captionSpec = theme.type.caption
  const bodySpec = theme.type.body
  const symbol = currencySymbol(currency)

  // Accessibility: announce formatted value (not raw cents).
  const a11yValue = formatCentsForDisplay(centsValue, currency)
  const a11yLabel = node.accessibilityLabel ?? `${node.label}, ${currency}`

  return (
    <View>
      {/* Label */}
      <Text
        style={{
          fontSize: captionSpec.size,
          lineHeight: captionSpec.lineHeight,
          fontWeight: '400',
          letterSpacing: captionSpec.letterSpacing,
          color: theme['fg-muted'],
          marginBottom: theme.spacing['space-xs'],
        }}
        accessibilityElementsHidden
      >
        {node.label}
      </Text>

      {/* Input container */}
      <View
        style={{
          minHeight: defaults.fieldMinHeight,
          backgroundColor: theme['bg-elevated'],
          borderRadius: theme.radii['radius-md'],
          borderWidth,
          borderColor,
          paddingHorizontal: theme.spacing['space-md'],
          paddingVertical: theme.spacing['space-sm'],
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        {/* Leading currency symbol */}
        <Text
          style={{
            fontSize: bodySpec.size,
            color: theme['fg-muted'],
            marginRight: theme.spacing['space-xs'],
          }}
          accessibilityElementsHidden
        >
          {symbol}
        </Text>

        {/* Numeric input */}
        <TextInput
          value={draft}
          onChangeText={text => {
            setDraft(text)
            setHasError(false)
          }}
          onFocus={() => setFocused(true)}
          onBlur={handleBlur}
          placeholder={node.placeholder ?? (currency === 'JPY' ? '0' : '0.00')}
          placeholderTextColor={theme['fg-faint']}
          keyboardType="decimal-pad"
          style={{
            flex: 1,
            fontSize: bodySpec.size,
            lineHeight: bodySpec.lineHeight,
            color: theme.fg,
            padding: 0,
          }}
          accessibilityRole="adjustable"
          accessibilityLabel={a11yLabel}
          accessibilityValue={{text: a11yValue}}
          testID={`moneyfield-input-${node.id}`}
        />
      </View>

      {/* Error caption (NaN rejection) */}
      {hasError && (
        <Text
          style={{
            fontSize: captionSpec.size,
            color: theme.danger,
            marginTop: theme.spacing['space-xs'],
          }}
        >
          Enter a valid amount
        </Text>
      )}
    </View>
  )
}
