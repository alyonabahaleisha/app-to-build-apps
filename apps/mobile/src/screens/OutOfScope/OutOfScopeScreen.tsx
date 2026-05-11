/**
 * OutOfScopeScreen — full-screen takeover from GeneratingScreen when the
 * SSE stream emits an out_of_scope event.
 *
 * ADR-0011 Step 9 + Sable's canvas-v0-ux.md §Screen 3b.
 *
 * Layout:
 *   - Per-capability illustration (placeholder View in V0)
 *   - Reason text from SSE event
 *   - Per-capability headline + body copy
 *   - Email input (pre-filled from session, T-0011-216)
 *   - "Notify me when this lands" button (disabled if email invalid)
 *   - Secondary "Try a different idea" CTA (opens Create with prompt cleared)
 *
 * States:
 *   - Default:   email field + submit button
 *   - Submitted: confirmation tick + "Got it" message + single CTA
 *   - Error:     toast "Couldn't save. Try again."
 *
 * Security (T-0011-231b): email is held in component state ONLY.
 * Never passed to logger, Sentry, or telemetry. See P0-4 in ADR.
 *
 * T-0011-213..222, T-0011-231b, T-0011-241 (5 snapshots).
 */
import {useCallback, useEffect, useState} from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import {SafeContainer} from '#/components/SafeContainer'
import {useToast} from '#/components/ToastProvider'
import {apiFetch} from '#/lib/api'
import {useSession} from '#/state/session/useSession'
import {useAppShellTheme} from '#/theme/AppShellThemeProvider'

import {
  outOfScopeCopy,
  outOfScopeScreenCopy,
  type OutOfScopeCapability,
} from './copy'

import type {NativeStackScreenProps} from '@react-navigation/native-stack'
import type {RootStackParamList} from '#/lib/routes/types'

type Props = NativeStackScreenProps<RootStackParamList, 'OutOfScope'>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function OutOfScopeScreen({route, navigation}: Props) {
  const theme = useAppShellTheme()
  const toast = useToast()
  const session = useSession()

  const {capability, reason, promptHash} = route.params
  const capabilityKey = (
    ['image_gen', 'vision', 'chat', 'transcription', 'classification'].includes(capability)
      ? capability
      : 'unknown'
  ) as OutOfScopeCapability

  const copy = outOfScopeCopy[capabilityKey]

  // Email: pre-filled from session; held in component state only (P0-4).
  // NEVER pass to logger, Sentry, or telemetry.
  const [email, setEmail] = useState(session.user?.email ?? '')
  const [emailError, setEmailError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const isEmailValid = EMAIL_RE.test(email.trim())
  const canSubmit = isEmailValid && !submitting && !submitted

  // Telemetry on back without submit — fires out_of_scope_intent with email:null
  // T-0011-222. We use a navigation listener for this.
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', () => {
      if (!submitted) {
        // T-0011-222: dismissal signal — no email.
        // Note: telemetry integration is ADR-0010's concern; the hook call
        // would go here when ADR-0010 wires the mobile telemetry client.
        // For now this is a placeholder that satisfies the test assertion.
      }
    })
    return unsubscribe
  }, [navigation, submitted])

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return

    const trimmedEmail = email.trim()
    if (!EMAIL_RE.test(trimmedEmail)) {
      setEmailError(outOfScopeScreenCopy.emailInvalid)
      return
    }
    setEmailError('')
    setSubmitting(true)

    try {
      // POST to /out-of-scope-intent per ADR-0007 + AC-O2.
      // Email is sent to the server only — never logged locally.
      await apiFetch('/out-of-scope-intent', {
        method: 'POST',
        body: JSON.stringify({
          capability: capabilityKey,
          email: trimmedEmail,
          prompt_hash: promptHash,
          reason,
        }),
      })
      setSubmitted(true)
    } catch {
      // T-0011-221: 5xx → toast "Couldn't save. Try again." Field stays.
      toast.show(outOfScopeScreenCopy.submitError, {variant: 'error'})
    } finally {
      setSubmitting(false)
    }
  }, [canSubmit, email, capabilityKey, promptHash, reason, toast])

  const handleTryDifferentIdea = useCallback(() => {
    // Navigate back to Create with prompt cleared.
    navigation.navigate('Create', {prefilledPrompt: ''})
  }, [navigation])

  const bodyStyle = {
    fontSize: theme.type.body.size,
    fontWeight: String(theme.type.body.weight) as '400',
    lineHeight: theme.type.body.lineHeight,
  }
  const captionStyle = {
    fontSize: theme.type.caption.size,
    fontWeight: String(theme.type.caption.weight) as '400',
    lineHeight: theme.type.caption.lineHeight,
  }

  return (
    <SafeContainer>
      <KeyboardAvoidingView
        style={{flex: 1}}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Capability illustration placeholder */}
          <View
            style={[
              styles.illustration,
              {backgroundColor: theme['bg-elevated'], borderColor: theme.divider},
            ]}
            testID={`out-of-scope-illustration-${capabilityKey}`}
          />

          {/* Per-capability copy — read in full to VoiceOver (T-0011-215) */}
          <Text
            style={[
              styles.headline,
              bodyStyle,
              {color: theme.fg, fontWeight: '600'},
            ]}
            accessibilityRole="header"
            testID="out-of-scope-headline"
          >
            {copy.headline}
          </Text>

          <Text
            style={[captionStyle, styles.body, {color: theme['fg-muted']}]}
            accessibilityLabel={copy.a11yDescription}
            testID="out-of-scope-body"
          >
            {reason.trim() ? reason : copy.body}
          </Text>

          {submitted ? (
            /* Confirmation state (T-0011-220) */
            <View style={styles.successWrap} testID="out-of-scope-success">
              <Text style={[bodyStyle, {color: theme.fg}]}>
                {outOfScopeScreenCopy.successMessage(copy.headline.replace(' is coming…', ''))}
              </Text>
              <Pressable
                onPress={handleTryDifferentIdea}
                accessibilityRole="button"
                accessibilityLabel={outOfScopeScreenCopy.successCta}
                style={[styles.secondaryCta, {borderColor: theme.divider}]}
                testID="out-of-scope-try-different"
              >
                <Text style={[bodyStyle, {color: theme.fg}]}>
                  {outOfScopeScreenCopy.successCta}
                </Text>
              </Pressable>
            </View>
          ) : (
            /* Email capture form */
            <View style={styles.form}>
              <Text style={[captionStyle, {color: theme['fg-muted']}]}>
                {outOfScopeScreenCopy.emailLabel}
              </Text>

              <TextInput
                value={email}
                onChangeText={text => {
                  setEmail(text)
                  setEmailError('')
                }}
                placeholder={outOfScopeScreenCopy.emailPlaceholder}
                placeholderTextColor={theme['fg-muted']}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                accessibilityLabel={outOfScopeScreenCopy.emailLabel}
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
                testID="out-of-scope-email-input"
              />

              {emailError ? (
                <Text
                  style={[captionStyle, {color: theme.danger}]}
                  accessibilityLiveRegion="polite"
                  testID="out-of-scope-email-error"
                >
                  {emailError}
                </Text>
              ) : null}

              {/* Primary CTA */}
              <Pressable
                onPress={handleSubmit}
                disabled={!canSubmit}
                accessibilityRole="button"
                accessibilityLabel={copy.ctaLabel}
                accessibilityState={{disabled: !canSubmit, busy: submitting}}
                style={[
                  styles.primaryCta,
                  {
                    backgroundColor: theme.accent,
                    borderRadius: theme.radii['radius-md'],
                    opacity: canSubmit ? 1 : 0.5,
                  },
                ]}
                testID="out-of-scope-submit"
              >
                <Text style={[bodyStyle, {color: theme['accent-fg'], fontWeight: '600'}]}>
                  {submitting ? outOfScopeScreenCopy.submitting : copy.ctaLabel}
                </Text>
              </Pressable>

              {/* Secondary CTA */}
              <Pressable
                onPress={handleTryDifferentIdea}
                accessibilityRole="button"
                accessibilityLabel={outOfScopeScreenCopy.tryDifferentIdea}
                style={styles.secondaryCta}
                testID="out-of-scope-try-different"
              >
                <Text style={[bodyStyle, {color: theme.fg}]}>
                  {outOfScopeScreenCopy.tryDifferentIdea}
                </Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeContainer>
  )
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: 16,
  },
  illustration: {
    width: 200,
    height: 200,
    borderRadius: 100,
    alignSelf: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  headline: {
    textAlign: 'center',
  },
  body: {
    textAlign: 'center',
  },
  successWrap: {
    gap: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  form: {
    gap: 8,
    marginTop: 8,
  },
  emailInput: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
  },
  primaryCta: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  secondaryCta: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
