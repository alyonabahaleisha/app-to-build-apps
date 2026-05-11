/**
 * HandleField — composite input for handle selection.
 *
 * Layout: row with `@` prefix (non-editable, muted) + TextInput.
 * Below: helper text that transitions based on `validationState`.
 *
 * Per Sable's UX doc §Screen 5 (new): Publish bottom-sheet and
 * Notes for Colby #13 — "Just compose a View (with @) + TextInput +
 * a state-aware footer Text."
 *
 * Per a11y requirements (T-0002-162): handle field has
 * `accessibilityHint` describing immutability.
 */
import {StyleSheet, Text, TextInput, View} from 'react-native'

import type {ResolvedTheme} from '@app-creator/design-system'
import {useAppShellTheme} from '#/theme/AppShellThemeProvider'

export type HandleValidationState =
  | 'idle'
  | 'invalid'
  | 'reserved'
  | 'checking'
  | 'available'
  | 'taken'

interface Props {
  value: string
  onChange: (v: string) => void
  validationState: HandleValidationState
  errorMessage?: string
  autoFocus?: boolean
  testID?: string
}

export function HandleField({
  value,
  onChange,
  validationState,
  errorMessage,
  autoFocus = false,
  testID,
}: Props) {
  const theme = useAppShellTheme()

  const borderColor = getBorderColor(validationState, theme)

  const bodyStyle = {
    fontSize: theme.type.body.size,
    fontWeight: String(theme.type.body.weight) as '400',
    lineHeight: theme.type.body.lineHeight,
  }
  const captionStyle = {
    fontSize: theme.type.caption.size,
    fontWeight: String(theme.type.caption.weight) as '400',
    lineHeight: theme.type.caption.lineHeight,
  }

  return (
    <View style={styles.root}>
      {/* Row: @ prefix + input */}
      <View
        style={[
          styles.inputRow,
          {
            borderColor,
            borderRadius: theme.radii['radius-md'],
            backgroundColor: theme.bg,
          },
        ]}
      >
        <Text
          style={[styles.prefix, bodyStyle, {color: theme['fg-muted']}]}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          @
        </Text>
        <TextInput
          value={value}
          onChangeText={onChange}
          autoFocus={autoFocus}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          keyboardType="default"
          accessibilityLabel="Your handle"
          accessibilityHint="3 to 20 lowercase letters, numbers, or dashes. You can't change this later."
          style={[styles.input, bodyStyle, {color: theme.fg}]}
          testID={testID ?? 'handle-field-input'}
          placeholderTextColor={theme['fg-muted']}
          placeholder="yourhandle"
        />
      </View>

      {/* Helper / validation text */}
      <Text
        style={[
          styles.helper,
          captionStyle,
          {color: getHelperColor(validationState, theme)},
        ]}
        accessibilityLiveRegion="polite"
        testID="handle-field-helper"
      >
        {errorMessage ?? getHelperText(validationState)}
      </Text>
    </View>
  )
}

function getBorderColor(state: HandleValidationState, theme: ResolvedTheme): string {
  switch (state) {
    case 'available':
      return '#16a34a' // green — not a theme token, Sable-spec for valid
    case 'invalid':
    case 'reserved':
    case 'taken':
      return theme.danger
    default:
      return theme.divider
  }
}

function getHelperColor(state: HandleValidationState, theme: ResolvedTheme): string {
  switch (state) {
    case 'available':
      return '#16a34a'
    case 'invalid':
    case 'reserved':
    case 'taken':
      return theme.danger
    default:
      return theme['fg-muted']
  }
}

function getHelperText(state: HandleValidationState): string {
  switch (state) {
    case 'available':
      return '✓ Available'
    case 'checking':
      return 'Checking…'
    case 'taken':
      return '✗ Handle taken — try another'
    case 'reserved':
      return '✗ Handle reserved — try another'
    case 'invalid':
      return 'Use 3–20 lowercase letters, numbers, or dashes.'
    case 'idle':
    default:
      return '3–20 chars · letters, numbers, dashes'
  }
}

const styles = StyleSheet.create({
  root: {gap: 4},
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  prefix: {
    marginRight: 2,
  },
  input: {
    flex: 1,
    padding: 0, // RN default padding fights the wrapper
  },
  helper: {},
})
