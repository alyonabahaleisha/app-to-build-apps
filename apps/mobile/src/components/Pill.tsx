/**
 * Pill — atomic badge component.
 *
 * Used for "Featured", "Published", and status indicators.
 * Variants: muted / primary / destructive.
 *
 * Per Sable's UX doc §Library Tile: text_xs (12pt) / font_semibold /
 * padding `2xs` `xs`, radius `sm`.
 */
import {StyleSheet, Text, View} from 'react-native'

import {useTheme} from '#/theme'

export type PillVariant = 'muted' | 'primary' | 'destructive'

interface Props {
  label: string
  variant?: PillVariant
  testID?: string
}

export function Pill({label, variant = 'muted', testID}: Props) {
  const theme = useTheme()

  const {bg, fg} = colorsFor(variant, theme)

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: bg,
          borderRadius: theme.radius.sm,
          paddingVertical: theme.spacing['2xs'],
          paddingHorizontal: theme.spacing.xs,
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

function colorsFor(
  variant: PillVariant,
  theme: ReturnType<typeof useTheme>,
): {bg: string; fg: string} {
  switch (variant) {
    case 'primary':
      return {bg: theme.palette.primary, fg: theme.palette.primaryFg}
    case 'destructive':
      return {bg: theme.palette.destructive, fg: theme.palette.destructiveFg}
    case 'muted':
    default:
      return {bg: theme.palette.bg.subtle, fg: theme.palette.text.muted}
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
