/**
 * ImagePickerRenderer — tappable image picker backed by expo-image-picker.
 *
 * On tap: opens the native image picker (camera or library per node.source).
 * On selection: resolves the image URI and dispatches a `set` action to the
 * target slot referenced by node.valueBinding.
 * On cancel / permission denied: no dispatch. Permission denial is passed to
 * host.onToast with a 'warning' tone (so the user sees feedback).
 *
 * Binding resolution:
 *   - valueBinding.kind === 'literal': the URI is hardcoded (read-only display).
 *   - valueBinding.kind === 'state': reads/writes slot by name.
 *   - valueBinding.kind === 'collectionField': reads from ListItemContext for
 *     display; writes to the collection field via a `updateItem` action if
 *     inside a list (Step 9 task — in V0, falls back to toast warning).
 *
 * V0 scope: Only 'state' binding dispatch is fully supported for writes.
 * 'literal' binding renders read-only (no picker).
 * 'collectionField' binding opens picker but warns on write (no updateItem in V0).
 *
 * Accessibility:
 *   - Pressable: accessibilityRole="button", accessibilityLabel from node or default.
 *   - Current image: accessibilityRole="image".
 *
 * No useEffect — expo-image-picker is called inside the press handler, not
 * in a lifecycle effect.
 *
 * T-0006-135: snapshot at productive×focus
 * T-0006-136: snapshot at expressive×health
 * T-0006-143: opens expo-image-picker; result dispatches as image-ref binding
 */
import React from 'react'
import {Image, Pressable, Text, View} from 'react-native'
import * as ExpoImagePicker from 'expo-image-picker'
import type {Node} from '@app-creator/protocol'
import {useRendererStateContext} from '../../state/useRendererState.js'
import {useBinding} from '../../state/useBinding.js'
import {useHost} from '../../host/HostContext.js'
import {useTheme} from '../../theme/RendererThemeProvider.js'
import type {ImageBinding} from '../../state/types.js'

type ImagePickerNode = Extract<Node, {type: 'ImagePicker'}>

// PICKER_HEIGHT — height of the picker button / image preview area.
const PICKER_HEIGHT = 120

function openImagePickerForSource(
  source: ImagePickerNode['source'],
): Promise<ExpoImagePicker.ImagePickerResult> {
  const options: ExpoImagePicker.ImagePickerOptions = {
    mediaTypes: ExpoImagePicker.MediaTypeOptions.Images,
    allowsEditing: false,
    quality: 0.8,
  }

  if (source === 'camera') {
    return ExpoImagePicker.launchCameraAsync(options)
  }
  // 'library' and 'both' (and undefined) use the library picker.
  return ExpoImagePicker.launchImageLibraryAsync(options)
}

export function ImagePickerRenderer({node}: {node: ImagePickerNode}) {
  const theme = useTheme()
  const {dispatch} = useRendererStateContext()
  const host = useHost()

  const currentUri = useBinding<string>(node.valueBinding as ImageBinding)

  const isLiteral = node.valueBinding.kind === 'literal'
  const a11yLabel =
    node.accessibilityLabel ?? `${node.label} — tap to choose image`

  async function handlePress() {
    // Read-only if the binding is a literal value.
    if (isLiteral) return

    // Request permission first for camera source.
    if (node.source === 'camera') {
      const {status} = await ExpoImagePicker.requestCameraPermissionsAsync()
      if (status !== 'granted') {
        host.onToast('Camera permission required to take a photo.', 'warning')
        return
      }
    }

    let result: ExpoImagePicker.ImagePickerResult
    try {
      result = await openImagePickerForSource(node.source)
    } catch {
      host.onToast('Could not open image picker.', 'warning')
      return
    }

    // User cancelled or picker returned no assets.
    if (result.canceled || !result.assets || result.assets.length === 0) {
      return
    }

    const selectedAsset = result.assets[0]
    if (!selectedAsset) return
    const uri = selectedAsset.uri

    // Dispatch to state slot (state binding) or warn for collectionField (V0 limitation).
    if (node.valueBinding.kind === 'state') {
      dispatch({type: 'set', target: node.valueBinding.slot, value: uri})
    } else if (node.valueBinding.kind === 'collectionField') {
      // V0 limitation: collectionField writes for ImagePicker require updateItem
      // which is a Step 9 dispatcher-feedback concern. Warn via toast.
      host.onToast(
        'Image selection from collection fields is not yet supported.',
        'warning',
      )
    }
  }

  const bodySpec = theme.type.body
  const captionSpec = theme.type.caption

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      style={({pressed}) => ({
        height: PICKER_HEIGHT,
        borderRadius: theme.radii['radius-md'],
        borderWidth: 1,
        borderColor: theme.divider,
        borderStyle: currentUri ? 'solid' : 'dashed',
        backgroundColor: pressed ? theme['bg-elevated'] : theme.bg,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {currentUri ? (
        /* Selected image preview */
        <Image
          source={{uri: currentUri}}
          style={{
            width: '100%',
            height: '100%',
          }}
          resizeMode="cover"
          accessibilityRole="image"
          accessibilityLabel={node.label}
        />
      ) : (
        /* Placeholder when no image is selected */
        <View style={{alignItems: 'center', gap: theme.spacing['space-xs']}}>
          <Text
            style={{
              fontSize: bodySpec.size,
              lineHeight: bodySpec.lineHeight,
              color: theme['fg-muted'],
              fontWeight: '500',
            }}
          >
            {node.label}
          </Text>
          <Text
            style={{
              fontSize: captionSpec.size,
              lineHeight: captionSpec.lineHeight,
              color: theme['fg-faint'],
            }}
          >
            Tap to choose
          </Text>
        </View>
      )}
    </Pressable>
  )
}
