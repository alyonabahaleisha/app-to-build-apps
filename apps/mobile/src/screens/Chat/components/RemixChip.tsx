/**
 * RemixChip — sticky pill above the PromptInputBar when the user arrived
 * from Try-mode's Remix CTA. Dismissible via × to clear parent attribution.
 *
 * Sable UX: chat-creation-ux.md §"Screen 3: Chat — B. Remix attribution chip"
 */
import {Feather} from '@expo/vector-icons'
import {Pressable, StyleSheet, Text, View} from 'react-native'

import {useTheme} from '#/theme'
import {chatCopy} from '#/screens/Chat/copy'

interface Props {
  authorHandle: string
  onClear: () => void
}

export function RemixChip({authorHandle, onClear}: Props) {
  const theme = useTheme()

  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: theme.palette.bg.subtle,
          borderRadius: theme.radius.full,
          marginHorizontal: theme.spacing.md,
          marginBottom: theme.spacing.xs,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={chatCopy.remixChipAccessibilityLabel(authorHandle)}
    >
      <Feather name="git-branch" size={16} color={theme.palette.text.muted} />
      <Text
        style={[theme.typography.caption, {color: theme.palette.text.muted, flex: 1}]}
        numberOfLines={1}
      >
        {chatCopy.remixChipPrefix}
        <Text style={{color: theme.palette.text.primary}}>@{authorHandle}</Text>
      </Text>
      <Pressable
        onPress={onClear}
        accessibilityRole="button"
        accessibilityLabel={chatCopy.remixChipClearLabel}
        hitSlop={12}
        testID="remix-chip-clear"
      >
        <Feather name="x" size={14} color={theme.palette.text.muted} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
})
