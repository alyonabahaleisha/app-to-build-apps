/**
 * TextInput — app-shell variant. Distinct from the A2UI catalog `TextInput`
 * (which lives in `packages/a2ui-renderer/`). Per ARCHITECTURE.md §6.
 *
 * ADR-0011 Step 5: migrated from M1 useTheme() → useAppShellTheme().
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

import {useAppShellTheme} from '#/theme/AppShellThemeProvider'

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
  const theme = useAppShellTheme()
  const [focused, setFocused] = useState(false)
  const showError = !!error

  const borderColor = showError
    ? theme.danger
    : focused
      ? theme.accent
      : theme.divider

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
      <Text style={[styles.label, captionStyle, {color: theme['fg-muted']}]}>{label}</Text>
      <View
        style={[
          styles.inputWrap,
          {
            borderColor,
            borderRadius: theme.radii['radius-md'],
            backgroundColor: theme.bg,
          },
          focused && !showError ? {shadowColor: theme.accent} : null,
          focused && !showError ? styles.focusGlow : null,
        ]}
      >
        <RNTextInput
          value={value}
          onChangeText={onChangeText}
          accessibilityLabel={accessibilityLabel}
          placeholder={placeholder}
          placeholderTextColor={theme['fg-muted']}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          multiline={multiline}
          editable={editable}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.input, bodyStyle, {color: theme.fg}, multiline ? styles.multiline : null]}
          testID={testID}
        />
      </View>
      {showError ? (
        <Text
          style={[styles.error, captionStyle, {color: theme.danger}]}
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
    padding: 0,
  },
  multiline: {minHeight: 24 * 3, textAlignVertical: 'top'},
  error: {marginTop: 4},
})
