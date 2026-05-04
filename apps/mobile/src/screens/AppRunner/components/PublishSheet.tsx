/**
 * PublishSheet — bottom-sheet modal for publishing a project.
 *
 * Two variants based on `firstPublish`:
 * - first-time: includes HandleField with handle suggestion pre-fill,
 *   immutability lock copy, debounced availability check.
 * - subsequent: shows "You'll publish as @{handle}" copy only.
 *
 * Per Sable's UX doc §Screen 5 (new): Publish bottom-sheet.
 * Per ADR-0002 Step 9 a11y requirements (T-0002-161):
 *   `accessibilityViewIsModal={true}` on sheet content.
 *
 * Uses `@gorhom/bottom-sheet` BottomSheetModal for keyboard avoidance,
 * swipe-to-dismiss, and focus trap.
 *
 * NOTE: Expo SDK 52 / RN 0.76 — `GestureHandlerRootView` must wrap the
 * app (see App.tsx) and `BottomSheetModalProvider` must be mounted above
 * this component (typically in AppRunner or a shared layout provider).
 */
import {
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet'
import {forwardRef, useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import {Button} from '#/components/Button'
import {HandleField, type HandleValidationState} from '#/components/HandleField'
import {useToast} from '#/components/ToastProvider'
import {
  PublishError,
  useCheckHandleQuery,
  useHandleSuggestQuery,
  usePublishMutation,
} from '#/state/queries/marketplace'
import {useTheme} from '#/theme'

// Handle regex: 3–20 lowercase letters, numbers, dashes; can't start/end with dash.
const HANDLE_RE = /^[a-z0-9][a-z0-9-]{1,18}[a-z0-9]$|^[a-z0-9]{3,20}$/

function isValidHandleFormat(h: string): boolean {
  if (h.length < 3 || h.length > 20) return false
  return HANDLE_RE.test(h)
}

// -- Props -------------------------------------------------------------------

interface Props {
  projectId: string
  /**
   * `true` = user has no handle yet (first-time publish variant).
   * `false` = user has a handle (subsequent publish variant).
   */
  firstPublish: boolean
  /** Current user handle — shown in subsequent variant copy. */
  currentHandle: string | null
  /** Called when the sheet successfully dismisses post-publish. */
  onPublishSuccess?: () => void
}

// -- Component ---------------------------------------------------------------

export const PublishSheet = forwardRef<BottomSheetModal, Props>(
  function PublishSheet(
    {projectId, firstPublish, currentHandle, onPublishSuccess},
    ref,
  ) {
    const theme = useTheme()
    const toast = useToast()
    const publishMutation = usePublishMutation()

    // Handle field state
    const [handleValue, setHandleValue] = useState('')
    const [debouncedHandle, setDebouncedHandle] = useState('')
    const [checkEnabled, setCheckEnabled] = useState(false)
    const [inlineError, setInlineError] = useState<string | null>(null)
    const [reduced, setReduced] = useState(false)

    // Handle suggestion pre-fill (first-time only)
    const suggestQuery = useHandleSuggestQuery(firstPublish)

    // Availability check (debounced)
    const checkQuery = useCheckHandleQuery(debouncedHandle, checkEnabled)

    // Resolve reduced motion once on mount
    useEffect(() => {
      let mounted = true
      AccessibilityInfo.isReduceMotionEnabled()
        .then((flag) => {
          if (mounted) setReduced(flag)
        })
        .catch(() => {})
      return () => {
        mounted = false
      }
    }, [])

    // Pre-fill handle from suggestion when it arrives. Also seed the debounced
    // value + enable the availability check so the Publish button can leave
    // its 'checking' state without the user having to retype.
    useEffect(() => {
      if (
        firstPublish &&
        suggestQuery.data?.handle &&
        handleValue === ''
      ) {
        const suggestion = suggestQuery.data.handle.toLowerCase()
        setHandleValue(suggestion)
        if (isValidHandleFormat(suggestion)) {
          setDebouncedHandle(suggestion)
          setCheckEnabled(true)
        }
      }
    }, [firstPublish, suggestQuery.data, handleValue])

    // Debounce: arm a 500ms timer on every keystroke.
    // When it fires: validate regex → if passes, trigger check.
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const handleChange = useCallback((v: string) => {
      setHandleValue(v)
      setInlineError(null)

      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }

      const lowered = v.toLowerCase()

      if (lowered.length === 0) {
        setCheckEnabled(false)
        setDebouncedHandle('')
        return
      }

      if (!isValidHandleFormat(lowered)) {
        setCheckEnabled(false)
        setDebouncedHandle('')
        return
      }

      debounceRef.current = setTimeout(() => {
        setDebouncedHandle(lowered)
        setCheckEnabled(true)
      }, 500)
    }, [])

    // Clean up debounce timer on unmount
    useEffect(() => {
      return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
      }
    }, [])

    // Derive validation state
    const validationState = useMemo((): HandleValidationState => {
      if (!firstPublish) return 'idle'
      const lowered = handleValue.toLowerCase()
      if (lowered.length === 0) return 'idle'
      if (!isValidHandleFormat(lowered)) return 'invalid'
      // Regex passes — are we waiting for debounce?
      if (debouncedHandle !== lowered) return 'checking'
      // Debounce fired — are we waiting for the check?
      if (checkEnabled && checkQuery.isFetching) return 'checking'
      if (checkQuery.data) {
        if (checkQuery.data.available) return 'available'
        if (checkQuery.data.reason === 'reserved') return 'reserved'
        return 'taken'
      }
      if (checkQuery.isSuccess) return 'available'
      // Default while idle / pre-debounce
      return 'idle'
    }, [
      firstPublish,
      handleValue,
      debouncedHandle,
      checkEnabled,
      checkQuery.isFetching,
      checkQuery.data,
      checkQuery.isSuccess,
    ])

    // Submit disabled conditions
    const submitDisabled = useMemo(() => {
      if (publishMutation.isPending) return true
      if (firstPublish) {
        return validationState !== 'available'
      }
      return false
    }, [firstPublish, validationState, publishMutation.isPending])

    // Snap points per Sable's spec
    const snapPoints = useMemo(
      () => (firstPublish ? ['50%'] : ['30%']),
      [firstPublish],
    )

    const handleDismiss = useCallback(() => {
      if (ref && 'current' in ref && ref.current) {
        ref.current.dismiss()
      }
    }, [ref])

    const handlePublish = useCallback(async () => {
      setInlineError(null)
      try {
        await publishMutation.mutateAsync({
          projectId,
          handle: firstPublish ? handleValue.toLowerCase() : undefined,
        })
        handleDismiss()
        toast.show('✓ Published to Library', {durationMs: 2000})
        onPublishSuccess?.()
      } catch (err) {
        if (err instanceof PublishError) {
          if (err.code === 'handle_taken') {
            setInlineError('Handle taken — that one was just claimed. Try another.')
            // Reset check so the field shows 'taken'
            setCheckEnabled(true)
            return
          }
          if (err.code === 'network') {
            setInlineError("Couldn't publish. Try again.")
            return
          }
          if (err.code === 'invalid_state') {
            handleDismiss()
            toast.show("This app couldn't be published. Try recreating it.", {
              variant: 'error',
            })
            return
          }
        }
        setInlineError("Couldn't publish. Try again.")
      }
    }, [
      firstPublish,
      handleValue,
      projectId,
      publishMutation,
      handleDismiss,
      toast,
      onPublishSuccess,
    ])

    const sheetBg = theme.palette.bg.surface

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={snapPoints}
        backgroundStyle={{backgroundColor: sheetBg}}
        handleIndicatorStyle={{backgroundColor: theme.palette.border.subtle}}
        animateOnMount={!reduced}
        enableDismissOnClose
        enablePanDownToClose
        accessible
      >
        <BottomSheetScrollView
          contentContainerStyle={styles.content}
          // a11y: trap VoiceOver focus inside the sheet (T-0002-161)
          accessible={false}
        >
          {/* Invisible a11y modal marker — VoiceOver focuses inside */}
          <View accessibilityViewIsModal style={styles.modalWrapper}>
            {/* Heading */}
            <Text
              style={[
                styles.heading,
                theme.typography.heading2,
                {color: theme.palette.text.primary},
              ]}
              accessibilityRole="header"
              testID="publish-sheet-heading"
            >
              Publish to Library?
            </Text>

            {firstPublish ? (
              <FirstTimeContent
                handleValue={handleValue}
                onChange={handleChange}
                validationState={validationState}
                inlineError={inlineError}
                theme={theme}
              />
            ) : (
              <SubsequentContent
                currentHandle={currentHandle}
                inlineError={inlineError}
                theme={theme}
              />
            )}

            {/* Warning copy */}
            <Text
              style={[
                styles.warningCopy,
                theme.typography.caption,
                {color: theme.palette.text.muted},
              ]}
            >
              Publishing exposes the words you typed.
            </Text>

            {/* Inline error (network/race) */}
            {inlineError && (
              <Text
                style={[
                  styles.inlineError,
                  theme.typography.caption,
                  {color: theme.palette.text.destructive},
                ]}
                accessibilityLiveRegion="polite"
                testID="publish-sheet-inline-error"
              >
                {inlineError}
              </Text>
            )}

            {/* CTA row */}
            <View style={styles.ctaRow}>
              <Pressable
                onPress={handleDismiss}
                accessibilityRole="button"
                accessibilityLabel="Cancel — close without publishing"
                style={[
                  styles.cancelButton,
                  {borderColor: theme.palette.border.subtle},
                ]}
              >
                <Text
                  style={[
                    theme.typography.bodyStrong,
                    {color: theme.palette.text.primary},
                  ]}
                >
                  Cancel
                </Text>
              </Pressable>

              <Button
                label={publishMutation.isPending ? 'Publishing…' : 'Publish'}
                onPress={handlePublish}
                accessibilityLabel="Publish to Library"
                disabled={submitDisabled}
                loading={publishMutation.isPending}
                variant="primary"
                style={styles.publishButton}
                testID="publish-sheet-submit"
              />
            </View>
          </View>
        </BottomSheetScrollView>
      </BottomSheetModal>
    )
  },
)

// -- Sub-components ----------------------------------------------------------

interface FirstTimeProps {
  handleValue: string
  onChange: (v: string) => void
  validationState: HandleValidationState
  inlineError: string | null
  theme: ReturnType<typeof useTheme>
}

function FirstTimeContent({
  handleValue,
  onChange,
  validationState,
  inlineError,
  theme,
}: FirstTimeProps) {
  return (
    <>
      <Text
        style={[
          styles.bodyText,
          theme.typography.body,
          {color: theme.palette.text.muted},
        ]}
      >
        Pick a handle other makers will see.
      </Text>

      {/* Handle field — uses BottomSheetTextInput for keyboard avoidance */}
      <HandleField
        value={handleValue}
        onChange={onChange}
        validationState={validationState}
        errorMessage={inlineError ?? undefined}
        autoFocus={true}
        testID="publish-sheet-handle-input"
      />

      <Text
        style={[
          styles.lockCopy,
          theme.typography.caption,
          {color: theme.palette.text.muted},
        ]}
      >
        You can't change this later.
      </Text>
    </>
  )
}

interface SubsequentProps {
  currentHandle: string | null
  inlineError: string | null
  theme: ReturnType<typeof useTheme>
}

function SubsequentContent({currentHandle, inlineError: _inlineError, theme}: SubsequentProps) {
  return (
    <>
      <Text
        style={[
          styles.bodyText,
          theme.typography.body,
          {color: theme.palette.text.muted},
        ]}
        testID="publish-sheet-subsequent-copy"
      >
        {currentHandle
          ? `You'll publish as @${currentHandle}.\nOther makers will see this in the Library.`
          : 'Other makers will see this in the Library.'}
      </Text>
    </>
  )
}

// -- Styles ------------------------------------------------------------------

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  modalWrapper: {
    gap: 16,
  },
  heading: {
    marginTop: 8,
  },
  bodyText: {
    lineHeight: 22,
  },
  lockCopy: {},
  warningCopy: {},
  inlineError: {},
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
  },
  publishButton: {
    flex: 1,
    maxWidth: 160,
  },
})
