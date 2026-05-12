/**
 * CommerceCardRenderer — product card with image, price, and CTA button.
 *
 * V1 Phase 1 Step 7 (T-0009-165..169, T-0009-182).
 *
 * Visual (per ADR-0009 Step 7):
 *   - Image clips to top of card: borderTopLeft/RightRadius on image container,
 *     overflow: 'hidden' on card container (T-0009-168).
 *   - Price formatted via Intl.NumberFormat('en-US', {style: 'currency', currency}).
 *     Cents → display: divide by 100 (T-0009-166).
 *   - priceCompare renders with textDecorationLine: 'line-through' (T-0009-167).
 *   - badge renders top-right corner of image with accent tint (T-0009-169).
 *   - CTA button renders below image + text.
 *
 * Binding resolution:
 *   - image: ImageBinding — literal URI; state slot; collectionField.
 *   - price: NumberBinding — integer cents.
 *   - priceCompare: NumberBinding | undefined — integer cents.
 *
 * T-0009-165: CommerceCardSchema parses with required props
 * T-0009-166: price renders with currency formatting
 * T-0009-167: priceCompare renders strikethrough
 * T-0009-168: image clips via borderTopLeftRadius + overflow: 'hidden'
 * T-0009-169: badge renders top-right corner of image
 * T-0009-182: snapshots at productive×focus + expressive×health
 */
import React, {useState} from 'react'
import {View, Text, Pressable, Image, StyleSheet, ActivityIndicator} from 'react-native'
import type {Node} from '@app-creator/protocol'
import {Icon} from '@app-creator/design-system'
import {useTheme} from '../../theme/RendererThemeProvider.js'
import {useBinding} from '../../state/useBinding.js'
import {useRendererStateContext} from '../../state/useRendererState.js'
import type {ImageBinding, NumberBinding} from '../../state/types.js'

type CommerceCardNode = Extract<Node, {type: 'CommerceCard'}>

// Image aspect ratio for the card header image.
const CARD_IMAGE_ASPECT = 4 / 3
const FALLBACK_ICON_SIZE = 32

type LoadState = 'loading' | 'loaded' | 'error'

// Format integer cents to a display currency string.
// Example: formatPrice(1999, 'USD') → '$19.99'
// For zero-decimal currencies (JPY), do not divide by 100.
const ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'KRW', 'VND'])

function formatPrice(cents: number, currency: string): string {
  const amount = ZERO_DECIMAL_CURRENCIES.has(currency) ? cents : cents / 100
  try {
    return new Intl.NumberFormat('en-US', {style: 'currency', currency}).format(amount)
  } catch {
    // Fallback if currency code is unrecognized (shouldn't happen given schema enum)
    return `${currency} ${amount.toFixed(2)}`
  }
}

export function CommerceCardRenderer({node}: {node: CommerceCardNode}) {
  const theme = useTheme()
  const {dispatch} = useRendererStateContext()

  const currency = node.currency ?? 'USD'
  const ctaLabel = node.ctaLabel ?? 'Add'

  const imageUri = useBinding<string>(node.image as ImageBinding)
  const priceRaw = useBinding<number>(node.price as NumberBinding)
  // priceCompare is optional; fall back to a no-op literal binding when absent.
  const priceCompareSentinel = {kind: 'literal' as const, value: null as unknown as number}
  const priceCompareRaw = useBinding<number>(
    (node.priceCompare ?? priceCompareSentinel) as NumberBinding,
  )

  const [imageLoadState, setImageLoadState] = useState<LoadState>(() =>
    imageUri ? 'loading' : 'error',
  )

  // Re-resolve load state when imageUri changes.
  // This is a simplified approach; a full implementation would use useEffect.
  // For the renderer's pure-function contract, URI changes happen via dispatch
  // which remounts affected subtrees via key changes.

  const cardBorderRadius = theme.radii['radius-md']
  const bodySpec = theme.type.body
  const captionSpec = theme.type.caption

  const priceDisplay = priceRaw !== undefined ? formatPrice(priceRaw, currency) : null
  const priceCompareDisplay =
    node.priceCompare !== undefined && priceCompareRaw !== undefined && priceCompareRaw !== null
      ? formatPrice(priceCompareRaw, currency)
      : null

  function handleCTA() {
    if (node.ctaAction) {
      dispatch(node.ctaAction)
    }
  }

  return (
    <View
      style={{
        borderRadius: cardBorderRadius,
        overflow: 'hidden',
        backgroundColor: theme['bg-elevated'],
        borderWidth: 1,
        borderColor: theme.divider,
      }}
      accessibilityLabel={node.accessibilityLabel ?? node.title}
      testID={`commerce-card-${node.id}`}
    >
      {/* Image header — clips to top of card via borderTop radii + overflow hidden (T-0009-168) */}
      <View
        style={{
          width: '100%',
          aspectRatio: CARD_IMAGE_ASPECT,
          backgroundColor: theme['bg-elevated'],
          borderTopLeftRadius: cardBorderRadius,
          borderTopRightRadius: cardBorderRadius,
          overflow: 'hidden',
        }}
      >
        {imageLoadState === 'loading' ? (
          <View style={[StyleSheet.absoluteFill, styles.center]}>
            <ActivityIndicator color={theme['fg-muted']} />
          </View>
        ) : null}

        {imageLoadState === 'error' ? (
          <View style={[StyleSheet.absoluteFill, styles.center]}>
            <Icon name="image" size={FALLBACK_ICON_SIZE} color={theme['fg-muted']} />
          </View>
        ) : null}

        {imageUri ? (
          <Image
            source={{uri: imageUri}}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            accessibilityRole="image"
            accessibilityLabel={node.title}
            onLoad={() => setImageLoadState('loaded')}
            onError={() => setImageLoadState('error')}
          />
        ) : null}

        {/* Badge — T-0009-169: top-right corner of image */}
        {node.badge ? (
          <View
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              backgroundColor: theme.accent,
              borderRadius: theme.radii['radius-full'],
              paddingHorizontal: 8,
              paddingVertical: 2,
            }}
            testID={`commerce-card-badge-${node.id}`}
          >
            <Text
              style={{
                fontSize: captionSpec.size,
                fontWeight: '600',
                color: theme['accent-fg'],
              }}
            >
              {node.badge}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Content area */}
      <View style={{padding: theme.spacing['space-md'], gap: theme.spacing['space-xs']}}>
        {/* Title */}
        <Text
          style={{
            fontSize: bodySpec.size,
            lineHeight: bodySpec.lineHeight,
            fontWeight: '600',
            color: theme.fg,
          }}
          numberOfLines={2}
          testID={`commerce-card-title-${node.id}`}
        >
          {node.title}
        </Text>

        {/* Price row */}
        <View style={{flexDirection: 'row', alignItems: 'center', gap: theme.spacing['space-xs']}}>
          {/* priceCompare — strikethrough (T-0009-167) */}
          {priceCompareDisplay ? (
            <Text
              style={{
                fontSize: captionSpec.size,
                lineHeight: captionSpec.lineHeight,
                color: theme['fg-muted'],
                textDecorationLine: 'line-through',
              }}
              testID={`commerce-card-price-compare-${node.id}`}
            >
              {priceCompareDisplay}
            </Text>
          ) : null}

          {/* Active price — T-0009-166 */}
          {priceDisplay ? (
            <Text
              style={{
                fontSize: bodySpec.size,
                lineHeight: bodySpec.lineHeight,
                fontWeight: '700',
                color: theme.fg,
              }}
              testID={`commerce-card-price-${node.id}`}
            >
              {priceDisplay}
            </Text>
          ) : null}
        </View>

        {/* CTA button */}
        <Pressable
          onPress={handleCTA}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
          testID={`commerce-card-cta-${node.id}`}
          style={({pressed}) => ({
            backgroundColor: pressed ? theme.accent + 'CC' : theme.accent,
            borderRadius: theme.radii['radius-md'],
            paddingVertical: theme.spacing['space-sm'],
            alignItems: 'center',
            marginTop: theme.spacing['space-xs'],
          })}
        >
          <Text
            style={{
              fontSize: bodySpec.size,
              fontWeight: '600',
              color: theme['accent-fg'],
            }}
          >
            {ctaLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
