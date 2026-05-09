/**
 * ModalOverlayNav tests
 * T-0006-169: Renderer with navigation:'modal-overlay' mounts root + Gorhom sheet
 * T-0006-170: navigate(target) opens sheet with target screen
 * T-0006-171: Sheet drag-down dismisses (Gorhom built-in / dismiss() call)
 * T-0006-172b: navigate while sheet open → swap + onNavigationError('navigate-while-sheet-open')
 */
import React from 'react'
import {act} from '@testing-library/react-native'
import {renderWithTheme} from '../__test-utils__/renderWithTheme'
import {ModalOverlayNav} from './ModalOverlayNav'
import type {Spec} from '@app-creator/protocol'
import {SpecSchema} from '@app-creator/protocol'
import type {NavigationPrimitive} from '../state/middleware/navigation'

const MODAL_SPEC: Spec = {
  version: 1,
  archetype: 'ListCRUD',
  stance: 'productive',
  palette: 'focus',
  coverIcon: 'list',
  navigation: 'modal-overlay',
  initialScreenId: 'main',
  screens: [
    {
      id: 'main',
      title: 'Main',
      root: {id: 'h1', type: 'Heading', text: 'Main Screen', level: 1},
    },
    {
      id: 'addForm',
      title: 'Add Item',
      root: {id: 'h2', type: 'Heading', text: 'Add Form', level: 2},
    },
  ],
  collections: [],
  initialState: {},
}

describe('ModalOverlayNav (T-0006-169)', () => {
  it('validates against SpecSchema with navigation: modal-overlay', () => {
    const result = SpecSchema.safeParse(MODAL_SPEC)
    if (!result.success) {
      throw new Error(JSON.stringify(result.error.issues, null, 2))
    }
    expect(result.success).toBe(true)
  })

  it('renders the base screen on mount without sheet visible (T-0006-169)', () => {
    const {getByText, queryByText} = renderWithTheme(
      <ModalOverlayNav
        spec={MODAL_SPEC}
        onPrimitiveReady={jest.fn()}
        onNavigationError={jest.fn()}
      />,
    )
    // Base screen is always rendered.
    expect(getByText('Main Screen')).toBeTruthy()
    // Modal screen content is not shown until navigate() is called.
    expect(queryByText('Add Form')).toBeNull()
  })

  it('registers a NavigationPrimitive on mount', () => {
    const onPrimitiveReady = jest.fn()
    renderWithTheme(
      <ModalOverlayNav
        spec={MODAL_SPEC}
        onPrimitiveReady={onPrimitiveReady}
        onNavigationError={jest.fn()}
      />,
    )
    expect(onPrimitiveReady).toHaveBeenCalledWith(
      expect.objectContaining({navigate: expect.any(Function), pop: expect.any(Function)}),
    )
  })

  it('navigate(target) opens the sheet with the target screen content (T-0006-170)', () => {
    let capturedPrimitive: NavigationPrimitive | null = null
    const onPrimitiveReady = jest.fn((p) => { capturedPrimitive = p })

    const {getByText} = renderWithTheme(
      <ModalOverlayNav
        spec={MODAL_SPEC}
        onPrimitiveReady={onPrimitiveReady}
        onNavigationError={jest.fn()}
      />,
    )

    expect(capturedPrimitive).not.toBeNull()
    act(() => {
      capturedPrimitive?.navigate('addForm')
    })
    // After navigate, the modal screen content is rendered in the sheet.
    expect(getByText('Add Form')).toBeTruthy()
  })

  it('pop() dismisses the sheet (T-0006-171)', () => {
    let capturedPrimitive: NavigationPrimitive | null = null
    const onPrimitiveReady = jest.fn((p) => { capturedPrimitive = p })

    const {getByText, queryByText} = renderWithTheme(
      <ModalOverlayNav
        spec={MODAL_SPEC}
        onPrimitiveReady={onPrimitiveReady}
        onNavigationError={jest.fn()}
      />,
    )

    // Open the sheet first.
    act(() => { capturedPrimitive?.navigate('addForm') })
    expect(getByText('Add Form')).toBeTruthy()

    // Dismiss via pop().
    act(() => { capturedPrimitive?.pop() })
    expect(queryByText('Add Form')).toBeNull()
  })

  it('navigate while sheet open signals navigate-while-sheet-open and swaps target (T-0006-172b)', () => {
    const threeScreenSpec: Spec = {
      ...MODAL_SPEC,
      screens: [
        ...MODAL_SPEC.screens,
        {
          id: 'editForm',
          title: 'Edit',
          root: {id: 'h3', type: 'Heading', text: 'Edit Form', level: 2},
        },
      ],
    }

    let capturedPrimitive: NavigationPrimitive | null = null
    const onPrimitiveReady = jest.fn((p) => { capturedPrimitive = p })
    const onNavigationError = jest.fn()

    const {getByText} = renderWithTheme(
      <ModalOverlayNav
        spec={threeScreenSpec}
        onPrimitiveReady={onPrimitiveReady}
        onNavigationError={onNavigationError}
      />,
    )

    // First navigate: open the sheet.
    act(() => { capturedPrimitive?.navigate('addForm') })
    expect(getByText('Add Form')).toBeTruthy()

    // Second navigate while sheet is open: should swap to new target.
    act(() => { capturedPrimitive?.navigate('editForm') })
    expect(onNavigationError).toHaveBeenCalledWith('navigate-while-sheet-open')
    expect(getByText('Edit Form')).toBeTruthy()
  })

  it('signals null primitive on unmount', () => {
    const onPrimitiveReady = jest.fn()
    const {unmount} = renderWithTheme(
      <ModalOverlayNav
        spec={MODAL_SPEC}
        onPrimitiveReady={onPrimitiveReady}
        onNavigationError={jest.fn()}
      />,
    )
    unmount()
    expect(onPrimitiveReady).toHaveBeenLastCalledWith(null)
  })

  it('snapshot — ModalOverlayNav productive×focus (base screen only)', () => {
    const {toJSON} = renderWithTheme(
      <ModalOverlayNav
        spec={MODAL_SPEC}
        onPrimitiveReady={jest.fn()}
        onNavigationError={jest.fn()}
      />,
    )
    expect(toJSON()).toMatchSnapshot()
  })
})
