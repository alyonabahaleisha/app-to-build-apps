/**
 * ChatBubble — renders a single message bubble.
 *
 * Variants:
 *   - user: right-aligned, primary bg, primaryFg text.
 *   - assistant: left-aligned, bg.subtle bg, primary text.
 *   - error: left-aligned, destructive bg, destructiveFg text.
 */
import {StyleSheet, Text, View} from 'react-native'

import {useAppShellTheme} from '#/theme/AppShellThemeProvider'

export type ChatBubbleVariant = 'user' | 'assistant' | 'error'

interface Props {
  variant: ChatBubbleVariant
  text: string
  testID?: string
}

export function ChatBubble({variant, text, testID}: Props) {
  const theme = useAppShellTheme()

  const isUser = variant === 'user'
  const isError = variant === 'error'

  const bgColor = isUser
    ? theme.accent
    : isError
      ? theme.danger
      : theme['bg-elevated']

  const textColor = isUser
    ? theme['accent-fg']
    : isError
      ? theme['bg-elevated']
      : theme.fg

  return (
    <View
      style={[
        styles.bubble,
        {
          backgroundColor: bgColor,
          borderRadius: theme.radii['radius-md'],
          alignSelf: isUser ? 'flex-end' : 'flex-start',
        },
      ]}
      testID={testID}
      accessibilityRole="text"
      accessibilityLabel={isError ? `Error: ${text}` : text}
    >
      <Text
        style={[
          {
            fontSize: theme.type.body.size,
            fontWeight: String(theme.type.body.weight) as '400',
            lineHeight: theme.type.body.lineHeight,
          },
          {color: textColor},
        ]}
      >
        {text}
      </Text>
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
