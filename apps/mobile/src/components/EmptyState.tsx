/**
 * EmptyState — generic illustration + headline + subhead + optional CTA.
 *
 * Drives Sable's Home empty state (§Screen 2 state matrix) and is reused by
 * the error state (different icon + copy). App-shell only per ARCHITECTURE
 * §6.
 */
import {Feather} from '@expo/vector-icons'
import {StyleSheet, Text, View} from 'react-native'

import {Button} from '#/components/Button'
import {useTheme} from '#/theme'

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
  const theme = useTheme()
  return (
    <View style={styles.container} testID={testID}>
      <View
        style={[
          styles.iconWrap,
          {backgroundColor: theme.palette.bg.subtle, borderRadius: theme.radius.full},
        ]}
      >
        <Feather
          name={iconName}
          size={36}
          color={theme.palette.text.muted}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      </View>
      <Text
        style={[styles.headline, theme.typography.heading2, {color: theme.palette.text.primary}]}
        accessibilityRole="header"
      >
        {headline}
      </Text>
      {subhead ? (
        <Text style={[styles.subhead, theme.typography.body, {color: theme.palette.text.muted}]}>
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
