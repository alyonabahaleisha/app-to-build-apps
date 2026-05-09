/**
 * ButtonRenderer tests
 *
 * T-0006-148: snapshot at productive×focus
 * T-0006-149: snapshot at expressive×health
 * T-0006-152: Button variants render correct theme colors
 * T-0006-153: Button sizes enforce 32/44/56 pt heights
 * T-0006-154: Button disabled binding resolves via useBinding; press is no-op
 * T-0006-155: Button press dispatches action verb
 */
import React from 'react'
import {fireEvent} from '@testing-library/react-native'
import type {Node} from '@app-creator/protocol'
import {renderWithTheme} from '../../__test-utils__/renderWithTheme'
import {ButtonRenderer} from './Button'

type ButtonNode = Extract<Node, {type: 'Button'}>

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_BUTTON: ButtonNode = {
  id: 'btn1',
  type: 'Button',
  label: 'Add Item',
  action: {type: 'addItem', collection: 'items', item: {name: 'New item'}},
}

// ---------------------------------------------------------------------------
// T-0006-148: snapshot at productive×focus
// ---------------------------------------------------------------------------

describe('ButtonRenderer snapshot (T-0006-148) — productive×focus', () => {
  it('matches snapshot (primary variant, md size)', () => {
    const {toJSON} = renderWithTheme(
      <ButtonRenderer node={BASE_BUTTON} />,
      {stance: 'productive', palette: 'focus'},
    )
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0006-149: snapshot at expressive×health
// ---------------------------------------------------------------------------

describe('ButtonRenderer snapshot (T-0006-149) — expressive×health', () => {
  it('matches snapshot (secondary variant, lg size)', () => {
    const node: ButtonNode = {
      ...BASE_BUTTON,
      id: 'btn2',
      label: 'Save Journal',
      variant: 'secondary',
      size: 'lg',
      action: {type: 'set', target: 'saved', value: true},
    }
    const {toJSON} = renderWithTheme(
      <ButtonRenderer node={node} />,
      {stance: 'expressive', palette: 'health'},
    )
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0006-152: Button variants render correct theme colors
// ---------------------------------------------------------------------------

describe('ButtonRenderer variants (T-0006-152)', () => {
  it('primary variant uses accent background', () => {
    const node: ButtonNode = {...BASE_BUTTON, variant: 'primary'}
    const {toJSON} = renderWithTheme(<ButtonRenderer node={node} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = JSON.stringify(toJSON())
    // productive×focus accent is #4F46E5
    expect(tree).toContain('#4F46E5')
  })

  it('secondary variant uses bg-elevated background with divider border', () => {
    const node: ButtonNode = {...BASE_BUTTON, id: 'btn-sec', variant: 'secondary'}
    const {toJSON} = renderWithTheme(<ButtonRenderer node={node} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = JSON.stringify(toJSON())
    // bg-elevated is #FFFFFF for productive
    expect(tree).toContain('#FFFFFF')
    // divider is #ECEEF1
    expect(tree).toContain('#ECEEF1')
  })

  it('destructive variant uses danger background', () => {
    const node: ButtonNode = {
      ...BASE_BUTTON,
      id: 'btn-dest',
      variant: 'destructive',
      action: {type: 'clearCollection', collection: 'items'},
    }
    const {toJSON} = renderWithTheme(<ButtonRenderer node={node} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = JSON.stringify(toJSON())
    // danger is #C03A2B for productive
    expect(tree).toContain('#C03A2B')
  })

  it('text variant uses transparent background and accent text color', () => {
    const node: ButtonNode = {...BASE_BUTTON, id: 'btn-txt', variant: 'text'}
    const {toJSON} = renderWithTheme(<ButtonRenderer node={node} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = JSON.stringify(toJSON())
    expect(tree).toContain('transparent')
    // accent fg text color #4F46E5
    expect(tree).toContain('#4F46E5')
  })
})

// ---------------------------------------------------------------------------
// T-0006-153: Button sizes enforce 32/44/56 pt minimum heights
// ---------------------------------------------------------------------------

describe('ButtonRenderer sizes (T-0006-153)', () => {
  it.each([
    ['sm', 32],
    ['md', 44],
    ['lg', 56],
  ] as [ButtonNode['size'], number][])(
    'size=%s enforces minHeight=%dpt',
    (size, expectedHeight) => {
      const node: ButtonNode = {...BASE_BUTTON, id: `btn-${size}`, size}
      const {toJSON} = renderWithTheme(<ButtonRenderer node={node} />)
      const tree = JSON.stringify(toJSON())
      expect(tree).toContain(`"minHeight":${expectedHeight}`)
    },
  )
})

// ---------------------------------------------------------------------------
// T-0006-154: Button disabled binding resolves; press is no-op
// ---------------------------------------------------------------------------

describe('ButtonRenderer disabled (T-0006-154)', () => {
  it('disabled literal true: renders at 50% opacity', () => {
    const node: ButtonNode = {
      ...BASE_BUTTON,
      id: 'btn-disabled',
      disabled: {kind: 'literal', value: true},
    }
    const {toJSON} = renderWithTheme(<ButtonRenderer node={node} />)
    const tree = JSON.stringify(toJSON())
    expect(tree).toContain('"opacity":0.5')
  })

  it('disabled literal true: press does NOT dispatch', () => {
    const node: ButtonNode = {
      ...BASE_BUTTON,
      id: 'btn-disabled-nodispatch',
      disabled: {kind: 'literal', value: true},
    }
    const mockDispatch = jest.fn()
    const {getByRole} = renderWithTheme(<ButtonRenderer node={node} />, {
      dispatch: mockDispatch,
    })
    // Try to press the button — it should be disabled.
    const btn = getByRole('button')
    fireEvent.press(btn)
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it('disabled literal false: press DOES dispatch', () => {
    const node: ButtonNode = {
      ...BASE_BUTTON,
      id: 'btn-enabled',
      disabled: {kind: 'literal', value: false},
    }
    const mockDispatch = jest.fn()
    const {getByRole} = renderWithTheme(<ButtonRenderer node={node} />, {
      dispatch: mockDispatch,
    })
    fireEvent.press(getByRole('button'))
    expect(mockDispatch).toHaveBeenCalledWith(node.action)
  })

  it('disabled undefined: behaves as enabled', () => {
    const node: ButtonNode = {...BASE_BUTTON, id: 'btn-undef', disabled: undefined}
    const mockDispatch = jest.fn()
    const {getByRole} = renderWithTheme(<ButtonRenderer node={node} />, {
      dispatch: mockDispatch,
    })
    fireEvent.press(getByRole('button'))
    expect(mockDispatch).toHaveBeenCalledWith(node.action)
  })

  it('accessibilityState disabled=true when disabled binding is true', () => {
    const node: ButtonNode = {
      ...BASE_BUTTON,
      id: 'btn-a11y-disabled',
      disabled: {kind: 'literal', value: true},
    }
    const {getByRole} = renderWithTheme(<ButtonRenderer node={node} />)
    const btn = getByRole('button')
    expect(btn.props.accessibilityState).toEqual(
      expect.objectContaining({disabled: true}),
    )
  })
})

// ---------------------------------------------------------------------------
// T-0006-155: Button press dispatches action verb (dispatch half)
//
// ButtonRenderer renders in isolation with a mockDispatch — no real middleware
// chain is in scope. The haptic half of T-0006-155 ("fires Light haptic") is
// asserted in haptics.test.ts, which tests the haptics middleware directly for
// the addItem verb. Option B cross-reference pattern per ADR-0006 Roz ruling.
// ---------------------------------------------------------------------------

describe('ButtonRenderer press dispatches action (T-0006-155)', () => {
  it('pressing button dispatches the node action to the renderer (haptic half: see haptics.test.ts)', () => {
    const action = {type: 'addItem' as const, collection: 'tasks', item: {name: 'Buy milk'}}
    const node: ButtonNode = {...BASE_BUTTON, id: 'btn-dispatch', action}
    const mockDispatch = jest.fn()
    const {getByRole} = renderWithTheme(<ButtonRenderer node={node} />, {
      dispatch: mockDispatch,
    })
    fireEvent.press(getByRole('button'))
    expect(mockDispatch).toHaveBeenCalledTimes(1)
    expect(mockDispatch).toHaveBeenCalledWith(action)
  })

  it('accessibility role is "button"', () => {
    const {getByRole} = renderWithTheme(<ButtonRenderer node={BASE_BUTTON} />)
    expect(getByRole('button')).toBeTruthy()
  })

  it('accessibility label defaults to node.label', () => {
    const node: ButtonNode = {...BASE_BUTTON, id: 'btn-label', label: 'Save Task'}
    const {getByLabelText} = renderWithTheme(<ButtonRenderer node={node} />)
    expect(getByLabelText('Save Task')).toBeTruthy()
  })

  it('accessibility label uses accessibilityLabel override when provided', () => {
    const node: ButtonNode = {
      ...BASE_BUTTON,
      id: 'btn-a11y-label',
      label: 'Add',
      accessibilityLabel: 'Add new workout',
    }
    const {getByLabelText} = renderWithTheme(<ButtonRenderer node={node} />)
    expect(getByLabelText('Add new workout')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Hit target: Button minimum 44pt height for sm is 32pt (the spec allows <44 for sm),
// but md and lg must meet 44pt.
// Note: The UX doc says "min 44pt" as a general rule but ADR specifically lists
// 32/44/56 for sm/md/lg. We assert the ADR values.
// ---------------------------------------------------------------------------

describe('ButtonRenderer hit targets', () => {
  it('md button has minHeight >= 44', () => {
    const node: ButtonNode = {...BASE_BUTTON, id: 'btn-ht-md', size: 'md'}
    const {toJSON} = renderWithTheme(<ButtonRenderer node={node} />)
    const tree = JSON.stringify(toJSON())
    expect(tree).toContain('"minHeight":44')
  })

  it('lg button has minHeight >= 44', () => {
    const node: ButtonNode = {...BASE_BUTTON, id: 'btn-ht-lg', size: 'lg'}
    const {toJSON} = renderWithTheme(<ButtonRenderer node={node} />)
    const tree = JSON.stringify(toJSON())
    expect(tree).toContain('"minHeight":56')
  })
})
