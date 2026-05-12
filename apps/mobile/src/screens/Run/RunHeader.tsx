/**
 * RunHeader — host chrome header for RunScreen.
 *
 * Per canvas-v0-ux.md §Screen 4:
 *   - Height: 32pt (thin, brief §3.6)
 *   - Leading: chevron-left back button, 24pt icon, 44pt hit target
 *   - Title: tool name, type-body + 600 weight, center-aligned, ellipsize
 *   - Trailing: more-horizontal meatball, 24pt icon, 44pt hit target
 *   - Background: bg-elevated, 1pt divider bottom border
 *
 * A11y per ADR-0011 Step 10:
 *   - Back button: accessibilityLabel="Back to Library"
 *   - Title: accessibilityRole="header"
 *   - Meatball: accessibilityLabel="Tool options", accessibilityHint covers contents
 *
 * T-0011-246, T-0011-272, T-0011-273, T-0011-278.
 */
import {Pressable, StyleSheet, Text, View, type LayoutChangeEvent} from 'react-native'

import {useAppShellTheme} from '#/theme/AppShellThemeProvider'
import {runCopy} from './copy'

interface RunHeaderProps {
  title: string
  onBack: () => void
  onMeatball: () => void
  onMeatballLayout?: (event: LayoutChangeEvent) => void
  testID?: string
}

interface LoadingProps {
  onBack: () => void
  testID?: string
}

/**
 * RunHeader — populated state.
 */
export function RunHeader({title, onBack, onMeatball, onMeatballLayout, testID}: RunHeaderProps) {
  const theme = useAppShellTheme()

  return (
    <View
      style={[
        styles.header,
        {backgroundColor: theme['bg-elevated'], borderBottomColor: theme.divider},
      ]}
      testID={testID ?? 'run-header'}
    >
      {/* Back button */}
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={runCopy.backA11y}
        hitSlop={{top: 20, bottom: 20, left: 20, right: 20}}
        style={styles.sideButton}
        testID="run-header-back"
      >
        <Text style={[styles.iconText, {color: theme.fg}]}>{'<'}</Text>
      </Pressable>

      {/* Title — center */}
      <Text
        style={[
          styles.title,
          {
            fontSize: theme.type.body.size,
            fontWeight: '600',
            lineHeight: theme.type.body.lineHeight,
            color: theme.fg,
          },
        ]}
        numberOfLines={1}
        accessibilityRole="header"
        testID="run-header-title"
      >
        {title}
      </Text>

      {/* Meatball */}
      <Pressable
        onPress={onMeatball}
        onLayout={onMeatballLayout}
        accessibilityRole="button"
        accessibilityLabel={runCopy.meatballA11y}
        accessibilityHint={runCopy.meatballHint}
        hitSlop={{top: 20, bottom: 20, left: 20, right: 20}}
        style={styles.sideButton}
        testID="run-header-meatball"
      >
        <Text style={[styles.iconText, {color: theme.fg}]}>{'•••'}</Text>
      </Pressable>
    </View>
  )
}

/**
 * RunHeader.Loading — skeleton state while query fetches.
 */
RunHeader.Loading = function RunHeaderLoading({onBack, testID}: LoadingProps) {
  const theme = useAppShellTheme()

  return (
    <View
      style={[
        styles.header,
        {backgroundColor: theme['bg-elevated'], borderBottomColor: theme.divider},
      ]}
      testID={testID ?? 'run-header-loading'}
    >
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={runCopy.backA11y}
        hitSlop={{top: 20, bottom: 20, left: 20, right: 20}}
        style={styles.sideButton}
        testID="run-header-back"
      >
        <Text style={[styles.iconText, {color: theme.fg}]}>{'<'}</Text>
      </Pressable>

      {/* Empty center — title not yet loaded */}
      <View style={styles.titleSkeleton} />

      {/* Meatball placeholder (disabled) */}
      <View style={[styles.sideButton, {opacity: 0}]} />
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sideButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
  },
  iconText: {
    fontSize: 18,
    fontWeight: '600',
  },
  titleSkeleton: {
    flex: 1,
    height: 16,
    borderRadius: 8,
    marginHorizontal: 16,
  },
})
