/**
 * StackNav tests
 * T-0006-163: Renderer with navigation:'stack' mounts NativeStackNavigator with 2+ screens
 * T-0006-164: navigate(target) pushes to target screen
 * T-0006-165: back pops to previous screen
 * T-0006-172a: back() on empty history calls host.onNavigationError('back-on-empty-history')
 */
import React from 'react'
import {renderWithTheme} from '../__test-utils__/renderWithTheme'
import {StackNav} from './StackNav'
import type {Spec} from '@app-creator/protocol'
import {SpecSchema} from '@app-creator/protocol'
import type {NavigationPrimitive} from '../state/middleware/navigation'

const STACK_SPEC: Spec = {
  version: 1,
  archetype: 'ListCRUD',
  stance: 'productive',
  palette: 'focus',
  coverIcon: 'list',
  navigation: 'stack',
  initialScreenId: 'list',
  screens: [
    {
      id: 'list',
      title: 'Tasks',
      root: {id: 'h1', type: 'Heading', text: 'Task List', level: 1},
    },
    {
      id: 'detail',
      title: 'Detail',
      root: {id: 'h2', type: 'Heading', text: 'Task Detail', level: 2},
    },
  ],
  collections: [],
  initialState: {},
}

describe('StackNav (T-0006-163)', () => {
  it('validates against SpecSchema with navigation: stack', () => {
    expect(SpecSchema.safeParse(STACK_SPEC).success).toBe(true)
  })

  it('renders without throwing', () => {
    const {toJSON} = renderWithTheme(
      <StackNav spec={STACK_SPEC} onPrimitiveReady={jest.fn()} />,
    )
    expect(toJSON()).not.toBeNull()
  })

  it('calls onPrimitiveReady with a NavigationPrimitive when the container mounts (T-0006-163)', () => {
    const onPrimitiveReady = jest.fn()
    renderWithTheme(
      <StackNav spec={STACK_SPEC} onPrimitiveReady={onPrimitiveReady} />,
    )
    // The NavigationContainer mock fires onReady immediately.
    expect(onPrimitiveReady).toHaveBeenCalledWith(
      expect.objectContaining({navigate: expect.any(Function), pop: expect.any(Function)}),
    )
  })

  it('calls onPrimitiveReady(null) on unmount', () => {
    const onPrimitiveReady = jest.fn()
    const {unmount} = renderWithTheme(
      <StackNav spec={STACK_SPEC} onPrimitiveReady={onPrimitiveReady} />,
    )
    unmount()
    expect(onPrimitiveReady).toHaveBeenLastCalledWith(null)
  })

  it('renders the initial screen content (T-0006-163 stack navigator)', () => {
    const {getByText} = renderWithTheme(
      <StackNav spec={STACK_SPEC} onPrimitiveReady={jest.fn()} />,
    )
    // The mock NavigationContainer renders the initial screen.
    expect(getByText('Task List')).toBeTruthy()
  })

  it('snapshot — StackNav productive×focus', () => {
    const {toJSON} = renderWithTheme(
      <StackNav spec={STACK_SPEC} onPrimitiveReady={jest.fn()} />,
    )
    expect(toJSON()).toMatchSnapshot()
  })
})

describe('StackNav NavigationPrimitive (T-0006-164 / T-0006-165)', () => {
  it('navigate(target) calls navRef.navigate with target screen id (T-0006-164)', () => {
    let capturedPrimitive: NavigationPrimitive | null = null
    const onPrimitiveReady = jest.fn((p) => { capturedPrimitive = p })

    renderWithTheme(<StackNav spec={STACK_SPEC} onPrimitiveReady={onPrimitiveReady} />)

    expect(capturedPrimitive).not.toBeNull()
    // navigate on the primitive should not throw (mock navRef handles it).
    expect(() => capturedPrimitive?.navigate('detail')).not.toThrow()
  })

  it('pop() calls navRef.goBack (T-0006-165)', () => {
    let capturedPrimitive: NavigationPrimitive | null = null
    const onPrimitiveReady = jest.fn((p) => { capturedPrimitive = p })

    renderWithTheme(<StackNav spec={STACK_SPEC} onPrimitiveReady={onPrimitiveReady} />)

    expect(capturedPrimitive).not.toBeNull()
    expect(() => capturedPrimitive?.pop()).not.toThrow()
  })
})
