/**
 * ImagePicker tests
 *
 * T-0006-135: snapshot at productive×focus
 * T-0006-136: snapshot at expressive×health
 * T-0006-143: opens expo-image-picker; result dispatches as image-ref binding
 */
import React from 'react'
import {fireEvent, waitFor} from '@testing-library/react-native'
import * as ExpoImagePicker from 'expo-image-picker'
import type {Node, Spec} from '@app-creator/protocol'
import {renderWithTheme} from '../../__test-utils__/renderWithTheme'
import {buildInitialRendererState} from '../../state/reducer'
import {ImagePickerRenderer} from './ImagePicker'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type ImagePickerNode = Extract<Node, {type: 'ImagePicker'}>

const IMAGE_PICKER_STATE_BINDING: ImagePickerNode = {
  id: 'ip1',
  type: 'ImagePicker',
  label: 'Profile photo',
  valueBinding: {kind: 'state', slot: 'photoSlot'},
}

const IMAGE_PICKER_LITERAL_BINDING: ImagePickerNode = {
  id: 'ip2',
  type: 'ImagePicker',
  label: 'Cover photo',
  valueBinding: {kind: 'literal', value: 'file://existing.jpg'},
}

const IMAGE_PICKER_CAMERA: ImagePickerNode = {
  id: 'ip3',
  type: 'ImagePicker',
  label: 'Take a photo',
  source: 'camera',
  valueBinding: {kind: 'state', slot: 'cameraSlot'},
}

const MINIMAL_SPEC: Spec = {
  version: 1,
  archetype: 'ListCRUD',
  stance: 'productive',
  palette: 'focus',
  coverIcon: 'camera',
  navigation: 'none',
  screens: [{id: 's1', root: {id: 'n1', type: 'Heading', text: 'T', level: 1}}],
  initialScreenId: 's1',
  collections: [],
  initialState: {photoSlot: '', cameraSlot: ''},
}

// ---------------------------------------------------------------------------
// T-0006-135: snapshot at productive×focus (no image selected)
// ---------------------------------------------------------------------------

describe('ImagePickerRenderer snapshot (T-0006-135) — productive×focus', () => {
  it('matches snapshot (empty state)', () => {
    const state = buildInitialRendererState(MINIMAL_SPEC)
    const {toJSON} = renderWithTheme(
      <ImagePickerRenderer node={IMAGE_PICKER_STATE_BINDING} />,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0006-136: snapshot at expressive×health (image selected via literal binding)
// ---------------------------------------------------------------------------

describe('ImagePickerRenderer snapshot (T-0006-136) — expressive×health', () => {
  it('matches snapshot (with selected image)', () => {
    const state = buildInitialRendererState(MINIMAL_SPEC)
    const {toJSON} = renderWithTheme(
      <ImagePickerRenderer node={IMAGE_PICKER_LITERAL_BINDING} />,
      {stance: 'expressive', palette: 'health', rendererState: state},
    )
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0006-143: opens expo-image-picker; result dispatches as image-ref binding
// ---------------------------------------------------------------------------

describe('ImagePickerRenderer (T-0006-143)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('calls launchImageLibraryAsync on press (default source = library)', async () => {
    const launchLibrary = ExpoImagePicker.launchImageLibraryAsync as jest.MockedFunction<typeof ExpoImagePicker.launchImageLibraryAsync>
    launchLibrary.mockResolvedValue({canceled: true, assets: null})

    const state = buildInitialRendererState(MINIMAL_SPEC)
    const {getByRole} = renderWithTheme(
      <ImagePickerRenderer node={IMAGE_PICKER_STATE_BINDING} />,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )
    fireEvent.press(getByRole('button'))
    await waitFor(() => expect(launchLibrary).toHaveBeenCalledTimes(1))
  })

  it('dispatches set action with selected image URI on successful pick', async () => {
    const launchLibrary = ExpoImagePicker.launchImageLibraryAsync as jest.MockedFunction<typeof ExpoImagePicker.launchImageLibraryAsync>
    launchLibrary.mockResolvedValueOnce({
      canceled: false,
      assets: [{uri: 'file://selected-photo.jpg', width: 800, height: 600}],
    })

    const state = buildInitialRendererState(MINIMAL_SPEC)
    const mockDispatch = jest.fn()
    const {getByRole} = renderWithTheme(
      <ImagePickerRenderer node={IMAGE_PICKER_STATE_BINDING} />,
      {stance: 'productive', palette: 'focus', rendererState: state, dispatch: mockDispatch},
    )

    fireEvent.press(getByRole('button'))
    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'set',
        target: 'photoSlot',
        value: 'file://selected-photo.jpg',
      })
    })
  })

  it('does not dispatch when user cancels the picker', async () => {
    const launchLibrary = ExpoImagePicker.launchImageLibraryAsync as jest.MockedFunction<typeof ExpoImagePicker.launchImageLibraryAsync>
    launchLibrary.mockResolvedValueOnce({canceled: true, assets: null})

    const state = buildInitialRendererState(MINIMAL_SPEC)
    const mockDispatch = jest.fn()
    const {getByRole} = renderWithTheme(
      <ImagePickerRenderer node={IMAGE_PICKER_STATE_BINDING} />,
      {stance: 'productive', palette: 'focus', rendererState: state, dispatch: mockDispatch},
    )

    fireEvent.press(getByRole('button'))
    await waitFor(() => expect(launchLibrary).toHaveBeenCalledTimes(1))
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it('does not call picker when binding is literal (read-only)', () => {
    const launchLibrary = ExpoImagePicker.launchImageLibraryAsync as jest.MockedFunction<typeof ExpoImagePicker.launchImageLibraryAsync>
    const launchCamera = ExpoImagePicker.launchCameraAsync as jest.MockedFunction<typeof ExpoImagePicker.launchCameraAsync>

    const state = buildInitialRendererState(MINIMAL_SPEC)
    const {getByRole} = renderWithTheme(
      <ImagePickerRenderer node={IMAGE_PICKER_LITERAL_BINDING} />,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )
    fireEvent.press(getByRole('button'))
    // Neither picker was opened — literal binding is read-only.
    expect(launchLibrary).not.toHaveBeenCalled()
    expect(launchCamera).not.toHaveBeenCalled()
  })

  it('requests camera permission before opening camera picker', async () => {
    const requestCamera = ExpoImagePicker.requestCameraPermissionsAsync as jest.MockedFunction<typeof ExpoImagePicker.requestCameraPermissionsAsync>
    const launchCamera = ExpoImagePicker.launchCameraAsync as jest.MockedFunction<typeof ExpoImagePicker.launchCameraAsync>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    requestCamera.mockResolvedValueOnce({status: 'granted', canAskAgain: true, granted: true, expires: 'never'} as any)
    launchCamera.mockResolvedValueOnce({canceled: true, assets: null})

    const state = buildInitialRendererState(MINIMAL_SPEC)
    const {getByRole} = renderWithTheme(
      <ImagePickerRenderer node={IMAGE_PICKER_CAMERA} />,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )

    fireEvent.press(getByRole('button'))
    await waitFor(() => expect(requestCamera).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(launchCamera).toHaveBeenCalledTimes(1))
  })

  it('shows warning toast when camera permission is denied', async () => {
    const requestCamera = ExpoImagePicker.requestCameraPermissionsAsync as jest.MockedFunction<typeof ExpoImagePicker.requestCameraPermissionsAsync>
    const launchCamera = ExpoImagePicker.launchCameraAsync as jest.MockedFunction<typeof ExpoImagePicker.launchCameraAsync>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    requestCamera.mockResolvedValueOnce({status: 'denied', canAskAgain: false, granted: false, expires: 'never'} as any)

    const state = buildInitialRendererState(MINIMAL_SPEC)
    const onToast = jest.fn()
    const {getByRole} = renderWithTheme(
      <ImagePickerRenderer node={IMAGE_PICKER_CAMERA} />,
      {
        stance: 'productive',
        palette: 'focus',
        rendererState: state,
        host: {onToast},
      },
    )

    fireEvent.press(getByRole('button'))
    await waitFor(() => {
      expect(onToast).toHaveBeenCalledWith(
        'Camera permission required to take a photo.',
        'warning',
      )
    })
    expect(launchCamera).not.toHaveBeenCalled()
  })

  it('renders the label text when no image is selected', () => {
    const state = buildInitialRendererState(MINIMAL_SPEC)
    const {getByText} = renderWithTheme(
      <ImagePickerRenderer node={IMAGE_PICKER_STATE_BINDING} />,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )
    expect(getByText('Profile photo')).toBeTruthy()
    expect(getByText('Tap to choose')).toBeTruthy()
  })

  it('renders the image when the slot has a URI value', () => {
    const state = {
      ...buildInitialRendererState(MINIMAL_SPEC),
      slots: new Map([['photoSlot', 'file://my-photo.jpg']]),
    }
    const {getByLabelText, queryByText} = renderWithTheme(
      <ImagePickerRenderer node={IMAGE_PICKER_STATE_BINDING} />,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )
    // When a URI is in the slot, the Image is shown (label = node.label)
    // and the placeholder text "Tap to choose" disappears.
    expect(getByLabelText('Profile photo')).toBeTruthy()
    expect(queryByText('Tap to choose')).toBeNull()
  })

  it('has correct accessibilityRole="button"', () => {
    const state = buildInitialRendererState(MINIMAL_SPEC)
    const {getByRole} = renderWithTheme(
      <ImagePickerRenderer node={IMAGE_PICKER_STATE_BINDING} />,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )
    expect(getByRole('button')).toBeTruthy()
  })
})
