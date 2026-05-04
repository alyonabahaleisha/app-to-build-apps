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

import {useTheme} from '#/theme'

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
  const theme = useTheme()

  const borderColor = getBorderColor(validationState, theme)

  return (
    <View style={styles.root}>
      {/* Row: @ prefix + input */}
      <View
        style={[
          styles.inputRow,
          {
            borderColor,
            borderRadius: theme.radius.md,
            backgroundColor: theme.palette.bg.surface,
          },
        ]}
      >
        <Text
          style={[
            styles.prefix,
            theme.typography.body,
            {color: theme.palette.text.muted},
          ]}
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
          style={[
            styles.input,
            theme.typography.body,
            {color: theme.palette.text.primary},
          ]}
          testID={testID ?? 'handle-field-input'}
          placeholderTextColor={theme.palette.text.muted}
          placeholder="yourhandle"
        />
      </View>

      {/* Helper / validation text */}
      <Text
        style={[
          styles.helper,
          theme.typography.caption,
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

function getBorderColor(
  state: HandleValidationState,
  theme: ReturnType<typeof useTheme>,
): string {
  switch (state) {
    case 'available':
      return '#16a34a' // green — not a theme token, Sable-spec for valid
    case 'invalid':
    case 'reserved':
    case 'taken':
      return theme.palette.destructive
    default:
      return theme.palette.border.subtle
  }
}

function getHelperColor(
  state: HandleValidationState,
  theme: ReturnType<typeof useTheme>,
): string {
  switch (state) {
    case 'available':
      return '#16a34a'
    case 'invalid':
    case 'reserved':
    case 'taken':
      return theme.palette.text.destructive
    default:
      return theme.palette.text.muted
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
