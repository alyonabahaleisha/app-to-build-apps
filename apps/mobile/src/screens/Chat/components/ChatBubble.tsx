/**
 * ChatBubble — renders a single message bubble.
 *
 * Variants:
 *   - user: right-aligned, primary bg, primaryFg text.
 *   - assistant: left-aligned, bg.subtle bg, primary text.
 *   - error: left-aligned, destructive bg, destructiveFg text.
 */
import {StyleSheet, Text, View} from 'react-native'

import {useTheme} from '#/theme'

export type ChatBubbleVariant = 'user' | 'assistant' | 'error'

interface Props {
  variant: ChatBubbleVariant
  text: string
  testID?: string
}

export function ChatBubble({variant, text, testID}: Props) {
  const theme = useTheme()

  const isUser = variant === 'user'
  const isError = variant === 'error'

  const bgColor = isUser
    ? theme.palette.primary
    : isError
      ? theme.palette.destructive
      : theme.palette.bg.subtle

  const textColor = isUser
    ? theme.palette.primaryFg
    : isError
      ? theme.palette.destructiveFg
      : theme.palette.text.primary

  return (
    <View
      style={[
        styles.bubble,
        {
          backgroundColor: bgColor,
          borderRadius: theme.radius.md,
          alignSelf: isUser ? 'flex-end' : 'flex-start',
        },
      ]}
      testID={testID}
      accessibilityRole="text"
      accessibilityLabel={isError ? `Error: ${text}` : text}
    >
      <Text style={[theme.typography.body, {color: textColor}]}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '80%',
  },
})
