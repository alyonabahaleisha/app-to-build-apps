/**
 * SafeContainer — wraps every screen, applies safe-area insets + bg.surface
 * from the theme. App-shell only (per ARCHITECTURE.md §6).
 */
import {View, type ViewStyle} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {useTheme} from '#/theme'

import type {ReactNode} from 'react'

interface Props {
  children: ReactNode
  /** Override the background color (rare — defaults to theme `bg.surface`). */
  backgroundColor?: string
  /** Additional style overrides. */
  style?: ViewStyle
}

export function SafeContainer({children, backgroundColor, style}: Props) {
  const insets = useSafeAreaInsets()
  const theme = useTheme()
  return (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: backgroundColor ?? theme.palette.bg.surface,
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
