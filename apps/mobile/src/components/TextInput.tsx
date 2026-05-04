/**
 * TextInput — app-shell variant. Distinct from the A2UI catalog `TextInput`
 * (which lives in `packages/a2ui-renderer/`). Per ARCHITECTURE.md §6.
 *
 * Visual treatment per Sable's UX doc §A2UI Catalog Visual Treatment:
 * radius `md`, border.subtle, padding 12pt vertical / 14pt horizontal.
 * Focus state: border becomes primary, focus.ring outer glow. Multi-line
 * variant for chat-style inputs (5-line max).
 */
import {useState} from 'react'
import {
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps as RNTextInputProps,
} from 'react-native'

import {useTheme} from '#/theme'

interface Props {
  label: string
  value: string
  onChangeText: (text: string) => void
  accessibilityLabel: string
  placeholder?: string
  keyboardType?: KeyboardTypeOptions
  autoCapitalize?: RNTextInputProps['autoCapitalize']
  autoComplete?: RNTextInputProps['autoComplete']
  multiline?: boolean
  error?: string
  editable?: boolean
  testID?: string
}

export function TextInput({
  label,
  value,
  onChangeText,
  accessibilityLabel,
  placeholder,
  keyboardType,
  autoCapitalize,
  autoComplete,
  multiline = false,
  error,
  editable = true,
  testID,
}: Props) {
  const theme = useTheme()
  const [focused, setFocused] = useState(false)
  const showError = !!error

  const borderColor = showError
    ? theme.palette.destructive
    : focused
      ? theme.palette.primary
      : theme.palette.border.subtle

  return (
    <View style={styles.root}>
      <Text
        style={[
          styles.label,
          theme.typography.caption,
          {color: theme.palette.text.muted},
        ]}
      >
        {label}
      </Text>
      <View
        style={[
          styles.inputWrap,
          {
            borderColor,
            borderRadius: theme.radius.md,
            backgroundColor: theme.palette.bg.surface,
          },
          focused && !showError ? {shadowColor: theme.palette.focusRing} : null,
          focused && !showError ? styles.focusGlow : null,
        ]}
      >
        <RNTextInput
          value={value}
          onChangeText={onChangeText}
          accessibilityLabel={accessibilityLabel}
          placeholder={placeholder}
          placeholderTextColor={theme.palette.text.muted}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          multiline={multiline}
          editable={editable}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            styles.input,
            theme.typography.body,
            {color: theme.palette.text.primary},
            multiline ? styles.multiline : null,
          ]}
          testID={testID}
        />
      </View>
      {showError ? (
        <Text
          style={[
            styles.error,
            theme.typography.caption,
            {color: theme.palette.text.destructive},
          ]}
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {gap: 4},
  label: {marginBottom: 4},
  inputWrap: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  focusGlow: {
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  input: {
    minHeight: 24,
    padding: 0, // RN's default top/bottom padding fights the wrap.
  },
  multiline: {minHeight: 24 * 3, textAlignVertical: 'top'},
  error: {marginTop: 4},
})
