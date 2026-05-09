/**
 * MediaTrayRenderer — horizontal scrolling tray of images from a collection.
 *
 * Reads each row's `imageField` value (expected to be a URI string) and renders
 * it as an image. Uses react-native's built-in Image component (not expo-image)
 * to avoid pulling in a heavy native module into tests. V0 deferral: expo-image
 * for production caching/blurhash is a Step 12 polish task.
 *
 * Layout:
 *   - Horizontal FlashList (scrollable)
 *   - aspectRatio controls item width from item height:
 *     '1:1' → width = height
 *     '4:5' → width = height * 4/5
 *     '16:9' → width = height * 16/9
 *   - Item height: 120pt (compact media tray per UX doc)
 *   - Items spaced by space-xs (4pt)
 *   - Rounded corners: radius-md
 *
 * Optional tapAction: dispatches on item tap.
 *
 * Unknown collectionId: renders empty View with dev warning.
 * Unknown imageField or non-string value: item renders a gray placeholder.
 *
 * Accessibility:
 *   - Container: accessibilityRole="list", accessibilityLabel from node or collectionId
 *   - Each image: accessibilityRole="image"
 *
 * T-0006-133: snapshot at productive×focus
 * T-0006-134: snapshot at expressive×health
 * T-0006-142: renders horizontal FlashList of images from collection rows
 */
import React from 'react'
import {Image, Pressable, View} from 'react-native'
import {FlashList} from '@shopify/flash-list'
import type {Node} from '@app-creator/protocol'
import {useRendererStateContext} from '../../state/useRendererState.js'
import {useTheme} from '../../theme/RendererThemeProvider.js'
import type {Row} from '../../state/types.js'

type MediaTrayNode = Extract<Node, {type: 'MediaTray'}>

const ITEM_HEIGHT = 120

const ASPECT_RATIO_WIDTH: Record<string, number> = {
  '1:1': ITEM_HEIGHT,
  '4:5': Math.round(ITEM_HEIGHT * (4 / 5)),
  '16:9': Math.round(ITEM_HEIGHT * (16 / 9)),
}

function MediaTrayItem({
  row,
  imageField,
  aspectRatio,
  tapAction,
  dispatch,
  theme,
}: {
  row: Row
  imageField: string
  aspectRatio: string
  tapAction: MediaTrayNode['tapAction']
  dispatch: ReturnType<typeof useRendererStateContext>['dispatch']
  theme: ReturnType<typeof useTheme>
}) {
  const uri = typeof row[imageField] === 'string' ? (row[imageField] as string) : undefined
  const itemWidth = ASPECT_RATIO_WIDTH[aspectRatio] ?? ITEM_HEIGHT

  function handleTap() {
    if (tapAction) dispatch(tapAction)
  }

  const content = uri ? (
    <Image
      source={{uri}}
      style={{
        width: itemWidth,
        height: ITEM_HEIGHT,
        borderRadius: theme.radii['radius-md'],
        backgroundColor: theme['bg-elevated'],
      }}
      accessibilityRole="image"
    />
  ) : (
    // Placeholder for missing/non-string image field values.
    <View
      style={{
        width: itemWidth,
        height: ITEM_HEIGHT,
        borderRadius: theme.radii['radius-md'],
        backgroundColor: theme.divider,
      }}
      accessibilityRole="image"
      accessibilityLabel="Image placeholder"
    />
  )

  if (tapAction) {
    return (
      <Pressable
        onPress={handleTap}
        accessibilityRole="button"
        style={{marginRight: theme.spacing['space-xs']}}
      >
        {content}
      </Pressable>
    )
  }

  return (
    <View style={{marginRight: theme.spacing['space-xs']}}>
      {content}
    </View>
  )
}

export function MediaTrayRenderer({node}: {node: MediaTrayNode}) {
  const theme = useTheme()
  const {state, dispatch} = useRendererStateContext()
  const collection = state.collections.get(node.collectionId)

  if (collection === undefined) {
    if (__DEV__) {
      console.warn(
        `[a2ui-renderer] MediaTray: collectionId "${node.collectionId}" not found. ` +
          `Rendering empty.`,
      )
    }
    return (
      <View
        accessibilityLabel={node.accessibilityLabel ?? node.collectionId}
      />
    )
  }

  const aspectRatio = node.aspectRatio ?? '1:1'

  const rows: {rowId: string; row: Row}[] = collection.rowOrder
    .map(rowId => {
      const row = collection.rows.get(rowId)
      return row ? {rowId, row} : null
    })
    .filter((entry): entry is {rowId: string; row: Row} => entry !== null)

  return (
    <View
      style={{height: ITEM_HEIGHT}}
      accessibilityLabel={node.accessibilityLabel ?? node.collectionId}
      accessibilityRole="list"
    >
      <FlashList
        data={rows}
        keyExtractor={entry => entry.rowId}
        horizontal
        renderItem={({item}) => (
          <MediaTrayItem
            row={item.row}
            imageField={node.imageField}
            aspectRatio={aspectRatio}
            tapAction={node.tapAction}
            dispatch={dispatch}
            theme={theme}
          />
        )}
      />
    </View>
  )
}
