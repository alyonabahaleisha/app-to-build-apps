/**
 * MeatballMenu — Gorhom action sheet with 6 items.
 *
 * Items per canvas-v0-ux.md §Screen 4 (meatball menu):
 *   1. Share
 *   2. Make changes
 *   3. Rename
 *   4. Archive
 *   5. Delete (destructive)
 *
 * Plus "Copy link" (6th item per ADR-0011 Step 10 acceptance criteria).
 *
 * T-0011-249, T-0011-250, T-0011-252, T-0011-253, T-0011-257, T-0011-258, T-0011-279.
 *
 * Note: @gorhom/bottom-sheet's mock is used in tests (configured in jest.config.js).
 */
import {BottomSheetModal, BottomSheetView} from '@gorhom/bottom-sheet'
import {forwardRef, useImperativeHandle, useRef} from 'react'
import {Pressable, StyleSheet, Text, View} from 'react-native'

import {useAppShellTheme} from '#/theme/AppShellThemeProvider'
import {runCopy} from './copy'

export interface MeatballMenuRef {
  present: () => void
  dismiss: () => void
}

interface MeatballMenuProps {
  onShare: () => void
  onCopyLink: () => void
  onMakeChanges: () => void
  onRename: () => void
  onArchive: () => void
  onDelete: () => void
}

interface ActionItemProps {
  label: string
  onPress: () => void
  destructive?: boolean
  testID?: string
}

function ActionItem({label, onPress, destructive = false, testID}: ActionItemProps) {
  const theme = useAppShellTheme()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({pressed}) => [styles.actionItem, pressed && styles.actionItemPressed]}
      testID={testID}
    >
      <Text
        style={[
          styles.actionLabel,
          {color: destructive ? '#EF4444' : theme.fg},
          {
            fontSize: theme.type.body.size,
            fontWeight: String(theme.type.body.weight) as '400',
            lineHeight: theme.type.body.lineHeight,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  )
}

/**
 * MeatballMenu — ref-forwarded Gorhom BottomSheetModal.
 * Presents imperatively via `ref.current.present()`.
 */
export const MeatballMenu = forwardRef<MeatballMenuRef, MeatballMenuProps>(function MeatballMenu(
  {onShare, onCopyLink, onMakeChanges, onRename, onArchive, onDelete},
  ref,
) {
  const theme = useAppShellTheme()
  const sheetRef = useRef<BottomSheetModal>(null)

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
    dismiss: () => sheetRef.current?.dismiss(),
  }))

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={['40%']}
      backgroundStyle={{backgroundColor: theme['bg-elevated']}}
      handleIndicatorStyle={{backgroundColor: theme.divider}}
    >
      <BottomSheetView>
        <View style={styles.sheet} testID="meatball-sheet-content">
        <ActionItem
          label={runCopy.share}
          onPress={onShare}
          testID="meatball-share"
        />
        <ActionItem
          label={runCopy.copyLink}
          onPress={onCopyLink}
          testID="meatball-copy-link"
        />
        <ActionItem
          label={runCopy.makeChanges}
          onPress={onMakeChanges}
          testID="meatball-make-changes"
        />
        <ActionItem
          label={runCopy.rename}
          onPress={onRename}
          testID="meatball-rename"
        />
        <ActionItem
          label={runCopy.archive}
          onPress={onArchive}
          testID="meatball-archive"
        />
        <ActionItem
          label={runCopy.delete}
          onPress={onDelete}
          destructive
          testID="meatball-delete"
        />
      </View>
      </BottomSheetView>
    </BottomSheetModal>
  )
})

const styles = StyleSheet.create({
  sheet: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  actionItem: {
    paddingVertical: 14,
    borderRadius: 8,
  },
  actionItemPressed: {
    opacity: 0.6,
  },
  actionLabel: {
    textAlign: 'left',
  },
})
