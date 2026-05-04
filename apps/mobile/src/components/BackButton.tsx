/**
 * BackButton — standard ← chevron, hit target 44pt.
 *
 * Icon source: `@expo/vector-icons` Feather set. Picked over
 * `lucide-react-native` per Sable's "Notes for Cal" #6 — vector-icons
 * already ships with Expo (no extra dep), and the Feather glyph matches
 * the Lucide outline aesthetic Sable specified.
 */
import {Feather} from '@expo/vector-icons'
import {Pressable, StyleSheet} from 'react-native'

import {useTheme} from '#/theme'

interface Props {
  onPress: () => void
  accessibilityLabel?: string
  testID?: string
}

export function BackButton({
  onPress,
  accessibilityLabel = 'Back',
  testID,
}: Props) {
  const theme = useTheme()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={styles.base}
      hitSlop={8}
      testID={testID}
    >
      <Feather name="chevron-left" size={28} color={theme.palette.text.primary} />
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
