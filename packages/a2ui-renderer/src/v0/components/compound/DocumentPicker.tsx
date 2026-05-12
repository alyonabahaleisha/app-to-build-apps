/**
 * DocumentPickerRenderer — labeled tappable area backed by expo-document-picker.
 *
 * V1 Phase 1 Step 7 (T-0009-174..180, T-0009-184).
 *
 * On tap: calls DocumentPicker.getDocumentAsync({type: mimeTypes, copyToCacheDirectory: false}).
 * On success: dispatches set_binding (set) with the file URI to the state slot.
 * On cancel: no-op (silent).
 * On permission denied / error: shows error caption below the picker; retries on next tap.
 *
 * MIME type map (T-0009-178):
 *   'pdf'   → 'application/pdf'
 *   'image' → 'image/*'
 *   'video' → 'video/*'
 *   'audio' → 'audio/*'
 *   'any'   → 'star/star' (i.e. all types)
 *
 * valueBinding: StringBinding — receives the file URI on success.
 *   'state' binding writes to the named slot.
 *   'literal' binding → read-only display (no picker invoked).
 *   'collectionField' → warns via host.onToast (V0 limitation; no updateItem).
 *
 * Tests mock expo-document-picker entirely (no live picker invocation per AC).
 * The mock strategy is jest.mock('expo-document-picker', ...) in jestSetup.js.
 *
 * T-0009-174: DocumentPickerSchema.parse({label, valueBinding, acceptedTypes: ['pdf', 'image']}) succeeds
 * T-0009-175: acceptedTypes: [] rejects (min 1)
 * T-0009-176: 5 acceptedTypes rejects (max 4)
 * T-0009-177: acceptedTypes: ['gif'] rejects (not in enum)
 * T-0009-178: maps acceptedTypes: ['pdf'] to MIME application/pdf
 * T-0009-179: mock returns {uri, name}; renderer dispatches set with URI
 * T-0009-180: permission denied → shows error caption, retries on next tap
 * T-0009-184: snapshots at productive×focus + expressive×health
 */
import React, {useState} from 'react'
import {View, Text, Pressable} from 'react-native'
import * as ExpoDocumentPicker from 'expo-document-picker'
import type {Node} from '@app-creator/protocol'
import {Icon} from '@app-creator/design-system'
import {useTheme} from '../../theme/RendererThemeProvider.js'
import {useBinding} from '../../state/useBinding.js'
import {useRendererStateContext} from '../../state/useRendererState.js'
import {useHost} from '../../host/HostContext.js'

type DocumentPickerNode = Extract<Node, {type: 'DocumentPicker'}>

// Map acceptedType enum values to MIME type strings (T-0009-178).
export const ACCEPTED_TYPE_MIME_MAP: Record<string, string> = {
  pdf: 'application/pdf',
  image: 'image/*',
  video: 'video/*',
  audio: 'audio/*',
  any: '*/*',
}

// Convert an array of acceptedType enum values to a MIME type string
// suitable for DocumentPicker's `type` option.
export function toMimeTypes(acceptedTypes: string[]): string | string[] {
  const mimes = acceptedTypes.map(t => ACCEPTED_TYPE_MIME_MAP[t] ?? '*/*')
  return mimes.length === 1 ? mimes[0]! : mimes
}

const PICKER_HEIGHT = 80

export function DocumentPickerRenderer({node}: {node: DocumentPickerNode}) {
  const theme = useTheme()
  const {dispatch} = useRendererStateContext()
  const host = useHost()

  const [hasError, setHasError] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const binding = node.valueBinding
  const isLiteral = binding.kind === 'literal'

  // Resolve current file URI for display.
  const currentUri = useBinding<string>(
    binding as {kind: 'literal'; value: string} | {kind: 'state'; slot: string} | {kind: 'collectionField'; collectionId: string; field: string},
  )

  const acceptedTypes = node.acceptedTypes ?? ['any']
  const placeholder = node.placeholder ?? 'Tap to choose a file'
  const a11yLabel = node.accessibilityLabel ?? `${node.label} — tap to choose file`

  async function handlePress() {
    if (isLiteral) return

    setHasError(false)
    setErrorMessage(null)

    let result: ExpoDocumentPicker.DocumentPickerResult
    try {
      result = await ExpoDocumentPicker.getDocumentAsync({
        type: toMimeTypes(acceptedTypes),
        copyToCacheDirectory: false,
      })
    } catch {
      setHasError(true)
      setErrorMessage('Could not open document picker.')
      return
    }

    // User cancelled — silent no-op (T-0009-179 spec note).
    if (result.canceled) return

    const asset = result.assets?.[0]
    if (!asset) return

    const uri = asset.uri

    if (binding.kind === 'state') {
      dispatch({type: 'set', target: binding.slot, value: uri})
    } else if (binding.kind === 'collectionField') {
      // V0 limitation: collectionField writes require updateItem (Step 9 concern).
      host.onToast('File selection from collection fields is not yet supported.', 'warning')
    }
  }

  const bodySpec = theme.type.body
  const captionSpec = theme.type.caption

  return (
    <View testID={`document-picker-${node.id}`}>
      <Text
        style={{
          fontSize: captionSpec.size,
          lineHeight: captionSpec.lineHeight,
          fontWeight: '600',
          color: theme.fg,
          marginBottom: theme.spacing['space-xs'],
        }}
      >
        {node.label}
      </Text>

      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        testID={`document-picker-trigger-${node.id}`}
        style={({pressed}) => ({
          height: PICKER_HEIGHT,
          borderRadius: theme.radii['radius-md'],
          borderWidth: 1,
          borderColor: hasError ? theme.danger : theme.divider,
          borderStyle: currentUri ? 'solid' : 'dashed',
          backgroundColor: pressed ? theme['bg-elevated'] : theme.bg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing['space-sm'],
          paddingHorizontal: theme.spacing['space-md'],
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Icon
          name={currentUri ? 'file-text' : 'file'}
          size={20}
          color={theme['fg-muted']}
        />
        <Text
          style={{
            fontSize: bodySpec.size,
            lineHeight: bodySpec.lineHeight,
            color: currentUri ? theme.fg : theme['fg-muted'],
            flex: 1,
          }}
          numberOfLines={1}
          testID={`document-picker-label-${node.id}`}
        >
          {currentUri
            ? currentUri.split('/').pop() ?? 'Selected file'
            : placeholder}
        </Text>
      </Pressable>

      {/* Error caption — T-0009-180: shown on permission denied / error */}
      {hasError && errorMessage ? (
        <Text
          style={{
            fontSize: captionSpec.size,
            lineHeight: captionSpec.lineHeight,
            color: theme.danger,
            marginTop: theme.spacing['space-xs'],
          }}
          testID={`document-picker-error-${node.id}`}
        >
          {errorMessage}
        </Text>
      ) : null}
    </View>
  )
}
