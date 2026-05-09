/**
 * TabsNav tests
 * T-0006-166: Renderer with navigation:'tabs' mounts TabsNav with segmented control
 * T-0006-167: Tab selection swaps body content (motion-smooth crossfade)
 * T-0006-168: 5 screens rejected at schema parse (regression on protocol)
 */
import React from 'react'
import {fireEvent, act} from '@testing-library/react-native'
import {renderWithTheme} from '../__test-utils__/renderWithTheme'
import {TabsNav} from './TabsNav'
import type {Spec} from '@app-creator/protocol'
import {SpecSchema} from '@app-creator/protocol'
import type {NavigationPrimitive} from '../state/middleware/navigation'

const TABS_SPEC: Spec = {
  version: 1,
  archetype: 'Tracker',
  stance: 'productive',
  palette: 'focus',
  coverIcon: 'target',
  navigation: 'tabs',
  initialScreenId: 'today',
  screens: [
    {
      id: 'today',
      title: 'Today',
      root: {id: 'h1', type: 'Heading', text: 'Today View', level: 1},
    },
    {
      id: 'history',
      title: 'History',
      root: {id: 'h2', type: 'Heading', text: 'History View', level: 2},
    },
    {
      id: 'insights',
      title: 'Insights',
      root: {id: 'h3', type: 'Heading', text: 'Insights View', level: 2},
    },
  ],
  collections: [],
  initialState: {},
}

describe('TabsNav (T-0006-166)', () => {
  it('validates against SpecSchema with navigation: tabs', () => {
    expect(SpecSchema.safeParse(TABS_SPEC).success).toBe(true)
  })

  it('5 screens with tabs navigation fails schema validation (T-0006-168)', () => {
    const fiveScreenSpec = {
      ...TABS_SPEC,
      screens: [
        ...TABS_SPEC.screens,
        {id: 'extra1', title: 'E1', root: {id: 'h4', type: 'Heading', text: 'E1', level: 2}},
        {id: 'extra2', title: 'E2', root: {id: 'h5', type: 'Heading', text: 'E2', level: 2}},
      ],
    }
    // Zod rejects > 4 screens at the SpecSchema level.
    expect(SpecSchema.safeParse(fiveScreenSpec).success).toBe(false)
  })

  it('renders with a tab bar per screen (T-0006-166)', () => {
    const {getByText} = renderWithTheme(
      <TabsNav spec={TABS_SPEC} onPrimitiveReady={jest.fn()} />,
    )
    // All tab labels are rendered.
    expect(getByText('Today')).toBeTruthy()
    expect(getByText('History')).toBeTruthy()
    expect(getByText('Insights')).toBeTruthy()
  })

  it('renders the initial screen content', () => {
    const {getByText} = renderWithTheme(
      <TabsNav spec={TABS_SPEC} onPrimitiveReady={jest.fn()} />,
    )
    expect(getByText('Today View')).toBeTruthy()
  })

  it('tapping a tab swaps the body content (T-0006-167)', () => {
    const {getByText} = renderWithTheme(
      <TabsNav spec={TABS_SPEC} onPrimitiveReady={jest.fn()} />,
    )
    // Initially shows Today View.
    expect(getByText('Today View')).toBeTruthy()
    // Tap the History tab.
    fireEvent.press(getByText('History'))
    // Now shows History View.
    expect(getByText('History View')).toBeTruthy()
  })

  it('registers a NavigationPrimitive on mount', () => {
    const onPrimitiveReady = jest.fn()
    renderWithTheme(<TabsNav spec={TABS_SPEC} onPrimitiveReady={onPrimitiveReady} />)
    expect(onPrimitiveReady).toHaveBeenCalledWith(
      expect.objectContaining({navigate: expect.any(Function), pop: expect.any(Function)}),
    )
  })

  it('primitive.navigate(screenId) switches to the correct tab', () => {
    let capturedPrimitive: NavigationPrimitive | null = null
    const onPrimitiveReady = jest.fn((p) => { capturedPrimitive = p })
    const {getByText} = renderWithTheme(
      <TabsNav spec={TABS_SPEC} onPrimitiveReady={onPrimitiveReady} />,
    )

    expect(capturedPrimitive).not.toBeNull()
    // Navigate to the history tab via the primitive.
    act(() => { capturedPrimitive?.navigate('history') })
    expect(getByText('History View')).toBeTruthy()
  })

  it('signals null primitive on unmount', () => {
    const onPrimitiveReady = jest.fn()
    const {unmount} = renderWithTheme(
      <TabsNav spec={TABS_SPEC} onPrimitiveReady={onPrimitiveReady} />,
    )
    unmount()
    expect(onPrimitiveReady).toHaveBeenLastCalledWith(null)
  })

  it('snapshot — TabsNav productive×focus', () => {
    const {toJSON} = renderWithTheme(
      <TabsNav spec={TABS_SPEC} onPrimitiveReady={jest.fn()} />,
    )
    expect(toJSON()).toMatchSnapshot()
  })
})
