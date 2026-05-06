/**
 * WelcomeCard — centered empty state shown on first visit (no messages,
 * no remixParams). Shows heading + subhead + 3 example prompt chips.
 */
import {StyleSheet, Text, View} from 'react-native'

import {useTheme} from '#/theme'
import {chatCopy} from '#/screens/Chat/copy'

import {ExamplePromptChip} from './ExamplePromptChip'

interface Props {
  onSelectExample: (prompt: string) => void
}

export function WelcomeCard({onSelectExample}: Props) {
  const theme = useTheme()

  return (
    <View style={styles.container} testID="chat-welcome-card">
      <Text
        style={[
          theme.typography.heading1,
          {color: theme.palette.text.primary, textAlign: 'center', marginBottom: theme.spacing.sm},
        ]}
        accessibilityRole="header"
      >
        {chatCopy.welcomeHeading}
      </Text>
      <Text
        style={[
          theme.typography.body,
          {
            color: theme.palette.text.muted,
            textAlign: 'center',
            marginBottom: theme.spacing.lg,
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
