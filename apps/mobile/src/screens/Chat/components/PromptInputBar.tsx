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

import {useTheme} from '#/theme'
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
  const theme = useTheme()
  const charCount = value.length
  const isOverLimit = charCount > MAX_CHARS
  const canSend = charCount >= 1 && charCount <= MAX_CHARS && !isLoading

  const counterColor = isOverLimit ? theme.palette.text.destructive : theme.palette.text.muted

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.palette.bg.surface,
          borderTopColor: theme.palette.border.subtle,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
      ]}
      testID={testID}
    >
      <View style={styles.inputRow}>
        <TextInput
          style={[
            styles.input,
            theme.typography.body,
            {
              color: theme.palette.text.primary,
              backgroundColor: theme.palette.bg.subtle,
              borderRadius: theme.radius.md,
              borderColor: theme.palette.border.subtle,
            },
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={chatCopy.inputPlaceholder}
          placeholderTextColor={theme.palette.text.muted}
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
            color={theme.palette.primary}
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
                backgroundColor: canSend ? theme.palette.primary : theme.palette.bg.subtle,
                borderRadius: theme.radius.md,
              },
            ]}
            testID="send-button"
          >
            <Text
              style={[
                theme.typography.bodyStrong,
                {color: canSend ? theme.palette.primaryFg : theme.palette.text.muted},
              ]}
            >
              {chatCopy.sendButtonLabel}
            </Text>
          </Pressable>
        )}
      </View>
      {charCount > 0 && (
        <Text
          style={[theme.typography.caption, {color: counterColor, alignSelf: 'flex-end', marginRight: 4}]}
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
