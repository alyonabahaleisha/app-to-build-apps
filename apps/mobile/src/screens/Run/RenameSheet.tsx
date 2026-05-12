/**
 * RenameSheet — Gorhom bottom sheet with a single text input for renaming.
 *
 * Per ADR-0011 Step 10:
 *   - 1–80 char validation
 *   - Calls useRenameMiniAppMutation on submit
 *   - Optimistic update (mutation handles it)
 *
 * T-0011-253, T-0011-254, T-0011-255, T-0011-256, T-0011-280.
 */
import {BottomSheetModal, BottomSheetTextInput, BottomSheetView} from '@gorhom/bottom-sheet'
import {forwardRef, useCallback, useImperativeHandle, useRef, useState} from 'react'
import {Pressable, StyleSheet, Text, View} from 'react-native'

import {useRenameMiniAppMutation} from '#/state/queries/miniApps'
import {useAppShellTheme} from '#/theme/AppShellThemeProvider'
import {MAX_RENAME_LENGTH, runCopy} from './copy'

export interface RenameSheetRef {
  present: (miniAppId: string, currentTitle: string) => void
  dismiss: () => void
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export const RenameSheet = forwardRef<RenameSheetRef, {}>(function RenameSheet(
  _props,
  ref,
) {
  const theme = useAppShellTheme()
  const sheetRef = useRef<BottomSheetModal>(null)
  const renameMutation = useRenameMiniAppMutation()

  const [miniAppId, setMiniAppId] = useState('')
  const [title, setTitle] = useState('')

  useImperativeHandle(ref, () => ({
    present: (id: string, currentTitle: string) => {
      setMiniAppId(id)
      setTitle(currentTitle)
      sheetRef.current?.present()
    },
    dismiss: () => sheetRef.current?.dismiss(),
  }))

  const trimmed = title.trim()
  const isTooLong = title.length > MAX_RENAME_LENGTH
  const isEmpty = trimmed.length === 0
  const isDisabled = isEmpty || isTooLong

  const handleSave = useCallback(() => {
    if (isDisabled) return
    renameMutation.mutate({id: miniAppId, title: trimmed})
    sheetRef.current?.dismiss()
  }, [isDisabled, miniAppId, trimmed, renameMutation])

  const handleCancel = useCallback(() => {
    sheetRef.current?.dismiss()
  }, [])

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={['35%']}
      backgroundStyle={{backgroundColor: theme['bg-elevated']}}
      handleIndicatorStyle={{backgroundColor: theme.divider}}
    >
      <BottomSheetView>
        <View style={styles.sheet} testID="rename-sheet-content">
        <Text
          style={[
            styles.sheetTitle,
            {
              fontSize: theme.type.h2.size,
              fontWeight: String(theme.type.h2.weight) as '600',
              lineHeight: theme.type.h2.lineHeight,
              color: theme.fg,
            },
          ]}
          accessibilityRole="header"
        >
          {runCopy.renameTitle}
        </Text>

        <BottomSheetTextInput
          value={title}
          onChangeText={setTitle}
          placeholder={runCopy.renameInputPlaceholder}
          placeholderTextColor={theme['fg-muted']}
          returnKeyType="done"
          onSubmitEditing={handleSave}
          maxLength={MAX_RENAME_LENGTH + 1} // allow one over so we can show validation
          style={[
            styles.input,
            {
              fontSize: theme.type.body.size,
              color: theme.fg,
              backgroundColor: theme.bg,
              borderColor: isTooLong ? '#EF4444' : theme.divider,
            },
          ]}
          testID="rename-input"
        />

        {isTooLong ? (
          <Text style={[styles.validationError, {color: '#EF4444'}]} testID="rename-error">
            {runCopy.renameTooLong}
          </Text>
        ) : null}

        <View style={styles.buttonRow}>
          <Pressable
            onPress={handleCancel}
            accessibilityRole="button"
            accessibilityLabel={runCopy.renameCancel}
            style={[styles.button, {borderColor: theme.divider}]}
            testID="rename-cancel"
          >
            <Text style={{color: theme['fg-muted'], fontSize: theme.type.body.size}}>
              {runCopy.renameCancel}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleSave}
            disabled={isDisabled}
            accessibilityRole="button"
            accessibilityLabel={runCopy.renameSave}
            accessibilityState={{disabled: isDisabled}}
            style={[styles.button, {backgroundColor: theme.accent, opacity: isDisabled ? 0.5 : 1}]}
            testID="rename-save"
          >
            <Text style={{color: theme['accent-fg'], fontSize: theme.type.body.size, fontWeight: '600'}}>
              {runCopy.renameSave}
            </Text>
          </Pressable>
        </View>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  )
})

const styles = StyleSheet.create({
  sheet: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 12,
  },
  sheetTitle: {
    marginBottom: 4,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  validationError: {
    fontSize: 13,
    marginTop: -4,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
