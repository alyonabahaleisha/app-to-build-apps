/**
 * EmailEntrySheet — Gorhom bottom sheet for the magic-link email entry path.
 *
 * Opened by `SignInScreen` when `EXPO_PUBLIC_AUTH_PROVIDER=magic-link` (the
 * default). Re-houses M1's email-entry + send + resend logic per ADR-0011
 * Step 7: "existing M1 logic re-housed, NOT a rewrite."
 *
 * The sheet resolves the `magicLinkProvider` promise on successful token
 * exchange, or rejects it with `AuthCanceledError` when dismissed by the user.
 *
 * States (per Sable's UX doc §Screen 1):
 *   - Default: email empty, Send disabled
 *   - Email valid: Send enabled
 *   - Sending: spinner, disabled
 *   - Sent: confirmation view + Resend (30s cooldown)
 *   - Error: toast via parent
 *
 * T-0011-151: EmailEntrySheet rejects empty input
 * T-0011-152: EmailEntrySheet accepts valid email
 * T-0011-153: On 5xx, toast "Sign-in failed. Try again."
 */
import {BottomSheetModal, BottomSheetScrollView, BottomSheetTextInput} from '@gorhom/bottom-sheet'
import {forwardRef, useCallback, useEffect, useRef, useState} from 'react'
import {Pressable, StyleSheet, Text, View} from 'react-native'

import {Button} from '#/components/Button'
import {useToast} from '#/components/ToastProvider'
import {classifyMagicLinkError, useMagicLinkMutation} from '#/state/queries/auth'
import {useAppShellTheme} from '#/theme/AppShellThemeProvider'
import type {AuthSignInResult} from '#/lib/auth/types'

import {signInCopy} from './copy'

// Anchored email regex — mirrors M1 EmailInput. Must allow UTF-8 local parts
// in principle but keeps the same minimal pattern for V0.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isValidEmail(v: string): boolean {
  return EMAIL_RE.test(v.trim())
}

const RESEND_COOLDOWN_MS = 30_000
const SNAP_POINTS = ['50%']

interface Props {
  /** Called by the sheet when the user successfully redeems a magic link. */
  onResolved: (result: AuthSignInResult) => void
  /** Called when the user dismisses the sheet without completing sign-in. */
  onCanceled: () => void
  /** Set to true to show the "That link expired" banner above the email form. */
  showExpiredBanner?: boolean
  onDismissExpiredBanner?: () => void
}

export const EmailEntrySheet = forwardRef<BottomSheetModal, Props>(function EmailEntrySheet(
  // `onResolved` will be called once ADR-0013 wires the deep-link token-exchange
  // callback. Until then it is intentionally unused — prefixed with `_` to signal this.
  {onResolved: _onResolved, onCanceled, showExpiredBanner = false, onDismissExpiredBanner},
  ref,
) {
  const theme = useAppShellTheme()
  const toast = useToast()
  const mutation = useMagicLinkMutation()

  const [email, setEmail] = useState('')
  const [touched, setTouched] = useState(false)
  const [sentAt, setSentAt] = useState<number | null>(null)
  const [sentToEmail, setSentToEmail] = useState('')
  const [, setNowTick] = useState(0)

  const inFlightRef = useRef(false)

  const handleEmailChange = useCallback(
    (raw: string) => {
      const trimmed = raw.trim()
      if (!touched && trimmed.length > 0) setTouched(true)
      setEmail(trimmed)
    },
    [touched],
  )

  const fireMagicLink = useCallback(
    async (target: string) => {
      if (inFlightRef.current) return
      inFlightRef.current = true
      try {
        await mutation.mutateAsync({email: target})
        setSentAt(Date.now())
        setSentToEmail(target)
      } catch (err: unknown) {
        const kind = classifyMagicLinkError(err)
        const message =
          kind === 'rate_limited' ? signInCopy.errorRateLimited
          : kind === 'offline' ? signInCopy.errorOffline
          : signInCopy.errorServer
        toast.show(message, {variant: 'error'})
      } finally {
        inFlightRef.current = false
      }
    },
    [mutation, toast],
  )

  const handleSend = useCallback(() => {
    if (mutation.isPending || inFlightRef.current) return
    void fireMagicLink(email)
  }, [email, fireMagicLink, mutation.isPending])

  // Resend cooldown ticker.
  useEffect(() => {
    if (sentAt === null) return
    const timer = setInterval(() => {
      setNowTick(n => n + 1)
      if (Date.now() - sentAt >= RESEND_COOLDOWN_MS) clearInterval(timer)
    }, 1_000)
    return () => clearInterval(timer)
  }, [sentAt])

  const cooldownActive = sentAt !== null && Date.now() - sentAt < RESEND_COOLDOWN_MS

  const handleResend = useCallback(() => {
    if (cooldownActive || mutation.isPending || inFlightRef.current) return
    void fireMagicLink(sentToEmail || email)
  }, [cooldownActive, email, fireMagicLink, mutation.isPending, sentToEmail])

  const handleDismiss = useCallback(() => {
    if (ref && 'current' in ref && ref.current) {
      ref.current.dismiss()
    }
  }, [ref])

  // When user swipe-dismisses, surface AuthCanceledError via onCanceled.
  const handleSheetDismiss = useCallback(() => {
    onCanceled()
  }, [onCanceled])

  // `_onResolved` will be called once ADR-0013 wires the deep-link token-exchange
  // callback into this sheet. For now the sheet stays open after "sent" state
  // until the user taps the magic-link and the navigation layer handles the redeem.

  const emailValid = isValidEmail(email)
  const showInlineError = touched && email.length > 0 && !emailValid
  const sendDisabled = !emailValid || mutation.isPending

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
      snapPoints={SNAP_POINTS}
      backgroundStyle={{backgroundColor: theme['bg-elevated']}}
      handleIndicatorStyle={{backgroundColor: theme.divider}}
      enablePanDownToClose
      enableDismissOnClose
      onDismiss={handleSheetDismiss}
      accessible
    >
      <BottomSheetScrollView contentContainerStyle={styles.content} accessible={false}>
        <View accessibilityViewIsModal style={styles.wrapper}>
          {showExpiredBanner ? (
            <View
              style={[
                styles.banner,
                {
                  backgroundColor: theme['bg-elevated'],
                  borderColor: theme.divider,
                  borderRadius: theme.radii['radius-md'],
                },
              ]}
            >
              <Text
                style={[styles.bannerText, bodyStyle, {color: theme.fg}]}
                accessibilityLiveRegion="polite"
              >
                {signInCopy.expiredBanner}
              </Text>
              <Pressable
                onPress={() => onDismissExpiredBanner?.()}
                accessibilityRole="button"
                accessibilityLabel={signInCopy.expiredDismiss}
                hitSlop={8}
                testID="email-sheet-expired-dismiss"
              >
                <Text style={{color: theme['fg-muted'], fontSize: 18}}>×</Text>
              </Pressable>
            </View>
          ) : null}

          <Text
            style={[styles.heading, {
              fontSize: theme.type.h2.size,
              fontWeight: String(theme.type.h2.weight) as '600',
              lineHeight: theme.type.h2.lineHeight,
              color: theme.fg,
            }]}
            accessibilityRole="header"
          >
            {signInCopy.emailSheetHeadline}
          </Text>
          <Text style={[bodyStyle, {color: theme['fg-muted']}]}>
            {signInCopy.emailSheetSubhead}
          </Text>

          {sentAt !== null ? (
            // Sent confirmation view
            <View style={styles.sentView}>
              <Text
                style={[{
                  fontSize: theme.type.h2.size,
                  fontWeight: String(theme.type.h2.weight) as '600',
                  lineHeight: theme.type.h2.lineHeight,
                  color: theme.fg,
                }]}
                accessibilityRole="header"
              >
                {signInCopy.sentHeadlinePrefix}
              </Text>
              <Text style={[bodyStyle, {color: theme['fg-muted']}]}>
                {signInCopy.sentSubheadPrefix}
                <Text style={{fontWeight: '600' as const, color: theme.fg}}>
                  {sentToEmail}
                </Text>
                {signInCopy.sentSubheadSuffix}
              </Text>
              <Button
                label={signInCopy.emailSendResend}
                accessibilityLabel={signInCopy.a11yEmailSendResend}
                onPress={handleResend}
                disabled={cooldownActive || mutation.isPending}
                loading={mutation.isPending}
                testID="email-sheet-resend"
              />
            </View>
          ) : (
            // Email entry form
            <View style={styles.form}>
              <Text style={[captionStyle, styles.emailLabel, {color: theme['fg-muted']}]}>
                {signInCopy.emailLabel}
              </Text>
              <View
                style={[
                  styles.inputWrap,
                  {
                    borderColor: showInlineError ? theme.danger : theme.divider,
                    borderRadius: theme.radii['radius-md'],
                    backgroundColor: theme.bg,
                  },
                ]}
              >
                <BottomSheetTextInput
                  value={email}
                  onChangeText={handleEmailChange}
                  accessibilityLabel="Email address"
                  placeholder={signInCopy.emailPlaceholder}
                  placeholderTextColor={theme['fg-faint']}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  editable={!mutation.isPending}
                  style={[styles.textInput, bodyStyle, {color: theme.fg}]}
                  testID="email-sheet-input"
                />
              </View>
              {showInlineError ? (
                <Text
                  style={[captionStyle, styles.inlineError, {color: theme.danger}]}
                  accessibilityLiveRegion="polite"
                >
                  {signInCopy.emailInvalid}
                </Text>
              ) : null}
              <Button
                label={mutation.isPending ? signInCopy.emailSendSending : signInCopy.emailSendDefault}
                accessibilityLabel={
                  mutation.isPending ? signInCopy.a11yEmailSendSending : signInCopy.a11yEmailSendDefault
                }
                onPress={handleSend}
                disabled={sendDisabled}
                loading={mutation.isPending}
                testID="email-sheet-send"
              />
            </View>
          )}

          <Pressable
            onPress={handleDismiss}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={styles.cancelRow}
            testID="email-sheet-cancel"
          >
            <Text style={[captionStyle, {color: theme['fg-muted'], textAlign: 'center'}]}>
              Cancel
            </Text>
          </Pressable>
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  )
})

const styles = StyleSheet.create({
  content: {paddingHorizontal: 24, paddingBottom: 40},
  wrapper: {gap: 16},
  heading: {marginTop: 8},
  sentView: {gap: 12},
  form: {gap: 8},
  emailLabel: {marginBottom: 2},
  inputWrap: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  textInput: {padding: 0, minHeight: 24},
  inlineError: {marginTop: 2},
  cancelRow: {paddingVertical: 12, alignItems: 'center'},
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bannerText: {flex: 1, marginRight: 8},
})
