/**
 * ConditionalSection tests
 *
 * T-0006-129: snapshot at productive×focus
 * T-0006-130: snapshot at expressive×health
 * T-0006-137: showWhen='whenEmpty' hides children when collection has rows
 * T-0006-138: showWhen='whenNotEmpty' shows children when collection has rows
 */
import React from 'react'
import type {Node, Spec} from '@app-creator/protocol'
import {renderWithTheme} from '../../__test-utils__/renderWithTheme'
import {buildInitialRendererState} from '../../state/reducer'
import {ConditionalSectionRenderer} from './ConditionalSection'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type ConditionalSectionNode = Extract<Node, {type: 'ConditionalSection'}>

// A child node to place inside the ConditionalSection.
const CHILD_HEADING: Extract<Node, {type: 'Heading'}> = {
  id: 'h1',
  type: 'Heading',
  text: 'Visible child',
  level: 2,
}

const CONDITIONAL_WHEN_EMPTY: ConditionalSectionNode = {
  id: 'cs1',
  type: 'ConditionalSection',
  collectionId: 'items',
  showWhen: 'whenEmpty',
  children: [CHILD_HEADING],
}

const CONDITIONAL_WHEN_NOT_EMPTY: ConditionalSectionNode = {
  id: 'cs2',
  type: 'ConditionalSection',
  collectionId: 'items',
  showWhen: 'whenNotEmpty',
  children: [CHILD_HEADING],
}

// Spec with an empty 'items' collection (no seed data).
// Note: seedData requires min 1 row at schema level, so we use a placeholder
// and clear the runtime state via buildInitialRendererState (which respects
// the empty array at the JS level even though schema validation would reject it).
const SPEC_EMPTY_COLLECTION: Spec = {
  version: 1,
  archetype: 'ListCRUD',
  stance: 'productive',
  palette: 'focus',
  coverIcon: 'list',
  navigation: 'none',
  screens: [{id: 's1', root: {id: 'n1', type: 'Heading', text: 'T', level: 1}}],
  initialScreenId: 's1',
  collections: [
    {
      id: 'items',
      name: 'Items',
      fields: [{name: 'name', type: {type: 'string'} as const, required: true}],
      // Zero seed rows: buildInitialRendererState produces an empty collection.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      seedData: [] as any,
      syncMode: 'local' as const,
    },
  ],
  initialState: {},
}

// Spec with a populated 'items' collection (1 seed row).
const SPEC_POPULATED_COLLECTION: Spec = {
  ...SPEC_EMPTY_COLLECTION,
  collections: [
    {
      id: 'items',
      name: 'Items',
      fields: [{name: 'name', type: {type: 'string'} as const, required: true}],
      seedData: [{name: 'Apple'}],
      syncMode: 'local' as const,
    },
  ],
}

// ---------------------------------------------------------------------------
// T-0006-129: snapshot at productive×focus
// ---------------------------------------------------------------------------

describe('ConditionalSectionRenderer snapshot (T-0006-129) — productive×focus', () => {
  it('matches snapshot (whenNotEmpty, populated collection)', () => {
    const state = buildInitialRendererState(SPEC_POPULATED_COLLECTION)
    const {toJSON} = renderWithTheme(
      <ConditionalSectionRenderer node={CONDITIONAL_WHEN_NOT_EMPTY} />,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0006-130: snapshot at expressive×health
// ---------------------------------------------------------------------------

describe('ConditionalSectionRenderer snapshot (T-0006-130) — expressive×health', () => {
  it('matches snapshot (whenEmpty, empty collection)', () => {
    const state = buildInitialRendererState(SPEC_EMPTY_COLLECTION)
    const {toJSON} = renderWithTheme(
      <ConditionalSectionRenderer node={CONDITIONAL_WHEN_EMPTY} />,
      {stance: 'expressive', palette: 'health', rendererState: state},
    )
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0006-137: showWhen='whenEmpty' hides children when collection has rows
// ---------------------------------------------------------------------------

describe('ConditionalSectionRenderer (T-0006-137)', () => {
  it('showWhen=whenEmpty hides children when collection has rows', () => {
    const state = buildInitialRendererState(SPEC_POPULATED_COLLECTION)
    const {queryByText} = renderWithTheme(
      <ConditionalSectionRenderer node={CONDITIONAL_WHEN_EMPTY} />,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )
    // Child heading must NOT render — collection is not empty.
    expect(queryByText('Visible child')).toBeNull()
  })

  it('showWhen=whenEmpty shows children when collection is empty', () => {
    const state = buildInitialRendererState(SPEC_EMPTY_COLLECTION)
    const {getByText} = renderWithTheme(
      <ConditionalSectionRenderer node={CONDITIONAL_WHEN_EMPTY} />,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )
    expect(getByText('Visible child')).toBeTruthy()
  })

  it('showWhen=whenEmpty treats unknown collectionId as empty (shows children)', () => {
    // Use a state where the referenced collection does not exist.
    const state = buildInitialRendererState(SPEC_EMPTY_COLLECTION)
    // Reference a non-existent collection.
    const nodeWithUnknownId: ConditionalSectionNode = {
      ...CONDITIONAL_WHEN_EMPTY,
      collectionId: 'nonexistent',
    }
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    const {getByText} = renderWithTheme(
      <ConditionalSectionRenderer node={nodeWithUnknownId} />,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )
    // Unknown collection → treated as empty → whenEmpty shows children.
    expect(getByText('Visible child')).toBeTruthy()
    spy.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// T-0006-138: showWhen='whenNotEmpty' shows children when collection has rows
// ---------------------------------------------------------------------------

describe('ConditionalSectionRenderer (T-0006-138)', () => {
  it('showWhen=whenNotEmpty shows children when collection has rows', () => {
    const state = buildInitialRendererState(SPEC_POPULATED_COLLECTION)
    const {getByText} = renderWithTheme(
      <ConditionalSectionRenderer node={CONDITIONAL_WHEN_NOT_EMPTY} />,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )
    expect(getByText('Visible child')).toBeTruthy()
  })

  it('showWhen=whenNotEmpty hides children when collection is empty', () => {
    const state = buildInitialRendererState(SPEC_EMPTY_COLLECTION)
    const {queryByText} = renderWithTheme(
      <ConditionalSectionRenderer node={CONDITIONAL_WHEN_NOT_EMPTY} />,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )
    expect(queryByText('Visible child')).toBeNull()
  })
})
