/**
 * BackButton — standard ← chevron, hit target 44pt.
 *
 * ADR-0011 Step 5: migrated from M1 useTheme() → useAppShellTheme().
 */
import {Feather} from '@expo/vector-icons'
import {Pressable, StyleSheet} from 'react-native'

import {useAppShellTheme} from '#/theme/AppShellThemeProvider'

interface Props {
  onPress: () => void
  accessibilityLabel?: string
  testID?: string
}

export function BackButton({onPress, accessibilityLabel = 'Back', testID}: Props) {
  const theme = useAppShellTheme()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={styles.base}
      hitSlop={8}
      testID={testID}
    >
      <Feather name="chevron-left" size={28} color={theme.fg} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
})
