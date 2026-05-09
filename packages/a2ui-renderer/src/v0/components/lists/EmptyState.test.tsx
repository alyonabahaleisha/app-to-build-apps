/**
 * EmptyState tests
 *
 * T-0006-113: snapshot at productive×focus
 * T-0006-114: snapshot at expressive×health
 * Additional: action dispatch, accessibility, no-action variant
 */
import React from 'react'
import {fireEvent} from '@testing-library/react-native'
import type {Node} from '@app-creator/protocol'
import {renderWithTheme} from '../../__test-utils__/renderWithTheme'
import {EmptyStateRenderer} from './EmptyState'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type EmptyStateNode = Extract<Node, {type: 'EmptyState'}>

const EMPTY_STATE_FULL: EmptyStateNode = {
  id: 'es1',
  type: 'EmptyState',
  icon: 'list',
  headline: 'No workouts yet',
  body: 'Add your first workout to get started.',
  actionLabel: 'Add workout',
  action: {type: 'addItem', collection: 'workouts', item: {name: 'New workout', reps: 0}},
}

const EMPTY_STATE_MINIMAL: EmptyStateNode = {
  id: 'es2',
  type: 'EmptyState',
  icon: 'star',
  headline: 'No items',
}

const EMPTY_STATE_WITH_BODY_NO_ACTION: EmptyStateNode = {
  id: 'es3',
  type: 'EmptyState',
  icon: 'dumbbell',
  headline: 'No exercises tracked',
  body: 'Your workouts will appear here.',
}

const EMPTY_STATE_UNICODE: EmptyStateNode = {
  id: 'es4',
  type: 'EmptyState',
  icon: 'book',
  headline: 'Ничего не добавлено',  // Russian
  body: '记录您的第一项内容。',  // Chinese
  actionLabel: 'إضافة',  // Arabic
  action: {type: 'toast', message: 'Added', tone: 'success'},
}

// ---------------------------------------------------------------------------
// T-0006-113: snapshot at productive×focus
// ---------------------------------------------------------------------------

describe('EmptyStateRenderer snapshot (T-0006-113) — productive×focus', () => {
  it('matches snapshot at productive×focus', () => {
    const {toJSON} = renderWithTheme(
      <EmptyStateRenderer node={EMPTY_STATE_FULL} />,
      {stance: 'productive', palette: 'focus'},
    )
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0006-114: snapshot at expressive×health
// ---------------------------------------------------------------------------

describe('EmptyStateRenderer snapshot (T-0006-114) — expressive×health', () => {
  it('matches snapshot at expressive×health', () => {
    const {toJSON} = renderWithTheme(
      <EmptyStateRenderer node={EMPTY_STATE_FULL} />,
      {stance: 'expressive', palette: 'health'},
    )
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// Content rendering
// ---------------------------------------------------------------------------

describe('EmptyStateRenderer content (additional)', () => {
  it('renders headline text', () => {
    const {getByText} = renderWithTheme(
      <EmptyStateRenderer node={EMPTY_STATE_FULL} />,
      {stance: 'productive', palette: 'focus'},
    )
    expect(getByText('No workouts yet')).toBeTruthy()
  })

  it('renders body text when provided', () => {
    const {getByText} = renderWithTheme(
      <EmptyStateRenderer node={EMPTY_STATE_FULL} />,
      {stance: 'productive', palette: 'focus'},
    )
    expect(getByText('Add your first workout to get started.')).toBeTruthy()
  })

  it('renders action button when actionLabel and action are provided', () => {
    const {getByRole} = renderWithTheme(
      <EmptyStateRenderer node={EMPTY_STATE_FULL} />,
      {stance: 'productive', palette: 'focus'},
    )
    expect(getByRole('button')).toBeTruthy()
  })

  it('does not render action button when actionLabel is absent', () => {
    const {queryByRole} = renderWithTheme(
      <EmptyStateRenderer node={EMPTY_STATE_WITH_BODY_NO_ACTION} />,
      {stance: 'productive', palette: 'focus'},
    )
    expect(queryByRole('button')).toBeNull()
  })

  it('dispatches action when action button is pressed', () => {
    const mockDispatch = jest.fn()
    const {getByRole} = renderWithTheme(
      <EmptyStateRenderer node={EMPTY_STATE_FULL} />,
      {stance: 'productive', palette: 'focus', dispatch: mockDispatch},
    )

    fireEvent.press(getByRole('button'))

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'addItem',
      collection: 'workouts',
      item: {name: 'New workout', reps: 0},
    })
  })

  it('renders minimal variant (icon + headline only) without crash', () => {
    const {getByText, queryByRole} = renderWithTheme(
      <EmptyStateRenderer node={EMPTY_STATE_MINIMAL} />,
      {stance: 'productive', palette: 'focus'},
    )
    expect(getByText('No items')).toBeTruthy()
    expect(queryByRole('button')).toBeNull()
  })

  it('renders headline with accessibilityRole="header"', () => {
    const {getByRole} = renderWithTheme(
      <EmptyStateRenderer node={EMPTY_STATE_MINIMAL} />,
      {stance: 'productive', palette: 'focus'},
    )
    expect(getByRole('header')).toBeTruthy()
  })

  it('renders Unicode content correctly', () => {
    const {getByText} = renderWithTheme(
      <EmptyStateRenderer node={EMPTY_STATE_UNICODE} />,
      {stance: 'productive', palette: 'focus'},
    )
    expect(getByText('Ничего не добавлено')).toBeTruthy()
    expect(getByText('记录您的第一项内容。')).toBeTruthy()
    expect(getByText('إضافة')).toBeTruthy()
  })
})
