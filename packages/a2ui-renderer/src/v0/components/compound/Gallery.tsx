/**
 * GalleryRenderer — grid of images from a static array or a collection.
 *
 * V1 Phase 1 Step 7 (T-0009-158..164, T-0009-181, T-0009-238, T-0009-239).
 *
 * Visual (per ADR-0009 Step 7):
 *   - 2/3/4 column grid; defaults to 3.
 *   - aspectRatio: '1:1' or '4:5' per cell; defaults to '1:1'.
 *   - gap: design-system space token; defaults to 'space-xs'.
 *   - Cell tap opens fullscreen modal (RN Modal, presentationStyle="fullScreen").
 *   - Fullscreen modal close button uses IconButtonRenderer (icon: 'x').
 *
 * Data sources (mutually exclusive — schema superRefine enforces this):
 *   - collectionId + imageField: renders images from collection rows.
 *   - images array: renders ImageBindings directly.
 *
 * Empty state (T-0009-238):
 *   - "No photos yet" copy + image icon.
 *   - Applies to both static empty array and collection with 0 rows.
 *   - No emptyState prop — deliberate (ErrorState is the alternative).
 *
 * Null imageField per row (T-0009-239):
 *   - Rows whose imageField value is null/undefined render with fallback icon.
 *   - These cells do not crash the grid.
 *
 * Accessibility:
 *   - Grid container: accessibilityRole="list"
 *   - Each cell: accessibilityRole="button", accessibilityLabel describes position.
 *
 * T-0009-158: GallerySchema.parse({collectionId, imageField}) succeeds
 * T-0009-159: GallerySchema.parse({images: [...]}) succeeds
 * T-0009-160: both-set rejected
 * T-0009-161: neither-set rejected
 * T-0009-162: collectionId without imageField rejected at superRefine
 * T-0009-163: cell tap opens fullscreen modal
 * T-0009-164: modal close button uses IconButton (icon: 'x')
 * T-0009-181: snapshots at productive×focus + expressive×health
 * T-0009-238: empty-state renders "No photos yet" + image icon
 * T-0009-239: null imageField rows render fallback, don't crash
 */
import React, {useState} from 'react'
import {View, Text, Pressable, Modal, StyleSheet, Image, ActivityIndicator} from 'react-native'
import type {Node} from '@app-creator/protocol'
import {Icon} from '@app-creator/design-system'
import {useTheme} from '../../theme/RendererThemeProvider.js'
import {useRendererStateContext} from '../../state/useRendererState.js'

type GalleryNode = Extract<Node, {type: 'Gallery'}>

// Map gap token → numeric pixel value.
const GAP_MAP: Record<string, number> = {
  'space-none': 0,
  'space-xs': 4,
  'space-sm': 8,
  'space-md': 12,
  'space-lg': 20,
  'space-xl': 32,
}

const DEFAULT_GAP = 'space-xs'
const DEFAULT_COLUMNS = 3
const FALLBACK_ICON_SIZE = 24

// Aspect ratio as a decimal multiplier (width / height).
const ASPECT_RATIO_MAP: Record<string, number> = {
  '1:1': 1,
  '4:5': 4 / 5,
}

type LoadState = 'loading' | 'loaded' | 'error'

// Single image cell in the grid.
function GalleryCell({
  uri,
  aspectRatio,
  borderRadius,
  onPress,
  accessibilityLabel,
  theme,
}: {
  uri: string | null
  aspectRatio: number
  borderRadius: number
  onPress: () => void
  accessibilityLabel: string
  theme: ReturnType<typeof useTheme>
}) {
  const [loadState, setLoadState] = useState<LoadState>(() =>
    uri ? 'loading' : 'error',
  )

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={{flex: 1, aspectRatio, borderRadius, overflow: 'hidden', backgroundColor: theme['bg-elevated']}}
    >
      {loadState === 'loading' ? (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <ActivityIndicator color={theme['fg-muted']} />
        </View>
      ) : null}

      {loadState === 'error' ? (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Icon name="image" size={FALLBACK_ICON_SIZE} color={theme['fg-muted']} />
        </View>
      ) : null}

      {uri ? (
        <Image
          source={{uri}}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          accessibilityElementsHidden
          onLoad={() => setLoadState('loaded')}
          onError={() => setLoadState('error')}
        />
      ) : null}
    </Pressable>
  )
}

// Fullscreen modal showing a single image.
function FullscreenModal({
  uri,
  onClose,
  theme,
}: {
  uri: string | null
  onClose: () => void
  theme: ReturnType<typeof useTheme>
}) {
  return (
    <Modal
      visible={uri !== null}
      presentationStyle="fullScreen"
      animationType="fade"
      testID="gallery-fullscreen-modal"
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'black',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {uri ? (
          <Image
            source={{uri}}
            style={{width: '100%', height: '100%'}}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel="Full size photo"
          />
        ) : null}

        {/* Close button — IconButton per T-0009-164 */}
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close photo"
          testID="gallery-fullscreen-close"
          style={{
            position: 'absolute',
            top: 48,
            right: 16,
            width: 44,
            height: 44,
            borderRadius: theme.radii['radius-full'],
            backgroundColor: 'rgba(0,0,0,0.5)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="x" size={24} color="white" />
        </Pressable>
      </View>
    </Modal>
  )
}

export function GalleryRenderer({node}: {node: GalleryNode}) {
  const theme = useTheme()
  const {state} = useRendererStateContext()

  const [selectedUri, setSelectedUri] = useState<string | null>(null)

  const columns = node.columns ?? DEFAULT_COLUMNS
  const aspectRatio = ASPECT_RATIO_MAP[node.aspectRatio ?? '1:1'] ?? 1
  const gap = GAP_MAP[node.gap ?? DEFAULT_GAP] ?? 4
  const borderRadius = theme.radii['radius-sm']

  // Resolve image URI list from either images array or collection+imageField.
  const uris: (string | null)[] = []

  if (node.images !== undefined) {
    // Static images array
    for (const binding of node.images) {
      if (binding.kind === 'literal') {
        uris.push(binding.value)
      } else if (binding.kind === 'state') {
        const v = state.slots.get(binding.slot)
        uris.push(typeof v === 'string' ? v : null)
      } else {
        // collectionField — outside list context; push null (renders fallback icon)
        uris.push(null)
      }
    }
  } else if (node.collectionId && node.imageField) {
    // Collection-backed gallery
    const collection = state.collections.get(node.collectionId)
    if (collection) {
      for (const rowId of collection.rowOrder) {
        const row = collection.rows.get(rowId)
        if (!row) continue
        const fieldVal = row[node.imageField]
        // T-0009-239: null imageField per row → push null (renders fallback icon)
        uris.push(typeof fieldVal === 'string' && fieldVal ? fieldVal : null)
      }
    }
  }

  // T-0009-238: empty state
  if (uris.length === 0) {
    const captionSpec = theme.type.caption
    return (
      <View
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: theme.spacing['space-xl'],
          gap: theme.spacing['space-sm'],
        }}
        accessibilityLabel={node.accessibilityLabel ?? 'Photo gallery'}
        testID={`gallery-${node.id}`}
      >
        <Icon name="image" size={32} color={theme['fg-muted']} />
        <Text
          style={{
            fontSize: captionSpec.size,
            lineHeight: captionSpec.lineHeight,
            color: theme['fg-muted'],
          }}
        >
          No photos yet
        </Text>
      </View>
    )
  }

  // Build rows of `columns` cells each.
  const rows: (string | null)[][] = []
  for (let i = 0; i < uris.length; i += columns) {
    rows.push(uris.slice(i, i + columns))
  }

  return (
    <View
      accessibilityLabel={node.accessibilityLabel ?? 'Photo gallery'}
      testID={`gallery-${node.id}`}
      role="list"
    >
      {rows.map((row, rowIdx) => (
        <View
          key={rowIdx}
          style={{
            flexDirection: 'row',
            gap,
            marginBottom: rowIdx < rows.length - 1 ? gap : 0,
          }}
        >
          {row.map((uri, colIdx) => {
            const globalIdx = rowIdx * columns + colIdx
            return (
              <GalleryCell
                key={colIdx}
                uri={uri}
                aspectRatio={aspectRatio}
                borderRadius={borderRadius}
                onPress={() => setSelectedUri(uri)}
                accessibilityLabel={`Photo ${globalIdx + 1} of ${uris.length}`}
                theme={theme}
              />
            )
          })}

          {/* Pad incomplete last row with invisible spacers */}
          {row.length < columns
            ? Array.from({length: columns - row.length}).map((_, i) => (
                <View key={`spacer-${i}`} style={{flex: 1}} />
              ))
            : null}
        </View>
      ))}

      {/* Fullscreen modal — T-0009-163, T-0009-164 */}
      <FullscreenModal
        uri={selectedUri}
        onClose={() => setSelectedUri(null)}
        theme={theme}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
