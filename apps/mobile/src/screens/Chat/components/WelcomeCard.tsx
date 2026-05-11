/**
 * WelcomeCard — centered empty state shown on first visit (no messages,
 * no remixParams). Shows heading + subhead + 3 example prompt chips.
 */
import {StyleSheet, Text, View} from 'react-native'

import {useAppShellTheme} from '#/theme/AppShellThemeProvider'
import {chatCopy} from '#/screens/Chat/copy'

import {ExamplePromptChip} from './ExamplePromptChip'

interface Props {
  onSelectExample: (prompt: string) => void
}

export function WelcomeCard({onSelectExample}: Props) {
  const theme = useAppShellTheme()

  return (
    <View style={styles.container} testID="chat-welcome-card">
      <Text
        style={[
          {
            fontSize: theme.type.h1.size,
            fontWeight: String(theme.type.h1.weight) as '600',
            lineHeight: theme.type.h1.lineHeight,
            color: theme.fg,
            textAlign: 'center',
            marginBottom: theme.spacing['space-sm'],
          },
        ]}
        accessibilityRole="header"
      >
        {chatCopy.welcomeHeading}
      </Text>
      <Text
        style={[
          {
            fontSize: theme.type.body.size,
            fontWeight: String(theme.type.body.weight) as '400',
            lineHeight: theme.type.body.lineHeight,
            color: theme['fg-muted'],
            textAlign: 'center',
            marginBottom: theme.spacing['space-lg'],
          },
        ]}
      >
        {chatCopy.welcomeSubhead}
      </Text>
      <View style={styles.chips}>
        {chatCopy.examplePrompts.map(prompt => (
          <ExamplePromptChip key={prompt} label={prompt} onPress={onSelectExample} />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  chips: {
    gap: 8,
    alignItems: 'center',
  },
})
