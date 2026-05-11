/**
 * Card — generic surface used by app-shell features (library cards, hero
 * CTA cards, banners). When `onPress` is supplied, the wrapper turns into
 * a `Pressable` so the whole card is the hit target.
 *
 * App-shell only (per ARCHITECTURE.md §6) — distinct from any A2UI catalog
 * component.
 *
 * ADR-0011 Step 5: migrated from M1 useTheme() → useAppShellTheme().
 */
import {Pressable, StyleSheet, View, type ViewStyle} from 'react-native'

import {useAppShellTheme} from '#/theme/AppShellThemeProvider'

import type {ReactNode} from 'react'

interface Props {
  children: ReactNode
  onPress?: () => void
  /** Override accessibility role/label when the card itself is the action. */
  accessibilityLabel?: string
  accessibilityRole?: 'button' | 'summary' | undefined
  /** Apply a soft drop-shadow. Default off — the empty state and library
   * dividers carry the surface flatly. The hero CTA opts in. */
  elevated?: boolean
  /** Override default padding (space-md). */
  padding?: number
  style?: ViewStyle
  testID?: string
}

export function Card({
  children,
  onPress,
  accessibilityLabel,
  accessibilityRole,
  elevated = false,
  padding,
  style,
  testID,
}: Props) {
  const theme = useAppShellTheme()
  const baseStyle: ViewStyle = {
    backgroundColor: theme['bg-elevated'],
    borderRadius: theme.radii['radius-lg'],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.divider,
    padding: padding ?? theme.spacing['space-md'],
    ...(elevated ? styles.shadow : null),
  }

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole={accessibilityRole ?? 'button'}
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        style={({pressed}) => [
          baseStyle,
          pressed ? {backgroundColor: theme.bg} : null,
          style,
        ]}
      >
        {children}
      </Pressable>
    )
  }

  return (
    <View
      style={[baseStyle, style]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      testID={testID}
    >
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: {width: 0, height: 1},
    shadowRadius: 3,
    elevation: 1,
  },
})
