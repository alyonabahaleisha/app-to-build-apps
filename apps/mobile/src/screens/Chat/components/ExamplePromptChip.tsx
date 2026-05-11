/**
 * ExamplePromptChip — tappable pill that pre-fills the prompt input.
 * Used in the WelcomeCard on first visit.
 */
import {Pressable, StyleSheet, Text} from 'react-native'

import {useAppShellTheme} from '#/theme/AppShellThemeProvider'

interface Props {
  label: string
  onPress: (label: string) => void
}

export function ExamplePromptChip({label, onPress}: Props) {
  const theme = useAppShellTheme()

  return (
    <Pressable
      onPress={() => onPress(label)}
      accessibilityRole="button"
      accessibilityLabel={`Use example: ${label}`}
      style={[
        styles.chip,
        {
          backgroundColor: theme['bg-elevated'],
          borderColor: theme.divider,
          borderRadius: theme.radii['radius-full'],
        },
      ]}
      testID="example-chip"
    >
      <Text
        style={[
          {
            fontSize: theme.type.caption.size,
            fontWeight: String(theme.type.caption.weight) as '400',
            lineHeight: theme.type.caption.lineHeight,
            color: theme.fg,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'flex-start',
  },
})
