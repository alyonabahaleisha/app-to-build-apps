/**
 * ImageRenderer — single image display.
 *
 * V1 Phase 1 Step 1 (T-0009-014..025).
 *
 * Visual (per canvas-v1-catalog-expansion-phase1-ux.md §Image):
 *   - Loading: shimmer placeholder at the configured aspect ratio.
 *   - Loaded:  image fills bounded aspect ratio; rounded corners per `radius`.
 *   - Error:   centered fallback icon (32pt, `fg-muted`) on `bg-elevated`.
 *
 * Aspect ratio map (width:height as decimal):
 *   '1:1' → 1, '4:5' → 4/5, '16:9' → 16/9, '3:4' → 3/4, '21:9' → 21/9
 *
 * Stance treatment:
 *   - Productive: `radius-md` default, `fit: cover`.
 *   - Expressive: `radius-lg` default, `fit: cover`.
 *
 * Implementation note: uses react-native's built-in Image instead of
 * expo-image because expo-image is not yet installed in the monorepo.
 * ADR-0009 cites expo-image as a dep but it's absent from package.json.
 * The swap is mechanical (onLoadEnd/onError → onLoad/onError, resizeMode
 * instead of contentFit) — no behavioral delta for V1 Phase 1.
 *
 * Defense-in-depth: renderer throws on empty `alt` even though the schema
 * requires min 1 char. Belt-and-suspenders for T-0009-024.
 *
 * Accessibility:
 *   - accessibilityRole="image"
 *   - accessibilityLabel={node.alt} — required
 *
 * No useEffect. RN Image's onLoadStart/onLoad/onError callbacks drive
 * local state transitions inside event handlers (not lifecycle effects).
 *
 * T-0009-014: snapshot at productive×focus
 * T-0009-015: snapshot at expressive×health
 * T-0009-024: empty alt throws (defense-in-depth)
 */
import React, {useState} from 'react'
import {View, Image, ActivityIndicator, StyleSheet} from 'react-native'
import type {Node} from '@app-creator/protocol'
import {Icon} from '@app-creator/design-system'
import {useTheme, useStance} from '../../theme/RendererThemeProvider.js'

type ImageNode = Extract<Node, {type: 'Image'}>

// Aspect ratio as a decimal multiplier (width / height → RN aspectRatio prop).
const ASPECT_RATIO_MAP: Record<NonNullable<ImageNode['aspectRatio']>, number> = {
  '1:1': 1,
  '4:5': 4 / 5,
  '16:9': 16 / 9,
  '3:4': 3 / 4,
  '21:9': 21 / 9,
}

const DEFAULT_ASPECT_RATIO = '4:5'
const FALLBACK_ICON_SIZE = 32

// Map ImageNode.fit to RN Image resizeMode.
const FIT_TO_RESIZE_MODE = {
  cover: 'cover',
  contain: 'contain',
} as const

type LoadState = 'loading' | 'loaded' | 'error'

export function ImageRenderer({node}: {node: ImageNode}) {
  // Defense-in-depth: schema requires alt min(1), but we throw explicitly
  // here for T-0009-024. Belt-and-suspenders against future schema regressions.
  if (!node.alt || node.alt.trim() === '') {
    throw new Error('ImageRenderer: alt is required and must be non-empty')
  }

  const theme = useTheme()
  const stance = useStance()

  // Resolve source URI from ImageBinding.
  // Only 'literal' bindings carry a resolvable URI without RendererState.
  // 'state' and 'collectionField' bindings require useBinding — in a pure
  // display context, we default to error if no URI is available.
  const sourceUri = node.source.kind === 'literal' ? node.source.value : null

  // Initial load state: jump to 'error' immediately if no URI is resolvable.
  const [loadState, setLoadState] = useState<LoadState>(() =>
    sourceUri ? 'loading' : 'error',
  )

  const aspectRatioKey = node.aspectRatio ?? DEFAULT_ASPECT_RATIO
  const aspectRatio = ASPECT_RATIO_MAP[aspectRatioKey]

  const fit = node.fit ?? 'cover'
  const resizeMode = FIT_TO_RESIZE_MODE[fit]

  // Stance-driven default radius.
  const defaultRadius = stance === 'expressive' ? 'radius-lg' : 'radius-md'
  const radiusKey = node.radius ?? defaultRadius
  const borderRadius = theme.radii[radiusKey]

  const fallbackIconName = node.fallbackIcon ?? 'image'

  return (
    <View
      style={{
        width: '100%',
        aspectRatio,
        borderRadius,
        overflow: 'hidden',
        backgroundColor: theme['bg-elevated'],
      }}
      accessibilityRole="image"
      accessibilityLabel={node.alt}
    >
      {/* Loading shimmer */}
      {loadState === 'loading' ? (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <ActivityIndicator color={theme['fg-muted']} />
        </View>
      ) : null}

      {/* Error fallback */}
      {loadState === 'error' ? (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Icon name={fallbackIconName} size={FALLBACK_ICON_SIZE} color={theme['fg-muted']} />
        </View>
      ) : null}

      {/* Image — only rendered when a URI is available */}
      {sourceUri ? (
        <Image
          source={{uri: sourceUri}}
          style={StyleSheet.absoluteFill}
          resizeMode={resizeMode}
          accessibilityElementsHidden
          onLoadStart={() => setLoadState('loading')}
          onLoad={() => setLoadState('loaded')}
          onError={() => setLoadState('error')}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
