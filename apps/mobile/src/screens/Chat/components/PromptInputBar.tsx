/**
 * PromptInputBar — sticky input at the bottom of the Chat screen.
 *
 * Features:
 *   - Character counter (shows when >0 chars, red when at limit).
 *   - Send button enabled only when 1 ≤ len ≤ 2000.
 *   - During generation (isLoading=true): input disabled, Send replaced
 *     with an ActivityIndicator.
 */
import {ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View} from 'react-native'

import {useAppShellTheme} from '#/theme/AppShellThemeProvider'
import {chatCopy} from '#/screens/Chat/copy'

const MAX_CHARS = chatCopy.characterLimit

interface Props {
  value: string
  onChangeText: (text: string) => void
  onSend: () => void
  isLoading: boolean
  testID?: string
}

export function PromptInputBar({value, onChangeText, onSend, isLoading, testID}: Props) {
  const theme = useAppShellTheme()
  const charCount = value.length
  const isOverLimit = charCount > MAX_CHARS
  const canSend = charCount >= 1 && charCount <= MAX_CHARS && !isLoading

  const counterColor = isOverLimit ? theme.danger : theme['fg-muted']
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
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.bg,
          borderTopColor: theme.divider,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
      ]}
      testID={testID}
    >
      <View style={styles.inputRow}>
        <TextInput
          style={[
            styles.input,
            bodyStyle,
            {
              color: theme.fg,
              backgroundColor: theme['bg-elevated'],
              borderRadius: theme.radii['radius-md'],
              borderColor: theme.divider,
            },
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={chatCopy.inputPlaceholder}
          placeholderTextColor={theme['fg-muted']}
          multiline
          maxLength={MAX_CHARS + 1} // Allow typing 1 over so we show the error.
          editable={!isLoading}
          accessibilityLabel="Describe your app"
          accessibilityHint={`Up to ${MAX_CHARS} characters`}
          testID="prompt-input"
        />
        {isLoading ? (
          <ActivityIndicator
            size="small"
            color={theme.accent}
            style={styles.sendArea}
            testID="send-loading-indicator"
          />
        ) : (
          <Pressable
            onPress={canSend ? onSend : undefined}
            accessibilityRole="button"
            accessibilityLabel={chatCopy.sendButtonLabel}
            accessibilityState={{disabled: !canSend}}
            disabled={!canSend}
            style={[
              styles.sendArea,
              styles.sendButton,
              {
                backgroundColor: canSend ? theme.accent : theme['bg-elevated'],
                borderRadius: theme.radii['radius-md'],
              },
            ]}
            testID="send-button"
          >
            <Text
              style={[
                {
                  fontSize: theme.type.body.size,
                  fontWeight: '600' as const,
                  lineHeight: theme.type.body.lineHeight,
                },
                {color: canSend ? theme['accent-fg'] : theme['fg-muted']},
              ]}
            >
              {chatCopy.sendButtonLabel}
            </Text>
          </Pressable>
        )}
      </View>
      {charCount > 0 && (
        <Text
          style={[
            captionStyle,
            {color: counterColor, alignSelf: 'flex-end', marginRight: 4},
          ]}
          testID="char-counter"
        >
          {charCount}/{MAX_CHARS}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: 120,
    minHeight: 44,
  },
  sendArea: {
    height: 44,
    width: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButton: {},
})
