/**
 * NoNav tests
 * T-0006-162: Renderer with navigation:'none' mounts NoNav with single screen
 */
import React from 'react'
import {NoNav} from './NoNav'
import {renderWithTheme} from '../__test-utils__/renderWithTheme'
import type {Spec} from '@app-creator/protocol'
import {SpecSchema} from '@app-creator/protocol'

const NONE_NAV_SPEC: Spec = {
  version: 1,
  archetype: 'ListCRUD',
  stance: 'productive',
  palette: 'focus',
  coverIcon: 'list',
  navigation: 'none',
  initialScreenId: 's1',
  screens: [
    {
      id: 's1',
      title: 'Main',
      root: {id: 'h1', type: 'Heading', text: 'Hello', level: 1},
    },
  ],
  collections: [],
  initialState: {},
}

describe('NoNav (T-0006-162)', () => {
  it('validates against SpecSchema with navigation: none', () => {
    expect(SpecSchema.safeParse(NONE_NAV_SPEC).success).toBe(true)
  })

  it('renders the single screen root without throwing', () => {
    const {toJSON} = renderWithTheme(<NoNav spec={NONE_NAV_SPEC} />)
    expect(toJSON()).not.toBeNull()
  })

  it('renders heading text from the first screen', () => {
    const {getByText} = renderWithTheme(<NoNav spec={NONE_NAV_SPEC} />)
    expect(getByText('Hello')).toBeTruthy()
  })

  it('returns null if spec has no screens (defensive guard)', () => {
    // Bypass schema validation for the defensive-guard test.
    const emptySpec = {...NONE_NAV_SPEC, screens: []} as unknown as Spec
    const {toJSON} = renderWithTheme(<NoNav spec={emptySpec} />)
    expect(toJSON()).toBeNull()
  })

  it('snapshot — NoNav productive×focus', () => {
    const {toJSON} = renderWithTheme(<NoNav spec={NONE_NAV_SPEC} />)
    expect(toJSON()).toMatchSnapshot()
  })
})
