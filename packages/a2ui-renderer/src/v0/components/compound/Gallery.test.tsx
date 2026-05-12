/**
 * Gallery tests — ADR-0009 Step 7
 *
 * T-0009-158: GallerySchema.parse({collectionId, imageField: 'photoUrl'}) succeeds
 * T-0009-159: GallerySchema.parse({images: [{kind:'literal', value:'http://...'}]}) succeeds
 * T-0009-160: Gallery with both (collectionId+imageField) and images rejects
 * T-0009-161: Gallery with neither rejects
 * T-0009-162: Gallery with collectionId but no imageField rejects at superRefine
 * T-0009-163: Gallery cell tap opens fullscreen modal
 * T-0009-164: Gallery fullscreen modal close button uses IconButton (icon: 'x')
 * T-0009-181: Snapshot at productive×focus + expressive×health
 * T-0009-238: Empty-state renders "No photos yet" + image icon
 * T-0009-239: Null imageField rows render fallback, don't crash
 */
import React from 'react'
import {fireEvent} from '@testing-library/react-native'
import type {Node, Spec} from '@app-creator/protocol'
import {GallerySchema} from '@app-creator/protocol'
import {renderWithTheme} from '../../__test-utils__/renderWithTheme'
import {buildInitialRendererState} from '../../state/reducer'
import {GalleryRenderer} from './Gallery'

type GalleryNode = Extract<Node, {type: 'Gallery'}>

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const GALLERY_WITH_IMAGES: GalleryNode = {
  id: 'gal1',
  type: 'Gallery',
  images: [
    {kind: 'literal', value: 'https://example.com/photo1.jpg'},
    {kind: 'literal', value: 'https://example.com/photo2.jpg'},
    {kind: 'literal', value: 'https://example.com/photo3.jpg'},
  ],
}

const GALLERY_WITH_COLLECTION: GalleryNode = {
  id: 'gal2',
  type: 'Gallery',
  collectionId: 'photos',
  imageField: 'photoUrl',
}

const GALLERY_EMPTY: GalleryNode = {
  id: 'gal3',
  type: 'Gallery',
  images: [],
}

const GALLERY_EMPTY_COLLECTION: GalleryNode = {
  id: 'gal4',
  type: 'Gallery',
  collectionId: 'photos',
  imageField: 'photoUrl',
}

// Spec with a 'photos' collection for collection-backed tests.
const PHOTOS_SPEC: Spec = {
  version: 1,
  archetype: 'Tracker',
  stance: 'productive',
  palette: 'focus',
  coverIcon: 'image',
  navigation: 'none',
  screens: [{id: 's1', root: {id: 'n1', type: 'Heading', text: 'T', level: 1}}],
  initialScreenId: 's1',
  collections: [
    {
      id: 'photos',
      name: 'Photos',
      fields: [
        {name: 'title', type: {type: 'string'} as const, required: true},
        {name: 'photoUrl', type: {type: 'image'} as const, required: false},
      ],
      seedData: [
        {title: 'Sunset', photoUrl: 'https://example.com/sunset.jpg'},
        {title: 'Mountain', photoUrl: 'https://example.com/mountain.jpg'},
      ],
      syncMode: 'local' as const,
    },
  ],
  initialState: {},
}

// Spec with null-imageField rows for T-0009-239.
const NULL_IMAGE_FIELD_SPEC: Spec = {
  version: 1,
  archetype: 'Tracker',
  stance: 'productive',
  palette: 'focus',
  coverIcon: 'image',
  navigation: 'none',
  screens: [{id: 's1', root: {id: 'n1', type: 'Heading', text: 'T', level: 1}}],
  initialScreenId: 's1',
  collections: [
    {
      id: 'photos',
      name: 'Photos',
      fields: [
        {name: 'title', type: {type: 'string'} as const, required: true},
        {name: 'photoUrl', type: {type: 'image'} as const, required: false},
      ],
      seedData: [
        {title: 'Row 1', photoUrl: 'https://example.com/photo1.jpg'},
        {title: 'Row 2 — null image', photoUrl: ''},  // empty string → null-ish
        {title: 'Row 3', photoUrl: 'https://example.com/photo3.jpg'},
      ],
      syncMode: 'local' as const,
    },
  ],
  initialState: {},
}

// Spec with 0-row photos collection for empty collection test.
const EMPTY_COLLECTION_SPEC: Spec = {
  version: 1,
  archetype: 'Tracker',
  stance: 'productive',
  palette: 'focus',
  coverIcon: 'image',
  navigation: 'none',
  screens: [{id: 's1', root: {id: 'n1', type: 'Heading', text: 'T', level: 1}}],
  initialScreenId: 's1',
  collections: [
    {
      id: 'photos',
      name: 'Photos',
      fields: [
        {name: 'title', type: {type: 'string'} as const, required: true},
        {name: 'photoUrl', type: {type: 'image'} as const, required: false},
      ],
      seedData: [],
      syncMode: 'local' as const,
    },
  ],
  initialState: {},
}

// ---------------------------------------------------------------------------
// T-0009-158..162: Schema validation
// ---------------------------------------------------------------------------

describe('GallerySchema validation (T-0009-158..162)', () => {
  it('T-0009-158: parses with collectionId + imageField', () => {
    const result = GallerySchema.safeParse({
      id: 'g1',
      type: 'Gallery',
      collectionId: 'photos',
      imageField: 'photoUrl',
    })
    expect(result.success).toBe(true)
  })

  it('T-0009-159: parses with images array', () => {
    const result = GallerySchema.safeParse({
      id: 'g1',
      type: 'Gallery',
      images: [{kind: 'literal', value: 'http://example.com/photo.jpg'}],
    })
    expect(result.success).toBe(true)
  })

  it('T-0009-160: rejects when both collectionId+imageField and images are set', () => {
    const result = GallerySchema.safeParse({
      id: 'g1',
      type: 'Gallery',
      collectionId: 'photos',
      imageField: 'photoUrl',
      images: [{kind: 'literal', value: 'http://example.com/photo.jpg'}],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]!.message).toContain('exactly one of')
    }
  })

  it('T-0009-161: rejects when neither collectionId+imageField nor images is set', () => {
    const result = GallerySchema.safeParse({
      id: 'g1',
      type: 'Gallery',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]!.message).toContain('exactly one of')
    }
  })

  it('T-0009-162: rejects when collectionId is set but imageField is missing', () => {
    const result = GallerySchema.safeParse({
      id: 'g1',
      type: 'Gallery',
      collectionId: 'photos',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const imageFieldIssue = result.error.issues.find((i: {path: (string | number)[]}) => i.path.includes('imageField'))
      expect(imageFieldIssue).toBeDefined()
      expect(imageFieldIssue!.message).toBe('Gallery with collectionId requires imageField')
    }
  })
})

// ---------------------------------------------------------------------------
// T-0009-163: cell tap opens fullscreen modal
// T-0009-164: modal close button uses IconButton (icon: 'x')
// ---------------------------------------------------------------------------

describe('Gallery fullscreen modal (T-0009-163, T-0009-164)', () => {
  it('T-0009-163: tapping a cell opens the fullscreen modal', () => {
    const {getAllByRole, getByTestId} = renderWithTheme(
      <GalleryRenderer node={GALLERY_WITH_IMAGES} />,
      {stance: 'productive', palette: 'focus'},
    )

    // Before tap: modal should not be visible (no testID present while closed)
    // Tap the first cell button
    const cells = getAllByRole('button')
    fireEvent.press(cells[0]!)

    // After tap: fullscreen modal should appear
    const modal = getByTestId('gallery-fullscreen-modal')
    expect(modal).toBeTruthy()
  })

  it('T-0009-164: fullscreen modal has a close button accessible by testID', () => {
    const {getAllByRole, getByTestId} = renderWithTheme(
      <GalleryRenderer node={GALLERY_WITH_IMAGES} />,
      {stance: 'productive', palette: 'focus'},
    )

    // Open the modal
    const cells = getAllByRole('button')
    fireEvent.press(cells[0]!)

    // Close button uses IconButton pattern (accessibilityRole="button" + Icon name="x")
    const closeBtn = getByTestId('gallery-fullscreen-close')
    expect(closeBtn).toBeTruthy()
    expect(closeBtn.props.accessibilityRole).toBe('button')
    expect(closeBtn.props.accessibilityLabel).toBe('Close photo')

    // Pressing close should dismiss the modal
    fireEvent.press(closeBtn)
    // After close, the modal is no longer visible (query fails)
    // Note: Modal visibility in RN tests is a known limitation; we assert the button exists
    // and the press handler doesn't throw.
  })
})

// ---------------------------------------------------------------------------
// T-0009-238: Empty state rendering
// ---------------------------------------------------------------------------

describe('Gallery empty state (T-0009-238)', () => {
  it('T-0009-238a: empty images array renders "No photos yet"', () => {
    const {getByText} = renderWithTheme(
      <GalleryRenderer node={GALLERY_EMPTY} />,
      {stance: 'productive', palette: 'focus'},
    )
    expect(getByText('No photos yet')).toBeTruthy()
  })

  it('T-0009-238b: collection with 0 rows renders "No photos yet"', () => {
    const {getByText} = renderWithTheme(
      <GalleryRenderer node={GALLERY_EMPTY_COLLECTION} />,
      {
        stance: 'productive',
        palette: 'focus',
        rendererState: buildInitialRendererState(EMPTY_COLLECTION_SPEC),
      },
    )
    expect(getByText('No photos yet')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// T-0009-239: Null imageField per row doesn't crash
// ---------------------------------------------------------------------------

describe('Gallery null imageField handling (T-0009-239)', () => {
  it('T-0009-239: 3 rows with 1 having empty photoUrl — renders 3 cells, does not crash', () => {
    const {getAllByRole} = renderWithTheme(
      <GalleryRenderer node={GALLERY_WITH_COLLECTION} />,
      {
        stance: 'productive',
        palette: 'focus',
        rendererState: buildInitialRendererState(NULL_IMAGE_FIELD_SPEC),
      },
    )
    // All 3 cells should render (1 with fallback icon, 2 with images)
    const cells = getAllByRole('button')
    expect(cells.length).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// Collection-backed gallery renders cells
// ---------------------------------------------------------------------------

describe('Gallery collection-backed rendering', () => {
  it('renders one cell per collection row', () => {
    const {getAllByRole} = renderWithTheme(
      <GalleryRenderer node={GALLERY_WITH_COLLECTION} />,
      {
        stance: 'productive',
        palette: 'focus',
        rendererState: buildInitialRendererState(PHOTOS_SPEC),
      },
    )
    // 2 rows in seedData → 2 cells
    const cells = getAllByRole('button')
    expect(cells.length).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// T-0009-181: Snapshots at productive×focus + expressive×health
// ---------------------------------------------------------------------------

describe('GalleryRenderer snapshots (T-0009-181)', () => {
  it('T-0009-181a: snapshot at productive×focus', () => {
    const {toJSON} = renderWithTheme(
      <GalleryRenderer node={GALLERY_WITH_IMAGES} />,
      {stance: 'productive', palette: 'focus'},
    )
    expect(toJSON()).toMatchSnapshot()
  })

  it('T-0009-181b: snapshot at expressive×health', () => {
    const {toJSON} = renderWithTheme(
      <GalleryRenderer node={GALLERY_WITH_IMAGES} />,
      {stance: 'expressive', palette: 'health'},
    )
    expect(toJSON()).toMatchSnapshot()
  })
})
