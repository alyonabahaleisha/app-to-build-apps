/**
 * VoiceMicWaitlistSheet — Gorhom Bottom Sheet opened when the user taps
 * the mic icon in the prompt input. Reuses the Out-of-Scope email-capture
 * pattern with capability='transcription'.
 *
 * T-0011-197: tap mic → this sheet opens
 * T-0011-198: valid submit → POST /out-of-scope-intent with capability=transcription
 */
import {BottomSheetModal, BottomSheetScrollView} from '@gorhom/bottom-sheet'
import {forwardRef, useCallback, useState} from 'react'
import {Pressable, StyleSheet, Text, TextInput, View} from 'react-native'

import {useToast} from '#/components/ToastProvider'
import {apiFetch} from '#/lib/api'
import {useAppShellTheme} from '#/theme/AppShellThemeProvider'

import {createCopy} from './copy'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface Props {
  /**
   * Pre-fill email from session if available.
   */
  initialEmail?: string
}

export const VoiceMicWaitlistSheet = forwardRef<BottomSheetModal, Props>(
  function VoiceMicWaitlistSheet({initialEmail = ''}, ref) {
    const theme = useAppShellTheme()
    const toast = useToast()

    const [email, setEmail] = useState(initialEmail)
    const [submitting, setSubmitting] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [emailError, setEmailError] = useState('')

    const isEmailValid = EMAIL_RE.test(email.trim())
    const canSubmit = isEmailValid && !submitting && !submitted

    const handleSubmit = useCallback(async () => {
      if (!canSubmit) return

      const trimmedEmail = email.trim()
      if (!EMAIL_RE.test(trimmedEmail)) {
        setEmailError(createCopy.voiceMicSheetEmailInvalid)
        return
      }
      setEmailError('')
      setSubmitting(true)

      try {
        await apiFetch('/out-of-scope-intent', {
          method: 'POST',
          body: JSON.stringify({
            capability: 'transcription',
            email: trimmedEmail,
          }),
        })
        setSubmitted(true)
      } catch {
        toast.show("Couldn't save. Try again.", {variant: 'error'})
      } finally {
        setSubmitting(false)
      }
    }, [canSubmit, email, toast])

    const captionStyle = {
      fontSize: theme.type.caption.size,
      fontWeight: String(theme.type.caption.weight) as '400',
      lineHeight: theme.type.caption.lineHeight,
    }
    const bodyStyle = {
      fontSize: theme.type.body.size,
      fontWeight: String(theme.type.body.weight) as '400',
      lineHeight: theme.type.body.lineHeight,
    }

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={['50%']}
        enablePanDownToClose
        backgroundStyle={{backgroundColor: theme.bg}}
        handleIndicatorStyle={{backgroundColor: theme.divider}}
      >
        <BottomSheetScrollView
          contentContainerStyle={[styles.content, {padding: 24}]}
        >
          <Text
            style={[
              styles.title,
              bodyStyle,
              {color: theme.fg, fontWeight: '600'},
            ]}
          >
            {createCopy.voiceMicSheetTitle}
          </Text>

          {submitted ? (
            <Text
              style={[captionStyle, {color: theme['fg-muted'], marginTop: 12}]}
              testID="voice-waitlist-success"
            >
              {createCopy.voiceMicSheetSuccess}
            </Text>
          ) : (
            <View style={styles.form}>
              <Text style={[captionStyle, {color: theme['fg-muted']}]}>
                {createCopy.voiceMicSheetEmailLabel}
              </Text>
              <TextInput
                value={email}
                onChangeText={text => {
                  setEmail(text)
                  setEmailError('')
                }}
                placeholder={createCopy.voiceMicSheetEmailPlaceholder}
                placeholderTextColor={theme['fg-muted']}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                accessibilityLabel={createCopy.voiceMicSheetEmailLabel}
                style={[
                  styles.emailInput,
                  bodyStyle,
                  {
                    color: theme.fg,
                    backgroundColor: theme['bg-elevated'],
                    borderColor: emailError ? theme.danger : theme.divider,
                    borderRadius: theme.radii['radius-md'],
                  },
                ]}
                testID="voice-waitlist-email-input"
              />
              {emailError ? (
                <Text
                  style={[captionStyle, {color: theme.danger}]}
                  accessibilityLiveRegion="polite"
                  testID="voice-waitlist-email-error"
                >
                  {emailError}
                </Text>
              ) : null}

              <Pressable
                onPress={handleSubmit}
                disabled={!canSubmit}
                accessibilityRole="button"
                accessibilityLabel={createCopy.voiceMicSheetSubmit}
                accessibilityState={{disabled: !canSubmit, busy: submitting}}
                style={[
                  styles.submitButton,
                  {
                    backgroundColor: theme.accent,
                    borderRadius: theme.radii['radius-md'],
                    opacity: !canSubmit ? 0.5 : 1,
                  },
                ]}
                testID="voice-waitlist-submit"
              >
                <Text style={[bodyStyle, {color: theme['accent-fg'], fontWeight: '600'}]}>
                  {createCopy.voiceMicSheetSubmit}
                </Text>
              </Pressable>
            </View>
          )}
        </BottomSheetScrollView>
      </BottomSheetModal>
    )
  },
)

const styles = StyleSheet.create({
  content: {gap: 0},
  title: {marginBottom: 16},
  form: {gap: 8},
  emailInput: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
  },
  submitButton: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
})
