/**
 * DocumentPicker tests — ADR-0009 Step 7
 *
 * T-0009-174: DocumentPickerSchema.parse({label, valueBinding, acceptedTypes: ['pdf', 'image']}) succeeds
 * T-0009-175: DocumentPicker with acceptedTypes: [] rejects (min 1)
 * T-0009-176: DocumentPicker with 5 acceptedTypes rejects (max 4)
 * T-0009-177: DocumentPicker with acceptedTypes: ['gif'] rejects (not in enum)
 * T-0009-178: DocumentPicker maps acceptedTypes: ['pdf'] to MIME application/pdf
 * T-0009-179: mock returns {uri, name}; renderer dispatches set with URI
 * T-0009-180: permission denied → shows error caption, retries on next tap
 * T-0009-184: Snapshot at productive×focus + expressive×health
 */
import React from 'react'
import {fireEvent, act, waitFor} from '@testing-library/react-native'
import {DocumentPickerSchema} from '@app-creator/protocol'
import type {Node} from '@app-creator/protocol'
import {renderWithTheme} from '../../__test-utils__/renderWithTheme'
import {DocumentPickerRenderer, toMimeTypes, ACCEPTED_TYPE_MIME_MAP} from './DocumentPicker'
import * as ExpoDocumentPicker from 'expo-document-picker'

type DocumentPickerNode = Extract<Node, {type: 'DocumentPicker'}>

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_DOC_PICKER: DocumentPickerNode = {
  id: 'dp1',
  type: 'DocumentPicker',
  label: 'Attach Document',
  valueBinding: {kind: 'state', slot: 'docUri'},
  acceptedTypes: ['any'],
}

const PDF_PICKER: DocumentPickerNode = {
  id: 'dp2',
  type: 'DocumentPicker',
  label: 'Attach PDF',
  valueBinding: {kind: 'state', slot: 'pdfUri'},
  acceptedTypes: ['pdf'],
}

const MULTI_TYPE_PICKER: DocumentPickerNode = {
  id: 'dp3',
  type: 'DocumentPicker',
  label: 'Attach File',
  valueBinding: {kind: 'state', slot: 'fileUri'},
  acceptedTypes: ['pdf', 'image'],
}

const LITERAL_PICKER: DocumentPickerNode = {
  id: 'dp4',
  type: 'DocumentPicker',
  label: 'View Document',
  valueBinding: {kind: 'literal', value: 'file:///existing-doc.pdf'},
  acceptedTypes: ['pdf'],
}

// ---------------------------------------------------------------------------
// T-0009-174..177: Schema validation
// ---------------------------------------------------------------------------

describe('DocumentPickerSchema validation (T-0009-174..177)', () => {
  it('T-0009-174: parses with label, valueBinding, acceptedTypes: ["pdf", "image"]', () => {
    const result = DocumentPickerSchema.safeParse({
      id: 'dp1',
      type: 'DocumentPicker',
      label: 'Upload file',
      valueBinding: {kind: 'state', slot: 'fileSlot'},
      acceptedTypes: ['pdf', 'image'],
    })
    expect(result.success).toBe(true)
  })

  it('T-0009-175: acceptedTypes: [] rejects (min 1)', () => {
    const result = DocumentPickerSchema.safeParse({
      id: 'dp1',
      type: 'DocumentPicker',
      label: 'Upload file',
      valueBinding: {kind: 'state', slot: 'fileSlot'},
      acceptedTypes: [],
    })
    expect(result.success).toBe(false)
  })

  it('T-0009-176: 5 acceptedTypes rejects (max 4)', () => {
    const result = DocumentPickerSchema.safeParse({
      id: 'dp1',
      type: 'DocumentPicker',
      label: 'Upload file',
      valueBinding: {kind: 'state', slot: 'fileSlot'},
      acceptedTypes: ['pdf', 'image', 'video', 'audio', 'any'],
    })
    expect(result.success).toBe(false)
  })

  it('T-0009-177: acceptedTypes: ["gif"] rejects (not in enum)', () => {
    const result = DocumentPickerSchema.safeParse({
      id: 'dp1',
      type: 'DocumentPicker',
      label: 'Upload file',
      valueBinding: {kind: 'state', slot: 'fileSlot'},
      acceptedTypes: ['gif'],
    })
    expect(result.success).toBe(false)
  })

  it('parses without acceptedTypes (optional — renderer defaults to ["any"])', () => {
    const result = DocumentPickerSchema.safeParse({
      id: 'dp1',
      type: 'DocumentPicker',
      label: 'Upload file',
      valueBinding: {kind: 'state', slot: 'fileSlot'},
    })
    expect(result.success).toBe(true)
  })

  it('accepts label in diverse languages (i18n)', () => {
    for (const label of ['Fichier', '文件', "O'Brien's CV"]) {
      const result = DocumentPickerSchema.safeParse({
        id: 'dp1',
        type: 'DocumentPicker',
        label,
        valueBinding: {kind: 'state', slot: 'fileSlot'},
      })
      expect(result.success).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// T-0009-178: MIME type mapping
// ---------------------------------------------------------------------------

describe('DocumentPicker MIME type mapping (T-0009-178)', () => {
  it('T-0009-178: ["pdf"] → "application/pdf"', () => {
    expect(toMimeTypes(['pdf'])).toBe('application/pdf')
  })

  it('["image"] → "image/*"', () => {
    expect(toMimeTypes(['image'])).toBe('image/*')
  })

  it('["video"] → "video/*"', () => {
    expect(toMimeTypes(['video'])).toBe('video/*')
  })

  it('["audio"] → "audio/*"', () => {
    expect(toMimeTypes(['audio'])).toBe('audio/*')
  })

  it('["any"] → "*/*"', () => {
    expect(toMimeTypes(['any'])).toBe('*/*')
  })

  it('multiple types return an array', () => {
    const result = toMimeTypes(['pdf', 'image'])
    expect(Array.isArray(result)).toBe(true)
    expect(result).toEqual(['application/pdf', 'image/*'])
  })

  it('ACCEPTED_TYPE_MIME_MAP covers all 5 enum values', () => {
    for (const type of ['pdf', 'image', 'video', 'audio', 'any']) {
      expect(ACCEPTED_TYPE_MIME_MAP[type]).toBeDefined()
      expect(ACCEPTED_TYPE_MIME_MAP[type]!.length).toBeGreaterThan(0)
    }
  })

  it('getDocumentAsync is called with the correct MIME type for pdf', async () => {
    const mockGetDocument = ExpoDocumentPicker.getDocumentAsync as jest.MockedFunction<
      typeof ExpoDocumentPicker.getDocumentAsync
    >
    mockGetDocument.mockResolvedValueOnce({canceled: true, assets: null})

    const {getByTestId} = renderWithTheme(
      <DocumentPickerRenderer node={PDF_PICKER} />,
      {stance: 'productive', palette: 'focus'},
    )

    await act(async () => {
      fireEvent.press(getByTestId('document-picker-trigger-dp2'))
    })

    expect(mockGetDocument).toHaveBeenCalledWith({
      type: 'application/pdf',
      copyToCacheDirectory: false,
    })
  })
})

// ---------------------------------------------------------------------------
// T-0009-179: Dispatch on success
// ---------------------------------------------------------------------------

describe('DocumentPicker dispatch on success (T-0009-179)', () => {
  it('T-0009-179: mock returns {uri, name}; renderer dispatches set with URI', async () => {
    const mockGetDocument = ExpoDocumentPicker.getDocumentAsync as jest.MockedFunction<
      typeof ExpoDocumentPicker.getDocumentAsync
    >
    mockGetDocument.mockResolvedValueOnce({
      canceled: false,
      assets: [{uri: 'file:///path/to/doc.pdf', name: 'doc.pdf', size: 1024, mimeType: 'application/pdf'}],
    })

    const mockDispatch = jest.fn()
    const {getByTestId} = renderWithTheme(
      <DocumentPickerRenderer node={PDF_PICKER} />,
      {stance: 'productive', palette: 'focus', dispatch: mockDispatch},
    )

    await act(async () => {
      fireEvent.press(getByTestId('document-picker-trigger-dp2'))
    })

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'set',
      target: 'pdfUri',
      value: 'file:///path/to/doc.pdf',
    })
  })

  it('cancel returns no-op (dispatch not called)', async () => {
    const mockGetDocument = ExpoDocumentPicker.getDocumentAsync as jest.MockedFunction<
      typeof ExpoDocumentPicker.getDocumentAsync
    >
    mockGetDocument.mockResolvedValueOnce({canceled: true, assets: null})

    const mockDispatch = jest.fn()
    const {getByTestId} = renderWithTheme(
      <DocumentPickerRenderer node={BASE_DOC_PICKER} />,
      {stance: 'productive', palette: 'focus', dispatch: mockDispatch},
    )

    await act(async () => {
      fireEvent.press(getByTestId('document-picker-trigger-dp1'))
    })

    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it('literal binding: pressing does not invoke getDocumentAsync', async () => {
    const mockGetDocument = ExpoDocumentPicker.getDocumentAsync as jest.MockedFunction<
      typeof ExpoDocumentPicker.getDocumentAsync
    >
    mockGetDocument.mockClear()

    const {getByTestId} = renderWithTheme(
      <DocumentPickerRenderer node={LITERAL_PICKER} />,
      {stance: 'productive', palette: 'focus'},
    )

    await act(async () => {
      fireEvent.press(getByTestId('document-picker-trigger-dp4'))
    })

    expect(mockGetDocument).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// T-0009-180: Error state / permission denied
// ---------------------------------------------------------------------------

describe('DocumentPicker error state (T-0009-180)', () => {
  it('T-0009-180: error caption is shown when getDocumentAsync throws', async () => {
    const mockGetDocument = ExpoDocumentPicker.getDocumentAsync as jest.MockedFunction<
      typeof ExpoDocumentPicker.getDocumentAsync
    >
    mockGetDocument.mockRejectedValueOnce(new Error('Permission denied'))

    const {getByTestId} = renderWithTheme(
      <DocumentPickerRenderer node={BASE_DOC_PICKER} />,
      {stance: 'productive', palette: 'focus'},
    )

    await act(async () => {
      fireEvent.press(getByTestId('document-picker-trigger-dp1'))
    })

    await waitFor(() => {
      const errorEl = getByTestId('document-picker-error-dp1')
      expect(errorEl).toBeTruthy()
    })
  })

  it('T-0009-180: retries on next tap — error clears and picker reopens', async () => {
    const mockGetDocument = ExpoDocumentPicker.getDocumentAsync as jest.MockedFunction<
      typeof ExpoDocumentPicker.getDocumentAsync
    >
    // First call: throws
    mockGetDocument.mockRejectedValueOnce(new Error('Permission denied'))
    // Second call: success
    mockGetDocument.mockResolvedValueOnce({
      canceled: false,
      assets: [{uri: 'file:///retry.pdf', name: 'retry.pdf', size: 512, mimeType: 'application/pdf'}],
    })

    const mockDispatch = jest.fn()
    const {getByTestId} = renderWithTheme(
      <DocumentPickerRenderer node={BASE_DOC_PICKER} />,
      {stance: 'productive', palette: 'focus', dispatch: mockDispatch},
    )

    // First tap — triggers error
    await act(async () => {
      fireEvent.press(getByTestId('document-picker-trigger-dp1'))
    })

    await waitFor(() => {
      expect(getByTestId('document-picker-error-dp1')).toBeTruthy()
    })

    // Second tap — error clears, dispatch fires
    await act(async () => {
      fireEvent.press(getByTestId('document-picker-trigger-dp1'))
    })

    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'set',
        target: 'docUri',
        value: 'file:///retry.pdf',
      })
    })
  })
})

// ---------------------------------------------------------------------------
// T-0009-184: Snapshots
// ---------------------------------------------------------------------------

describe('DocumentPickerRenderer snapshots (T-0009-184)', () => {
  it('T-0009-184a: snapshot at productive×focus', () => {
    const {toJSON} = renderWithTheme(
      <DocumentPickerRenderer node={BASE_DOC_PICKER} />,
      {stance: 'productive', palette: 'focus'},
    )
    expect(toJSON()).toMatchSnapshot()
  })

  it('T-0009-184b: snapshot at expressive×health', () => {
    const {toJSON} = renderWithTheme(
      <DocumentPickerRenderer node={MULTI_TYPE_PICKER} />,
      {stance: 'expressive', palette: 'health'},
    )
    expect(toJSON()).toMatchSnapshot()
  })
})
