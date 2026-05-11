/**
 * EmptyState — shown when the user has no tools at all.
 *
 * Layout per Sable §Screen 2a:
 *   - Hero illustration 200×200pt (placeholder View; real SVG ships later)
 *   - Headline `type-h1`: "What do you want to build?"
 *   - Subhead `type-body`, fg-muted: "Three ideas to get you started."
 *   - Three full-width tappable chips (56pt tall, radius-md, bg-elevated):
 *       "📓 Daily mood journal"
 *       "🥗 Weekly grocery list"
 *       "🏃 Track my workouts"
 *
 * Chip tap (T-0011-165, T-0011-170b):
 *   Navigate to Create tab with `prefilledPrompt` route param + chip text.
 *   Does NOT auto-submit. FAB stays in its initial (enabled but untapped) state.
 *
 * T-0011-164, T-0011-165, T-0011-170b, T-0011-185.
 */
import {Pressable, StyleSheet, Text, View} from 'react-native'

import {useAppShellTheme} from '#/theme/AppShellThemeProvider'

import {libraryCopy} from './copy'

interface Props {
  /** Called when a chip is tapped. Passes the chip text as the prefill prompt.
   * Caller is responsible for navigation — does NOT navigate internally. */
  onChipPress: (prompt: string) => void
  testID?: string
}

const CHIPS = [
  libraryCopy.emptyChip1,
  libraryCopy.emptyChip2,
  libraryCopy.emptyChip3,
] as const

export function EmptyState({onChipPress, testID = 'library-empty'}: Props) {
  const theme = useAppShellTheme()

  return (
    <View style={styles.root} testID={testID}>
      {/* Hero illustration placeholder — 200×200pt per Sable §Screen 2a.
          Real SVG from apps/mobile/assets/library-empty.svg ships later. */}
      <View
        style={[
          styles.illustration,
          {backgroundColor: theme['bg-elevated'], borderRadius: theme.radii['radius-md']},
        ]}
        accessibilityElementsHidden
        importantForAccessibility="no"
        testID="library-empty-illustration"
      />

      <Text
        style={[
          styles.headline,
          {
            fontSize: theme.type.h1.size,
            fontWeight: String(theme.type.h1.weight) as '700',
            lineHeight: theme.type.h1.lineHeight,
            color: theme.fg,
          },
        ]}
        accessibilityRole="header"
      >
        {libraryCopy.emptyHeadline}
      </Text>

      <Text
        style={[
          styles.subhead,
          {
            fontSize: theme.type.body.size,
            fontWeight: String(theme.type.body.weight) as '400',
            lineHeight: theme.type.body.lineHeight,
            color: theme['fg-muted'],
          },
        ]}
      >
        {libraryCopy.emptySubhead}
      </Text>

      <View style={styles.chips}>
        {CHIPS.map(chip => (
          <Pressable
            key={chip}
            onPress={() => onChipPress(chip)}
            accessibilityRole="button"
            accessibilityLabel={chip}
            accessibilityHint="Pre-fills the prompt in Create."
            style={[
              styles.chip,
              {
                backgroundColor: theme['bg-elevated'],
                borderRadius: theme.radii['radius-md'],
                borderColor: theme.divider,
              },
            ]}
            testID={`empty-chip-${chip}`}
          >
            <Text
              style={[
                {
                  fontSize: theme.type.body.size,
                  fontWeight: String(theme.type.body.weight) as '400',
                  lineHeight: theme.type.body.lineHeight,
                  color: theme.fg,
                },
              ]}
            >
              {chip}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
    gap: 16,
  },
  illustration: {
    width: 200,
    height: 200,
    marginBottom: 8,
  },
  headline: {
    textAlign: 'center',
  },
  subhead: {
    textAlign: 'center',
  },
  chips: {
    alignSelf: 'stretch',
    gap: 12,
    marginTop: 8,
  },
  chip: {
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    // elevation per Sable: bg-elevated + elevation-raised
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: {width: 0, height: 2},
    shadowRadius: 4,
    elevation: 2,
  },
})
