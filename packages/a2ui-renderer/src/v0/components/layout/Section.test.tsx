/**
 * SectionRenderer tests
 * T-0006-041: renders at productive×focus
 * T-0006-042: renders at expressive×health
 * T-0006-050: snapshot at productive×focus
 * T-0006-055: snapshot at expressive×health
 */
import React from 'react'
import {renderWithTheme} from '../../__test-utils__/renderWithTheme'
import type {Node} from '@app-creator/protocol'
import {SectionRenderer} from './Section'

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const SECTION_NO_TITLE: Extract<Node, {type: 'Section'}> = {
  id: 'section1',
  type: 'Section',
  children: [],
}

const SECTION_WITH_TITLE: Extract<Node, {type: 'Section'}> = {
  id: 'section2',
  type: 'Section',
  title: 'My Section',
  caption: 'A brief description',
  children: [
    {id: 'stack1', type: 'Stack', children: []},
  ],
}

// ---------------------------------------------------------------------------
// T-0006-041: renders at productive×focus
// ---------------------------------------------------------------------------

describe('SectionRenderer (T-0006-041) — productive×focus', () => {
  it('renders without error at productive×focus', () => {
    const {toJSON} = renderWithTheme(<SectionRenderer node={SECTION_NO_TITLE} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('renders title and caption text when provided', () => {
    const {getByText} = renderWithTheme(<SectionRenderer node={SECTION_WITH_TITLE} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(getByText('My Section')).toBeTruthy()
    expect(getByText('A brief description')).toBeTruthy()
  })

  it('does not render title element when title is undefined', () => {
    const {queryByRole} = renderWithTheme(<SectionRenderer node={SECTION_NO_TITLE} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(queryByRole('header')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// T-0006-042: renders at expressive×health
// ---------------------------------------------------------------------------

describe('SectionRenderer (T-0006-042) — expressive×health', () => {
  it('renders without error at expressive×health', () => {
    const {toJSON} = renderWithTheme(<SectionRenderer node={SECTION_WITH_TITLE} />, {
      stance: 'expressive',
      palette: 'health',
    })
    expect(toJSON()).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// T-0006-050: snapshot at productive×focus
// ---------------------------------------------------------------------------

describe('SectionRenderer snapshot (T-0006-050) — productive×focus', () => {
  it('matches snapshot at productive×focus', () => {
    const {toJSON} = renderWithTheme(<SectionRenderer node={SECTION_WITH_TITLE} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0006-055: snapshot at expressive×health
// ---------------------------------------------------------------------------

describe('SectionRenderer snapshot (T-0006-055) — expressive×health', () => {
  it('matches snapshot at expressive×health', () => {
    const {toJSON} = renderWithTheme(<SectionRenderer node={SECTION_WITH_TITLE} />, {
      stance: 'expressive',
      palette: 'health',
    })
    expect(toJSON()).toMatchSnapshot()
  })
})
