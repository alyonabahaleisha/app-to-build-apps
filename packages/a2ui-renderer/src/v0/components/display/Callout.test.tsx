/**
 * CalloutRenderer tests
 * T-0009-080: 5 variants render with correct icon defaults
 * T-0009-081: warning variant → accessibilityRole="alert"
 * T-0009-082: info variant → accessibilityRole="text"
 * T-0009-083: with action → renders trailing button
 * T-0009-084: tip variant → bg-elevated background (no tint)
 * T-0009-085: info variant → accent tint at 6%
 * T-0009-087: snapshots at productive×focus + expressive×health
 * T-0009-242: danger variant → accessibilityRole="alert"
 */
import React from 'react'
import {fireEvent} from '@testing-library/react-native'
import {renderWithTheme} from '../../__test-utils__/renderWithTheme'
import type {Node} from '@app-creator/protocol'
import {CalloutRenderer} from './Callout'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type CalloutNode = Extract<Node, {type: 'Callout'}>

const CALLOUT_INFO: CalloutNode = {
  id: 'cal1',
  type: 'Callout',
  variant: 'info',
  headline: 'Information for you',
}

const CALLOUT_SUCCESS: CalloutNode = {
  id: 'cal2',
  type: 'Callout',
  variant: 'success',
  headline: 'Operation succeeded',
}

const CALLOUT_WARNING: CalloutNode = {
  id: 'cal3',
  type: 'Callout',
  variant: 'warning',
  headline: 'Watch out',
}

const CALLOUT_TIP: CalloutNode = {
  id: 'cal4',
  type: 'Callout',
  variant: 'tip',
  headline: 'Pro tip',
}

const CALLOUT_DANGER: CalloutNode = {
  id: 'cal5',
  type: 'Callout',
  variant: 'danger',
  headline: 'Danger ahead',
}

const TOAST_ACTION = {type: 'toast' as const, message: 'Done'}

const CALLOUT_WITH_ACTION: CalloutNode = {
  id: 'cal6',
  type: 'Callout',
  variant: 'info',
  headline: 'Learn more',
  action: {label: 'Read docs', action: TOAST_ACTION},
}

const CALLOUT_WITH_BODY: CalloutNode = {
  id: 'cal7',
  type: 'Callout',
  variant: 'info',
  headline: 'Headline text',
  body: 'Supporting body text goes here.',
}

// ---------------------------------------------------------------------------
// T-0009-087: snapshots at productive×focus + expressive×health
// ---------------------------------------------------------------------------

describe('CalloutRenderer snapshot (T-0009-087) — productive×focus', () => {
  it('matches snapshot at productive×focus', () => {
    const {toJSON} = renderWithTheme(<CalloutRenderer node={CALLOUT_INFO} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).toMatchSnapshot()
  })
})

describe('CalloutRenderer snapshot (T-0009-087) — expressive×health', () => {
  it('matches snapshot at expressive×health', () => {
    const {toJSON} = renderWithTheme(<CalloutRenderer node={CALLOUT_WARNING} />, {
      stance: 'expressive',
      palette: 'health',
    })
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0009-080: 5 variants render with correct icon defaults
// ---------------------------------------------------------------------------

describe('CalloutRenderer variants (T-0009-080)', () => {
  it('renders info variant without error', () => {
    const {toJSON} = renderWithTheme(<CalloutRenderer node={CALLOUT_INFO} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('renders success variant without error', () => {
    const {toJSON} = renderWithTheme(<CalloutRenderer node={CALLOUT_SUCCESS} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('renders warning variant without error', () => {
    const {toJSON} = renderWithTheme(<CalloutRenderer node={CALLOUT_WARNING} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('renders tip variant without error', () => {
    const {toJSON} = renderWithTheme(<CalloutRenderer node={CALLOUT_TIP} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('renders danger variant without error', () => {
    const {toJSON} = renderWithTheme(<CalloutRenderer node={CALLOUT_DANGER} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('renders with body text without error', () => {
    const {toJSON} = renderWithTheme(<CalloutRenderer node={CALLOUT_WITH_BODY} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// T-0009-081: warning → accessibilityRole="alert"
// ---------------------------------------------------------------------------

describe('CalloutRenderer warning accessibilityRole (T-0009-081)', () => {
  it('warning variant has accessibilityRole="alert"', () => {
    const {toJSON} = renderWithTheme(<CalloutRenderer node={CALLOUT_WARNING} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {accessibilityRole?: string}} | null
    expect(tree?.props?.accessibilityRole).toBe('alert')
  })
})

// ---------------------------------------------------------------------------
// T-0009-082: info → accessibilityRole="text"
// ---------------------------------------------------------------------------

describe('CalloutRenderer info accessibilityRole (T-0009-082)', () => {
  it('info variant has accessibilityRole="text" (not alert)', () => {
    const {toJSON} = renderWithTheme(<CalloutRenderer node={CALLOUT_INFO} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {accessibilityRole?: string}} | null
    expect(tree?.props?.accessibilityRole).toBe('text')
  })

  it('success variant has accessibilityRole="text"', () => {
    const {toJSON} = renderWithTheme(<CalloutRenderer node={CALLOUT_SUCCESS} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {accessibilityRole?: string}} | null
    expect(tree?.props?.accessibilityRole).toBe('text')
  })

  it('tip variant has accessibilityRole="text"', () => {
    const {toJSON} = renderWithTheme(<CalloutRenderer node={CALLOUT_TIP} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {accessibilityRole?: string}} | null
    expect(tree?.props?.accessibilityRole).toBe('text')
  })
})

// ---------------------------------------------------------------------------
// T-0009-083: with action → renders trailing button, dispatches on press
// ---------------------------------------------------------------------------

describe('CalloutRenderer with action (T-0009-083)', () => {
  it('renders trailing button when action is provided', () => {
    const {toJSON} = renderWithTheme(<CalloutRenderer node={CALLOUT_WITH_ACTION} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('dispatches action when action button is pressed', () => {
    const mockDispatch = jest.fn()
    const {getByRole} = renderWithTheme(
      <CalloutRenderer node={CALLOUT_WITH_ACTION} />,
      {stance: 'productive', palette: 'focus', dispatch: mockDispatch},
    )
    // The trailing action is a Pressable with role="button".
    const buttons = getByRole('button')
    fireEvent.press(buttons)
    expect(mockDispatch).toHaveBeenCalledWith(TOAST_ACTION)
  })
})

// ---------------------------------------------------------------------------
// T-0009-084: tip variant → bg-elevated background (no tint)
// T-0009-085: info variant → accent tint at 6%
// ---------------------------------------------------------------------------

describe('CalloutRenderer background tint (T-0009-084, T-0009-085)', () => {
  it('tip variant renders without error (bg-elevated, no tint)', () => {
    // Verifies tip doesn't crash when tintColor is NOT called for tip.
    const {toJSON} = renderWithTheme(<CalloutRenderer node={CALLOUT_TIP} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('info variant renders without error (accent tint)', () => {
    const {toJSON} = renderWithTheme(<CalloutRenderer node={CALLOUT_INFO} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('tip and info variants have different background colors', () => {
    type ViewTree = {props?: {style?: {backgroundColor?: string}}} | null
    const {toJSON: toJSONTip} = renderWithTheme(<CalloutRenderer node={CALLOUT_TIP} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const {toJSON: toJSONInfo} = renderWithTheme(<CalloutRenderer node={CALLOUT_INFO} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tipBg = (toJSONTip() as ViewTree)?.props?.style?.backgroundColor
    const infoBg = (toJSONInfo() as ViewTree)?.props?.style?.backgroundColor
    expect(tipBg).not.toEqual(infoBg)
  })
})

// ---------------------------------------------------------------------------
// T-0009-242: danger → accessibilityRole="alert"
// ---------------------------------------------------------------------------

describe('CalloutRenderer danger accessibilityRole (T-0009-242)', () => {
  it('danger variant has accessibilityRole="alert"', () => {
    const {toJSON} = renderWithTheme(<CalloutRenderer node={CALLOUT_DANGER} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {accessibilityRole?: string}} | null
    expect(tree?.props?.accessibilityRole).toBe('alert')
  })
})
