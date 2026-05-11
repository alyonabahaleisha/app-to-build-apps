/**
 * LongPressActionSheet — Gorhom Bottom Sheet action menu triggered by
 * long-pressing a Library card.
 *
 * Items per Sable §Screen 2 + ADR-0011 T-0011-172 (6 items):
 *   Open / Share / Make changes / Archive / Rename / Delete
 *
 * "Delete" is destructive — triggers a confirmation alert before running.
 * "Share" is stubbed (ADR-0008 PR 2/3 fills in the real implementation).
 *
 * Snap point: [40%] per ADR-0011 §implementation note 5.
 *
 * T-0011-171, T-0011-172.
 */
import {BottomSheetModal, BottomSheetView} from '@gorhom/bottom-sheet'
import {Alert, Pressable, StyleSheet, Text} from 'react-native'
import {forwardRef, useCallback, useImperativeHandle, useMemo, useRef} from 'react'

import {useAppShellTheme} from '#/theme/AppShellThemeProvider'

import {libraryCopy} from './copy'

export interface LongPressActionSheetRef {
  present: (miniAppId: string) => void
  dismiss: () => void
}

interface Handlers {
  onOpen: (id: string) => void
  /** Stubbed — ADR-0008 fills in real share. */
  onShare: (id: string) => void
  onMakeChanges: (id: string) => void
  onRename: (id: string) => void
  onArchive: (id: string) => void
  onDelete: (id: string) => void
}

interface Props {
  handlers: Handlers
}

interface ActionItem {
  label: string
  testID: string
  destructive?: boolean
  onPress: () => void
}

export const LongPressActionSheet = forwardRef<LongPressActionSheetRef, Props>(
  function LongPressActionSheet({handlers}, ref) {
    const theme = useAppShellTheme()
    const sheetRef = useRef<BottomSheetModal>(null)
    // Hold the ID of the card that was long-pressed so callbacks have it
    // without needing to thread it through every press handler.
    const activeIdRef = useRef<string | null>(null)

    useImperativeHandle(ref, () => ({
      present(miniAppId: string) {
        activeIdRef.current = miniAppId
        sheetRef.current?.present()
      },
      dismiss() {
        sheetRef.current?.dismiss()
      },
    }))

    const dismiss = useCallback(() => sheetRef.current?.dismiss(), [])

    const items = useMemo<ActionItem[]>(() => {
      const id = () => activeIdRef.current ?? ''
      return [
        {
          label: libraryCopy.actionOpen,
          testID: 'action-open',
          onPress: () => { handlers.onOpen(id()); dismiss() },
        },
        {
          label: libraryCopy.actionShare,
          testID: 'action-share',
          onPress: () => { handlers.onShare(id()); dismiss() },
        },
        {
          label: libraryCopy.actionMakeChanges,
          testID: 'action-make-changes',
          onPress: () => { handlers.onMakeChanges(id()); dismiss() },
        },
        {
          label: libraryCopy.actionArchive,
          testID: 'action-archive',
          onPress: () => { handlers.onArchive(id()); dismiss() },
        },
        {
          label: libraryCopy.actionRename,
          testID: 'action-rename',
          onPress: () => { handlers.onRename(id()); dismiss() },
        },
        {
          label: libraryCopy.actionDelete,
          testID: 'action-delete',
          destructive: true,
          onPress: () => {
            const currentId = id()
            dismiss()
            Alert.alert(
              'Delete tool?',
              'This cannot be undone.',
              [
                {text: 'Cancel', style: 'cancel'},
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => handlers.onDelete(currentId),
                },
              ],
            )
          },
        },
      ]
    }, [handlers, dismiss])

    const snapPoints = useMemo(() => ['40%'], [])

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={snapPoints}
      >
        <BottomSheetView style={styles.content}>
          {items.map(item => (
            <Pressable
              key={item.testID}
              onPress={item.onPress}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              testID={item.testID}
              style={[
                styles.item,
                {borderBottomColor: theme.divider},
              ]}
            >
              <Text
                style={[
                  styles.itemText,
                  {
                    fontSize: theme.type.body.size,
                    fontWeight: String(theme.type.body.weight) as '400',
                    lineHeight: theme.type.body.lineHeight,
                    color: item.destructive ? theme.danger : theme.fg,
                  },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </BottomSheetView>
      </BottomSheetModal>
    )
  },
)

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  item: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
    justifyContent: 'center',
  },
  itemText: {},
})
