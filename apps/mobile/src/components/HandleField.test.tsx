/**
 * HandleField — unit tests.
 *
 * Covers T-0002-153, T-0002-154, T-0002-159, T-0002-162.
 */
import {render, fireEvent} from '@testing-library/react-native'
import React from 'react'

import {AppShellThemeProvider} from '#/theme/AppShellThemeProvider'
import {HandleField} from './HandleField'

function renderWithTheme(ui: React.ReactElement) {
  return render(<AppShellThemeProvider>{ui}</AppShellThemeProvider>)
}

describe('HandleField', () => {
  // T-0002-154: inline indicators ✓/✗
  describe('validation state indicators', () => {
    it('shows "✓ Available" helper text when validationState is available', () => {
      const {getByTestId} = renderWithTheme(
        <HandleField value="alice" onChange={jest.fn()} validationState="available" />,
      )
      const helper = getByTestId('handle-field-helper')
      expect(helper.props.children).toBe('✓ Available')
    })

    it('shows "✗ Handle taken" helper text when validationState is taken', () => {
      const {getByTestId} = renderWithTheme(
        <HandleField value="alice" onChange={jest.fn()} validationState="taken" />,
      )
      const helper = getByTestId('handle-field-helper')
      expect(helper.props.children).toBe('✗ Handle taken — try another')
    })

    it('shows "✗ Handle reserved" helper text when validationState is reserved', () => {
      const {getByTestId} = renderWithTheme(
        <HandleField value="admin" onChange={jest.fn()} validationState="reserved" />,
      )
      const helper = getByTestId('handle-field-helper')
      expect(helper.props.children).toBe('✗ Handle reserved — try another')
    })

    it('shows regex-fail copy when validationState is invalid', () => {
      const {getByTestId} = renderWithTheme(
        <HandleField value="x" onChange={jest.fn()} validationState="invalid" />,
      )
      const helper = getByTestId('handle-field-helper')
      expect(helper.props.children).toBe('Use 3–20 lowercase letters, numbers, or dashes.')
    })

    it('shows "Checking…" when validationState is checking', () => {
      const {getByTestId} = renderWithTheme(
        <HandleField value="alice" onChange={jest.fn()} validationState="checking" />,
      )
      const helper = getByTestId('handle-field-helper')
      expect(helper.props.children).toBe('Checking…')
    })

    it('shows default helper text when validationState is idle', () => {
      const {getByTestId} = renderWithTheme(
        <HandleField value="" onChange={jest.fn()} validationState="idle" />,
      )
      const helper = getByTestId('handle-field-helper')
      expect(helper.props.children).toBe('3–20 chars · letters, numbers, dashes')
    })
  })

  // T-0002-154: errorMessage prop overrides default helper
  it('shows errorMessage prop over default helper text', () => {
    const {getByTestId} = renderWithTheme(
      <HandleField
        value="alice"
        onChange={jest.fn()}
        validationState="taken"
        errorMessage="Handle taken — that one was just claimed. Try another."
      />,
    )
    const helper = getByTestId('handle-field-helper')
    expect(helper.props.children).toBe('Handle taken — that one was just claimed. Try another.')
  })

  // T-0002-162: a11y hint describes immutability
  it('has accessibilityHint describing immutability on the text input', () => {
    const {getByTestId} = renderWithTheme(
      <HandleField value="alice" onChange={jest.fn()} validationState="idle" />,
    )
    const input = getByTestId('handle-field-input')
    expect(input.props.accessibilityHint).toContain("can't change")
  })

  // T-0002-162: a11y label present
  it('has accessibilityLabel "Your handle" on the text input', () => {
    const {getByTestId} = renderWithTheme(
      <HandleField value="" onChange={jest.fn()} validationState="idle" />,
    )
    const input = getByTestId('handle-field-input')
    expect(input.props.accessibilityLabel).toBe('Your handle')
  })

  // T-0002-159: accessibilityLiveRegion on helper
  it('has accessibilityLiveRegion="polite" on the helper text', () => {
    const {getByTestId} = renderWithTheme(
      <HandleField value="alice" onChange={jest.fn()} validationState="available" />,
    )
    const helper = getByTestId('handle-field-helper')
    expect(helper.props.accessibilityLiveRegion).toBe('polite')
  })

  // T-0002-153: onChange fires on text change
  it('calls onChange with the new value', () => {
    const onChange = jest.fn()
    const {getByTestId} = renderWithTheme(
      <HandleField value="" onChange={onChange} validationState="idle" />,
    )
    const input = getByTestId('handle-field-input')
    fireEvent.changeText(input, 'alice')
    expect(onChange).toHaveBeenCalledWith('alice')
  })

  // Custom testID propagation
  it('respects testID prop for the text input', () => {
    const {getByTestId} = renderWithTheme(
      <HandleField
        value=""
        onChange={jest.fn()}
        validationState="idle"
        testID="custom-handle-input"
      />,
    )
    expect(getByTestId('custom-handle-input')).toBeTruthy()
  })
})
