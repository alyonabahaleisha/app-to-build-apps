/**
 * SafeContainer — wraps every screen, applies safe-area insets + bg from
 * the theme. App-shell only (per ARCHITECTURE.md §6).
 *
 * ADR-0011 Step 5: migrated from M1 useTheme() → useAppShellTheme().
 */
import {View, type ViewStyle} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {useAppShellTheme} from '#/theme/AppShellThemeProvider'

import type {ReactNode} from 'react'

interface Props {
  children: ReactNode
  /** Override the background color (rare — defaults to theme `bg`). */
  backgroundColor?: string
  /** Additional style overrides. */
  style?: ViewStyle
}

export function SafeContainer({children, backgroundColor, style}: Props) {
  const insets = useSafeAreaInsets()
  const theme = useAppShellTheme()
  return (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: backgroundColor ?? theme.bg,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
        style,
      ]}
    >
      {children}
    </View>
  )
}
