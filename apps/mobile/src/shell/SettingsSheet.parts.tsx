/**
 * SettingsSheet.parts — sub-components extracted for line-count compliance.
 *
 * All sub-components are pure presentational; they receive theme as a prop so
 * they remain independent of AppShellThemeContext.
 */
import {Pressable, StyleSheet, Switch, Text, View} from 'react-native'

import type {ResolvedTheme} from '@app-creator/design-system'
import type {OutOfScopeIntentSummary} from '#/state/queries/outOfScopeIntents'

// ---------------------------------------------------------------------------
// Capability label map (shared with SettingsSheet.tsx)
// ---------------------------------------------------------------------------

const CAPABILITY_LABELS: Record<string, string> = {
  image_gen: 'Image generation',
  vision: 'Vision',
  chat: 'AI chat',
  transcription: 'Voice input',
  classification: 'Classification',
  unknown: 'Other capability',
}

export function labelFor(capability: string): string {
  return CAPABILITY_LABELS[capability] ?? capability
}

// ---------------------------------------------------------------------------
// SectionHeader
// ---------------------------------------------------------------------------

export function SectionHeader({title, theme}: {title: string; theme: ResolvedTheme}) {
  return (
    <Text
      style={[
        styles.sectionHeader,
        {
          color: theme['fg-muted'],
          fontSize: theme.type.caption.size,
          fontWeight: String(theme.type.caption.weight) as '400',
        },
      ]}
    >
      {title.toUpperCase()}
    </Text>
  )
}

// ---------------------------------------------------------------------------
// Divider
// ---------------------------------------------------------------------------

export function Divider({theme}: {theme: ResolvedTheme}) {
  return <View style={[styles.divider, {backgroundColor: theme.divider}]} />
}

// ---------------------------------------------------------------------------
// LinkRow
// ---------------------------------------------------------------------------

export function LinkRow({
  label,
  onPress,
  theme,
  testID,
}: {
  label: string
  onPress: () => void
  theme: ResolvedTheme
  testID?: string
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={label}
      style={styles.linkRow}
      testID={testID}
    >
      <Text style={[styles.linkLabel, {color: theme.fg, fontSize: theme.type.body.size}]}>
        {label}
      </Text>
    </Pressable>
  )
}

// ---------------------------------------------------------------------------
// ComingNextList
// ---------------------------------------------------------------------------

interface ComingNextListProps {
  intents: OutOfScopeIntentSummary[]
  onToggle: (capability: string, notifyOptIn: boolean) => void
  theme: ResolvedTheme
}

export function ComingNextList({intents, onToggle, theme}: ComingNextListProps) {
  if (intents.length === 0) {
    return (
      <Text
        style={[styles.emptyText, {color: theme['fg-muted'], fontSize: theme.type.caption.size}]}
        testID="settings-coming-next-empty"
      >
        No upcoming features yet.
      </Text>
    )
  }

  return (
    <>
      {intents.map((intent, idx) => (
        <View key={intent.capability}>
          {idx > 0 && <Divider theme={theme} />}
          <View style={styles.intentRow}>
            <Text
              style={[styles.capabilityLabel, {color: theme.fg, fontSize: theme.type.body.size}]}
              testID={`settings-capability-${intent.capability}`}
            >
              {labelFor(intent.capability)}
            </Text>
            <Switch
              value={intent.notifyOptIn}
              onValueChange={value => onToggle(intent.capability, value)}
              accessibilityRole="switch"
              accessibilityLabel={`Notify me about ${labelFor(intent.capability)}`}
              accessibilityState={{checked: intent.notifyOptIn}}
              thumbColor={theme['accent-fg']}
              trackColor={{false: theme.divider, true: theme.accent}}
              testID={`settings-notify-toggle-${intent.capability}`}
            />
          </View>
        </View>
      ))}
    </>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  sectionHeader: {
    marginBottom: 6,
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },
  linkRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  linkLabel: {},
  intentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  capabilityLabel: {},
  emptyText: {
    padding: 16,
  },
})
