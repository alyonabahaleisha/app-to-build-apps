/**
 * ExamplePromptChip — tappable pill that pre-fills the prompt input.
 * Used in the WelcomeCard on first visit.
 */
import {Pressable, StyleSheet, Text} from 'react-native'

import {useTheme} from '#/theme'

interface Props {
  label: string
  onPress: (label: string) => void
}

export function ExamplePromptChip({label, onPress}: Props) {
  const theme = useTheme()

  return (
    <Pressable
      onPress={() => onPress(label)}
      accessibilityRole="button"
      accessibilityLabel={`Use example: ${label}`}
      style={[
        styles.chip,
        {
          backgroundColor: theme.palette.bg.subtle,
          borderColor: theme.palette.border.subtle,
          borderRadius: theme.radius.full,
        },
      ]}
      testID="example-chip"
    >
      <Text
        style={[
          theme.typography.caption,
          {color: theme.palette.text.primary},
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
