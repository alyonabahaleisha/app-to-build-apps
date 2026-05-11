/**
 * Pill — atomic badge component.
 *
 * Used for "Featured", "Published", and status indicators.
 * Variants: muted / primary / destructive.
 *
 * ADR-0011 Step 5: migrated from M1 useTheme() → useAppShellTheme().
 */
import {StyleSheet, Text, View} from 'react-native'

import type {ResolvedTheme} from '@app-creator/design-system'
import {useAppShellTheme} from '#/theme/AppShellThemeProvider'

export type PillVariant = 'muted' | 'primary' | 'destructive'

interface Props {
  label: string
  variant?: PillVariant
  testID?: string
}

export function Pill({label, variant = 'muted', testID}: Props) {
  const theme = useAppShellTheme()
  const {bg, fg} = colorsFor(variant, theme)

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: bg,
          borderRadius: theme.radii['radius-sm'],
          paddingVertical: theme.spacing['space-xs'],
          paddingHorizontal: theme.spacing['space-xs'],
        },
      ]}
      testID={testID}
    >
      <Text
        style={[
          styles.label,
          {
            color: fg,
            fontSize: 12,
            fontWeight: '600',
          },
        ]}
      >
        {label}
      </Text>
    </View>
  )
}

function colorsFor(variant: PillVariant, t: ResolvedTheme): {bg: string; fg: string} {
  switch (variant) {
    case 'primary':
      return {bg: t.accent, fg: t['accent-fg']}
    case 'destructive':
      return {bg: t.danger, fg: t['bg-elevated']}
    case 'muted':
    default:
      return {bg: t['bg-elevated'], fg: t['fg-muted']}
  }
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {},
})
