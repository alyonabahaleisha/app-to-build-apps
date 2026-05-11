/**
 * GeneratingScreen — full-screen modal pushed from CreateScreen FAB tap.
 * Consumes SSE from POST /generate; manages client-paced progress bar.
 *
 * ADR-0011 Step 9 + Sable's canvas-v0-ux.md §Screen 3a.
 *
 * States:
 *   - Generating (thinking/building/stalled): progress bar + message cycler
 *   - Network drop (stalled): "Waiting for connection…" + "Cancel and retry"
 *   - Normal cancel: confirmation alert (T-0011-231a)
 *   - Done: navigate to Run via navigation.replace
 *   - Out-of-scope: navigate to OutOfScope
 *   - Quota exhausted: navigate to QuotaExhausted
 *   - Error 4xx (invalid_spec, prompt_too_large): pop to Create with toast
 *   - Error 5xx: pop to Create with toast
 *
 * T-0011-208..236 (+ 231a, 231b).
 */
import {Alert} from 'react-native'
import {useCallback, useEffect} from 'react'
import {Pressable, StyleSheet, Text, View} from 'react-native'

import {SafeContainer} from '#/components/SafeContainer'
import {useToast} from '#/components/ToastProvider'
import {useGenerateMutation, isActivePhase} from '#/state/queries/generate'
import {useAppShellTheme} from '#/theme/AppShellThemeProvider'

import {MessageCycler} from './MessageCycler'
import {ProgressBar} from './ProgressBar'
import {generatingCopy} from './generatingCopy'

import type {NativeStackScreenProps} from '@react-navigation/native-stack'
import type {RootStackParamList} from '#/lib/routes/types'

type Props = NativeStackScreenProps<RootStackParamList, 'Generating'>

export function GeneratingScreen({route, navigation}: Props) {
  const theme = useAppShellTheme()
  const toast = useToast()
  const {prompt, editingMiniAppId} = route.params

  const {phase, result, outOfScope, quotaExhausted, error, generate, reset} =
    useGenerateMutation()

  const isGenerating = isActivePhase(phase)
  const isStalled = phase === 'stalled'
  const isComplete = phase === 'done'

  // Start generation on mount.
  useEffect(() => {
    void generate({
      prompt,
      ...(editingMiniAppId ? {parentProjectId: editingMiniAppId} : {}),
    })
    // Run on mount only — `generate` and `prompt` are stable for the screen's lifetime.
  }, [])

  // Done → navigate to Run.
  useEffect(() => {
    if (phase === 'done' && result) {
      navigation.replace('Run', {miniAppId: result.miniApp.id})
    }
  }, [phase, result, navigation])

  // Out-of-scope → navigate to OutOfScope screen.
  useEffect(() => {
    if (phase === 'out_of_scope' && outOfScope) {
      navigation.replace('OutOfScope', {
        capability: outOfScope.capability,
        reason: outOfScope.reason,
        promptHash: outOfScope.prompt_hash,
        originalPrompt: prompt,
      })
    }
  }, [phase, outOfScope, navigation, prompt])

  // Quota exhausted → navigate to QuotaExhausted screen.
  useEffect(() => {
    if (phase === 'quota_exhausted' && quotaExhausted) {
      navigation.replace('QuotaExhausted', {resetAt: quotaExhausted.resetAt})
    }
  }, [phase, quotaExhausted, navigation])

  // Error → pop to Create with toast.
  useEffect(() => {
    if (phase !== 'error' || !error) return

    let toastMessage: string
    if (error.code === 'invalid_spec') {
      toastMessage = "I couldn't turn that into a tool. Try a different idea."
    } else if (error.code === 'prompt_too_large') {
      toastMessage = 'Your prompt is too long. Please shorten it and try again.'
    } else if (error.code === 'connection_lost') {
      // Handled inline — "Waiting for connection…" state.
      return
    } else {
      toastMessage = 'Something went wrong on our end. Try again.'
    }

    toast.show(toastMessage, {variant: 'error'})
    navigation.goBack()
  }, [phase, error, toast, navigation])

  // Normal-flow cancel: confirmation alert (T-0011-231a).
  const handleCancel = useCallback(() => {
    if (!isGenerating) return

    Alert.alert(
      generatingCopy.cancelAlertTitle,
      generatingCopy.cancelAlertBody,
      [
        {
          text: generatingCopy.cancelAlertKeepWaiting,
          style: 'cancel',
          // Default is "Keep waiting" — alert dismisses, stream continues.
        },
        {
          text: generatingCopy.cancelAlertCancel,
          style: 'destructive',
          onPress: () => {
            reset()
            navigation.goBack()
          },
        },
      ],
    )
  }, [isGenerating, reset, navigation])

  // Cancel and retry for network drop.
  const handleCancelAndRetry = useCallback(() => {
    reset()
    navigation.goBack()
  }, [reset, navigation])

  return (
    <SafeContainer>
      <View style={styles.root} testID="generating-screen-root">
        {/* Header */}
        <Text
          style={[
            styles.headline,
            {
              fontSize: theme.type.h2.size,
              fontWeight: String(theme.type.h2.weight) as '600',
              lineHeight: theme.type.h2.lineHeight,
              color: theme.fg,
            },
          ]}
          accessibilityRole="header"
          testID="generating-headline"
        >
          {generatingCopy.headline}
        </Text>

        {/* Progress bar */}
        <View style={styles.progressWrap}>
          <ProgressBar complete={isComplete} />
        </View>

        {/* Cycled message */}
        {isStalled ? (
          <View style={styles.stalledRow}>
            <Text
              style={[
                {
                  fontSize: theme.type.body.size,
                  fontWeight: String(theme.type.body.weight) as '400',
                  lineHeight: theme.type.body.lineHeight,
                  color: theme['fg-muted'],
                  textAlign: 'center',
                },
              ]}
              accessibilityLiveRegion="polite"
              testID="generating-stalled-message"
            >
              {generatingCopy.waitingForConnection}
            </Text>
            <Pressable
              onPress={handleCancelAndRetry}
              accessibilityRole="button"
              accessibilityLabel={generatingCopy.cancelAndRetry}
              hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
              style={[styles.cancelRetryButton, {borderColor: theme.accent}]}
              testID="cancel-and-retry-button"
            >
              <Text
                style={{
                  fontSize: theme.type.body.size,
                  color: theme.accent,
                  fontWeight: '600',
                }}
              >
                {generatingCopy.cancelAndRetry}
              </Text>
            </Pressable>
          </View>
        ) : (
          <MessageCycler frozen={isComplete} />
        )}

        {/* Normal-flow cancel button */}
        {isGenerating && !isStalled ? (
          <Pressable
            onPress={handleCancel}
            accessibilityRole="button"
            accessibilityLabel={generatingCopy.cancel}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
            style={styles.cancelButton}
            testID="generating-cancel-button"
          >
            <Text
              style={{
                fontSize: theme.type.body.size,
                color: theme['fg-muted'],
              }}
            >
              {generatingCopy.cancel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </SafeContainer>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 24,
  },
  headline: {
    textAlign: 'center',
  },
  progressWrap: {
    width: '100%',
  },
  stalledRow: {
    alignItems: 'center',
    gap: 16,
  },
  cancelRetryButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  cancelButton: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
})

