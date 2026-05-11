/**
 * SuggestedPromptChips — 6 chips in a 2-column grid shown when the
 * prompt input is empty. Tapping a chip pre-fills the input only;
 * it does NOT auto-submit.
 *
 * Distinct from the A2UI catalog Chip component (packages/a2ui-renderer/).
 *
 * T-0011-191: chips visible in default state
 * T-0011-196: tap chip → input pre-filled, chips collapse, FAB enables
 * T-0011-200: FAB accessibilityState.disabled reflects state
 * T-0011-201: chips have accessibilityRole="button", label=chip text, hint
 * T-0011-207: pool has exactly 10 entries (tested in suggestedPrompts.test.ts)
 */
import {Pressable, StyleSheet, Text, View} from 'react-native'

import {useAppShellTheme} from '#/theme/AppShellThemeProvider'

import {createCopy} from './copy'
import {type SuggestedPrompt} from './suggestedPrompts'

interface Props {
  prompts: SuggestedPrompt[]
  onSelect: (text: string) => void
}

export function SuggestedPromptChips({prompts, onSelect}: Props) {
  const theme = useAppShellTheme()

  return (
    <View style={styles.root} testID="suggested-prompt-chips">
      <Text
        style={[
          styles.header,
          {
            fontSize: theme.type.caption.size,
            fontWeight: String(theme.type.caption.weight) as '400',
            lineHeight: theme.type.caption.lineHeight,
            color: theme['fg-muted'],
          },
        ]}
      >
        {createCopy.suggestionsHeader}
      </Text>

      <View style={styles.grid}>
        {prompts.map(prompt => (
          <Pressable
            key={prompt.text}
            onPress={() => onSelect(`${prompt.emoji} ${prompt.text}`)}
            accessibilityRole="button"
            accessibilityLabel={`${prompt.emoji} ${prompt.text}`}
            accessibilityHint={createCopy.chipHint}
            style={[
              styles.chip,
              {
                backgroundColor: theme['bg-elevated'],
                borderColor: theme.divider,
                borderRadius: theme.radii['radius-full'],
              },
            ]}
            testID={`chip-${prompt.text}`}
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
              numberOfLines={1}
            >
              {prompt.emoji} {prompt.text}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    marginTop: 16,
  },
  header: {
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    // 2-column approximation: each chip takes ~48% width.
    // Actual layout is flex-wrap; each chip is self-sizing with min height 44.
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    // ~48% of parent for 2-column layout with 8pt gap.
    flexBasis: '48%',
    flexGrow: 1,
  },
})
