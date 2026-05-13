/**
 * CreateScreen — V0 prompt-capture screen per ADR-0011 Step 9 +
 * Sable's canvas-v0-ux.md §Screen 3.
 *
 * Layout (top → bottom):
 *   - Header bar (44pt): "Create" title left, avatar right
 *   - Hero copy "What do you want to build?" (tagline)
 *   - Optional EditingPill above input
 *   - PromptInput (multi-line, 2000 chars max, mic icon)
 *   - SuggestedPromptChips (visible when no input)
 *   - FAB "Generate tool" (bottom-right, disabled when empty/whitespace/over 2000)
 *
 * States (Sable §Screen 3):
 *   - Default     — empty prompt, chips visible, FAB disabled
 *   - Typing      — ≥1 non-whitespace char, chips collapse, FAB enables (if ≤2000)
 *   - Generating  — navigated to GeneratingScreen (this screen is in stack)
 *   - Error       — returned from Generating via toast; prompt preserved
 *
 * T-0011-191..243 (+ 231a, 231b) — 55 test IDs in CreateScreen.test.tsx.
 */
import {BottomSheetModalProvider, BottomSheetModal} from '@gorhom/bottom-sheet'
import {useCallback, useMemo, useRef, useState} from 'react'
import {Pressable, StyleSheet, Text, View} from 'react-native'

import {SafeContainer} from '#/components/SafeContainer'
import {useSession} from '#/state/session/useSession'
import {useAppShellTheme} from '#/theme/AppShellThemeProvider'

import {createCopy, MAX_PROMPT_LENGTH} from './copy'
import {EditingPill} from './EditingPill'
import {PromptInput} from './PromptInput'
import {SuggestedPromptChips} from './SuggestedPromptChips'
import {pickSuggestedPrompts} from './suggestedPrompts'
import {VoiceMicWaitlistSheet} from './VoiceMicWaitlistSheet'

import type {NativeStackScreenProps} from '@react-navigation/native-stack'
import type {RootStackParamList} from '#/lib/routes/types'

type Props = NativeStackScreenProps<RootStackParamList, 'Create'>

/**
 * Named export — used directly in tests and as the navigator component.
 * testID="create-screen-root" present for T-0011-291 (Navigation tests).
 */
export function CreateScreen({route, navigation}: Props) {
  const theme = useAppShellTheme()
  const session = useSession()

  const prefilledPrompt = route.params?.prefilledPrompt ?? ''
  const editingMiniAppId = route.params?.editingMiniAppId

  const [prompt, setPrompt] = useState(prefilledPrompt)
  // Track whether the editing pill is still active. Once dismissed, the
  // next submit creates a new mini-app (T-0011-203).
  const [editingActive, setEditingActive] = useState(!!editingMiniAppId)

  const micSheetRef = useRef<BottomSheetModal>(null)

  // Suggested prompts: deterministic per session (module-level seed).
  const chips = useMemo(() => pickSuggestedPrompts(), [])

  // FAB enabled: ≥1 non-whitespace char AND ≤2000 chars.
  const trimmedLength = prompt.trimEnd().trimStart().length
  const isFabEnabled = trimmedLength >= 1 && prompt.length <= MAX_PROMPT_LENGTH

  // Chips collapse when there is any input.
  const showChips = prompt.length === 0

  // Editing pill: only shown when editingMiniAppId was present and user
  // hasn't dismissed it.
  const showEditingPill = editingActive && !!editingMiniAppId

  // Approximate mini-app title for the editing pill from the route params.
  // The full title lives on the mini-app record; for V0 we trust the caller
  // (LibraryScreen handleMakeChanges) to pass `prefilledPrompt` which is the
  // original_prompt. We use the prompt text as the pill label here, trimmed
  // to keep the pill compact. The actual title lookup is Step 10's concern.
  const editingPillTitle =
    prefilledPrompt.slice(0, 40) || (editingMiniAppId?.slice(0, 8) ?? '')

  const handleChipSelect = useCallback((text: string) => {
    setPrompt(text)
  }, [])

  const handleMicPress = useCallback(() => {
    micSheetRef.current?.present()
  }, [])

  const handleAvatarPress = useCallback(() => {
    // Settings sheet — wired in Phase 2 PR 5.
  }, [])

  const handleDismissEditing = useCallback(() => {
    setEditingActive(false)
  }, [])

  const handleSend = useCallback(() => {
    if (!isFabEnabled) return

    navigation.navigate('Generating', {
      prompt: prompt.trim(),
      ...(editingActive && editingMiniAppId ? {editingMiniAppId} : {}),
    })
  }, [isFabEnabled, prompt, navigation, editingActive, editingMiniAppId])

  return (
    <BottomSheetModalProvider>
      <SafeContainer>
        <View style={styles.root} testID="create-screen-root">
          {/* Header bar */}
          <View style={[styles.header, {borderBottomColor: theme.divider}]}>
            {/* Left — back button or spacer */}
            {navigation.canGoBack() ? (
              <Pressable
                onPress={() => navigation.goBack()}
                accessibilityRole="button"
                accessibilityLabel="Go back"
                hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}
                style={styles.headerControl}
                testID="create-back"
              >
                <Text style={{color: theme.fg, fontSize: 24}}>‹</Text>
              </Pressable>
            ) : (
              <View style={styles.headerControl} />
            )}

            <Text
              style={[
                {
                  fontSize: theme.type.h1.size,
                  fontWeight: String(theme.type.h1.weight) as '700',
                  lineHeight: theme.type.h1.lineHeight,
                  color: theme.fg,
                },
              ]}
              accessibilityRole="header"
              testID="create-header-title"
            >
              {createCopy.title}
            </Text>

            {/* Avatar — taps open Settings sheet (Phase 2 PR 5) */}
            <Pressable
              onPress={handleAvatarPress}
              accessibilityRole="button"
              accessibilityLabel="Open settings"
              hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}
              style={[
                styles.avatar,
                styles.headerControl,
                {
                  backgroundColor: theme['bg-elevated'],
                  borderColor: theme.divider,
                },
              ]}
              testID="create-avatar"
            />
          </View>

          {/* Scrollable body */}
          <View style={styles.body}>
            {/* Editing pill */}
            {showEditingPill ? (
              <EditingPill
                miniAppTitle={editingPillTitle}
                onDismiss={handleDismissEditing}
              />
            ) : null}

            {/* Prompt input */}
            <PromptInput
              value={prompt}
              onChangeText={setPrompt}
              onMicPress={handleMicPress}
              testID="prompt-input"
            />

            {/* Suggested prompt chips — visible only when prompt is empty */}
            {showChips ? (
              <SuggestedPromptChips prompts={chips} onSelect={handleChipSelect} />
            ) : null}
          </View>
        </View>

        {/* FAB — fixed bottom-right above tab bar */}
        <Pressable
          onPress={handleSend}
          disabled={!isFabEnabled}
          accessibilityRole="button"
          accessibilityLabel={createCopy.fabA11yLabel}
          accessibilityState={{disabled: !isFabEnabled}}
          hitSlop={{top: 0, bottom: 0, left: 0, right: 0}}
          style={[
            styles.fab,
            {
              backgroundColor: theme.accent,
              opacity: isFabEnabled ? 1 : 0.5,
            },
          ]}
          testID="create-fab"
        >
          <Text
            style={{
              fontSize: 24,
              color: theme['accent-fg'],
            }}
            accessibilityElementsHidden
          >
            ↑
          </Text>
        </Pressable>

        {/* Voice mic waitlist sheet */}
        <VoiceMicWaitlistSheet
          ref={micSheetRef}
          initialEmail={session.user?.email ?? ''}
        />
      </SafeContainer>
    </BottomSheetModalProvider>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerControl: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    // elevation-floating per Sable
    shadowColor: '#0F1216',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
  },
})
