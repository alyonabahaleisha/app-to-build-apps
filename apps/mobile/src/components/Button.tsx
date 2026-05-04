/**
 * Button — app-shell variant. Distinct from the A2UI catalog `Button`,
 * which lives in `packages/a2ui-renderer/`. Per ARCHITECTURE.md §6.
 *
 * Visual treatment per Sable's UX doc §A2UI Catalog Visual Treatment
 * (12pt vertical / 20pt horizontal padding, radius `md`, primary/secondary/
 * destructive variants, light haptic on press success).
 *
 * Per CLAUDE.md §1: `Pressable`, not `TouchableOpacity`. Required
 * `accessibilityLabel`. Hit target ≥ 44pt is enforced by min-height.
 */
import * as Haptics from 'expo-haptics'
import {useCallback} from 'react'
import {ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle} from 'react-native'

import {useTheme, type Palette} from '#/theme'

export type ButtonVariant = 'primary' | 'secondary' | 'destructive'

interface Props {
  label: string
  onPress: () => void | Promise<void>
  accessibilityLabel: string
  variant?: ButtonVariant
  disabled?: boolean
  loading?: boolean
  /** Optional style override — most callers should not need this. */
  style?: ViewStyle
  /** Optional testID for test queries. */
  testID?: string
}

export function Button({
  label,
  onPress,
  accessibilityLabel,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  testID,
}: Props) {
  const theme = useTheme()
  const isDisabled = disabled || loading

  const handlePress = useCallback(async () => {
    // Light haptic on every successful press, per Sable's spec.
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    // Await the consumer's handler so async state updates settle inside
    // the same React Testing Library `act` boundary in tests, and so
    // sequential presses respect a `disabled` state set by the handler.
    await onPress()
  }, [onPress])

  const colors = colorsFor(variant, theme.palette)

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{disabled: isDisabled, busy: loading}}
      testID={testID}
      style={({pressed}) => [
        styles.base,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
          borderWidth: variant === 'secondary' ? StyleSheet.hairlineWidth : 0,
          opacity: isDisabled ? 0.5 : 1,
          borderRadius: theme.radius.md,
        },
        pressed && !isDisabled ? {backgroundColor: colors.bgPressed} : null,
        style,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={colors.fg} style={styles.spinner} />
        ) : null}
        <Text
          style={[styles.label, theme.typography.bodyStrong, {color: colors.fg}]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  )
}

interface VariantColors {
  bg: string
  bgPressed: string
  fg: string
  border: string
}

function colorsFor(variant: ButtonVariant, p: Palette): VariantColors {
  switch (variant) {
    case 'secondary':
      return {
        bg: p.bg.subtle,
        bgPressed: p.border.subtle,
        fg: p.text.primary,
        border: p.border.subtle,
      }
    case 'destructive':
      return {
        bg: p.destructive,
        bgPressed: '#a31616',
        fg: p.destructiveFg,
        border: p.destructive,
      }
    case 'primary':
    default:
      return {
        bg: p.primary,
        bgPressed: p.primaryHover,
        fg: p.primaryFg,
        border: p.primary,
      }
  }
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {flexDirection: 'row', alignItems: 'center'},
  spinner: {marginRight: 8},
  label: {textAlign: 'center'},
})
