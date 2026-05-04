/**
 * EmailInput — wraps the shell `TextInput`, applies email-specific input
 * attrs (T-0001-094), and reports the trimmed value + format-validity to
 * the parent.
 *
 * Validation is intentionally minimal at the client (a single-character
 * sanity check + an `@` + a `.` after the `@`). The server is the
 * authority — see ADR Step 3 for the canonical email-format check via
 * Supabase. This client check just disables the Send button until the
 * input *might* be a real email.
 */
import {useCallback} from 'react'

import {TextInput} from '#/components/TextInput'

import {signInCopy} from '../copy'

interface Props {
  value: string
  onChange: (value: string, isValid: boolean) => void
  /** Show inline error styling + message — driven by the parent. */
  showError: boolean
  editable?: boolean
  testID?: string
}

// Anchored so leading/trailing junk fails. Whitespace handled separately by
// the parent's trim; this regex does not allow whitespace anywhere.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value)
}

export function EmailInput({value, onChange, showError, editable = true, testID}: Props) {
  const handleChange = useCallback(
    (raw: string) => {
      // T-0001-092: trim whitespace before validation. Storing the trimmed
      // value in parent state means the request body always carries the
      // clean version too.
      const trimmed = raw.trim()
      onChange(trimmed, isValidEmail(trimmed))
    },
    [onChange],
  )

  return (
    <TextInput
      label={signInCopy.emailLabel}
      value={value}
      onChangeText={handleChange}
      accessibilityLabel="Email address"
      placeholder={signInCopy.emailPlaceholder}
      keyboardType="email-address"
      autoCapitalize="none"
      autoComplete="email"
      editable={editable}
      error={showError ? signInCopy.emailInvalid : undefined}
      testID={testID}
    />
  )
}
