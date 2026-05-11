/**
 * EditingPill — shown above the prompt input when the user arrived via
 * "Make changes" from RunScreen. Dismissable; if dismissed, the next
 * submit creates a new mini-app instead of editing.
 *
 * T-0011-202: pill visible when editingMiniAppId route param present.
 * T-0011-203: [×] dismisses pill; next submit has no editingMiniAppId.
 */
import {Pressable, StyleSheet, Text, View} from 'react-native'

import {useAppShellTheme} from '#/theme/AppShellThemeProvider'

import {createCopy} from './copy'

interface Props {
  miniAppTitle: string
  onDismiss: () => void
}

export function EditingPill({miniAppTitle, onDismiss}: Props) {
  const theme = useAppShellTheme()

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: theme['bg-elevated'],
          borderColor: theme.divider,
          borderRadius: theme.radii['radius-full'],
        },
      ]}
      testID="editing-pill"
    >
      <Text
        style={[
          styles.label,
          {
            fontSize: theme.type.caption.size,
            fontWeight: String(theme.type.caption.weight) as '400',
            lineHeight: theme.type.caption.lineHeight,
            color: theme.fg,
          },
        ]}
        numberOfLines={1}
      >
        {createCopy.editingPillPrefix}
        {miniAppTitle}
        {createCopy.editingPillSuffix}
      </Text>

      <Pressable
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel={createCopy.editingPillDismissA11y}
        hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
        style={styles.dismiss}
        testID="editing-pill-dismiss"
      >
        <Text
          style={{
            fontSize: theme.type.caption.size,
            color: theme['fg-muted'],
            lineHeight: theme.type.caption.lineHeight,
          }}
        >
          ×
        </Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  label: {
    flexShrink: 1,
  },
  dismiss: {
    paddingLeft: 2,
  },
})
