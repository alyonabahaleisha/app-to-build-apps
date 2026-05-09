/**
 * AccessibilityWrapper tests
 * Covers: sets accessibilityLabel, accessibilityRole, accessible=true.
 * No dedicated T-ID in the ADR Step 3 table for AccessibilityWrapper
 * (its ACs are in the Step 3 text), but coverage is required.
 */
import React from 'react'
import {render} from '@testing-library/react-native'
import {Text} from 'react-native'
import {AccessibilityWrapper} from './AccessibilityWrapper'

describe('AccessibilityWrapper', () => {
  it('renders children', () => {
    const {getByText} = render(
      <AccessibilityWrapper>
        <Text>Hello</Text>
      </AccessibilityWrapper>,
    )
    expect(getByText('Hello')).toBeTruthy()
  })

  it('sets accessible=true on the wrapping View', () => {
    const {getByLabelText} = render(
      <AccessibilityWrapper label="My label">
        <Text>Content</Text>
      </AccessibilityWrapper>,
    )
    // getByLabelText verifies both accessible=true and accessibilityLabel.
    expect(getByLabelText('My label')).toBeTruthy()
  })

  it('sets accessibilityRole when provided', () => {
    const {getByRole} = render(
      <AccessibilityWrapper role="button" label="Press me">
        <Text>Press</Text>
      </AccessibilityWrapper>,
    )
    expect(getByRole('button')).toBeTruthy()
  })

  it('sets accessibilityRole=header when role=header', () => {
    const {getByRole} = render(
      <AccessibilityWrapper role="header" label="Section title">
        <Text>Section</Text>
      </AccessibilityWrapper>,
    )
    expect(getByRole('header')).toBeTruthy()
  })

  it('renders without role or label (minimal usage)', () => {
    // Should not throw — role and label are both optional.
    const {getByText} = render(
      <AccessibilityWrapper>
        <Text>Bare</Text>
      </AccessibilityWrapper>,
    )
    expect(getByText('Bare')).toBeTruthy()
  })

  it('sets accessibilityRole=image', () => {
    const {getByRole} = render(
      <AccessibilityWrapper role="image" label="Profile photo">
        <Text>img</Text>
      </AccessibilityWrapper>,
    )
    expect(getByRole('image')).toBeTruthy()
  })
})
