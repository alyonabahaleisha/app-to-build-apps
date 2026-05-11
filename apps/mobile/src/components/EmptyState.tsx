/**
 * EmptyState — generic illustration + headline + subhead + optional CTA.
 *
 * App-shell only per ARCHITECTURE §6.
 *
 * ADR-0011 Step 5: migrated from M1 useTheme() → useAppShellTheme().
 */
import {Feather} from '@expo/vector-icons'
import {StyleSheet, Text, View} from 'react-native'

import {Button} from '#/components/Button'
import {useAppShellTheme} from '#/theme/AppShellThemeProvider'

import type {ComponentProps} from 'react'

type FeatherIconName = ComponentProps<typeof Feather>['name']

interface Props {
  iconName: FeatherIconName
  headline: string
  subhead?: string
  ctaLabel?: string
  ctaA11yLabel?: string
  onCtaPress?: () => void
  testID?: string
}

export function EmptyState({
  iconName,
  headline,
  subhead,
  ctaLabel,
  ctaA11yLabel,
  onCtaPress,
  testID,
}: Props) {
  const theme = useAppShellTheme()
  return (
    <View style={styles.container} testID={testID}>
      <View
        style={[
          styles.iconWrap,
          {backgroundColor: theme['bg-elevated'], borderRadius: theme.radii['radius-full']},
        ]}
      >
        <Feather
          name={iconName}
          size={36}
          color={theme['fg-muted']}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      </View>
      <Text
        style={[
          styles.headline,
          {fontSize: theme.type.h2.size, fontWeight: String(theme.type.h2.weight) as '600', lineHeight: theme.type.h2.lineHeight, color: theme.fg},
        ]}
        accessibilityRole="header"
      >
        {headline}
      </Text>
      {subhead ? (
        <Text
          style={[
            styles.subhead,
            {fontSize: theme.type.body.size, fontWeight: String(theme.type.body.weight) as '400', lineHeight: theme.type.body.lineHeight, color: theme['fg-muted']},
          ]}
        >
          {subhead}
        </Text>
      ) : null}
      {ctaLabel && onCtaPress ? (
        <View style={styles.ctaWrap}>
          <Button
            label={ctaLabel}
            accessibilityLabel={ctaA11yLabel ?? ctaLabel}
            onPress={onCtaPress}
            variant="secondary"
            testID={`${testID ?? 'empty-state'}-cta`}
          />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
    gap: 12,
  },
  iconWrap: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  headline: {textAlign: 'center'},
  subhead: {textAlign: 'center'},
  ctaWrap: {marginTop: 16, alignSelf: 'stretch'},
})
