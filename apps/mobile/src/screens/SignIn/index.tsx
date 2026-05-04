/**
 * Sign-In screen — Screen 1 from `docs/ux/app-creation-poc-ux.md`.
 *
 * State matrix (per Sable's UX doc):
 *   - Default                — email empty, primary disabled.
 *   - Email empty            — same as Default.
 *   - Email invalid format   — inline error under input, primary disabled.
 *   - Email valid            — primary enabled.
 *   - Sending                — primary shows spinner + "Sending…", disabled.
 *   - Sent (success)         — confirmation view: ✓, headline, bold email,
 *                              "Resend" button (30s cooldown — T-0001-125).
 *   - Sent (error)           — toast (variant per error class — T-0001-091,
 *                              T-0001-135, T-0001-093).
 *   - Token tapped/verifying — full-screen spinner ("Signing you in…").
 *   - Token expired/used     — banner above form ("That link expired…").
 *
 * Send-debounce (T-0001-126): the second tap is ignored because the Send
 * button's `disabled` is wired to `mutation.isPending`. The mutation hook
 * has `retry: false`; one-tap = one network call.
 */
import {Feather} from '@expo/vector-icons'
import {useCallback, useEffect, useRef, useState} from 'react'
import {Pressable, StyleSheet, Text, View} from 'react-native'

import {Button} from '#/components/Button'
import {SafeContainer} from '#/components/SafeContainer'
import {useToast} from '#/components/ToastProvider'
import {classifyMagicLinkError, useMagicLinkMutation} from '#/state/queries/auth'
import {useSession} from '#/state/session/useSession'
import {useTheme} from '#/theme'

import {EmailInput} from './components/EmailInput'
import {signInCopy} from './copy'

import type {NativeStackScreenProps} from '@react-navigation/native-stack'
import type {RootStackParamList} from '#/lib/routes/types'

const RESEND_COOLDOWN_MS = 30_000

type Props = NativeStackScreenProps<RootStackParamList, 'SignIn'>

interface PublicProps extends Partial<Props> {
  /**
   * Show the "That link expired" banner. The Navigator flips this when a
   * redeem attempt fails. Optional — tests pass it directly.
   */
  showExpiredBanner?: boolean
  onDismissExpiredBanner?: () => void
}

export function SignIn({showExpiredBanner = false, onDismissExpiredBanner}: PublicProps = {}) {
  const theme = useTheme()
  const toast = useToast()
  const session = useSession()
  const mutation = useMagicLinkMutation()

  const [email, setEmail] = useState('')
  const [emailValid, setEmailValid] = useState(false)
  /**
   * Distinguishes "not started" from "actively typing then deleted to empty"
   * so we don't flash the inline error when the user hasn't typed yet.
   */
  const [touched, setTouched] = useState(false)
  // `sentAt` doubles as the "sent" state marker. null = not sent.
  const [sentAt, setSentAt] = useState<number | null>(null)
  const [sentToEmail, setSentToEmail] = useState<string>('')
  // Tick to recompute the resend cooldown disabled state every second.
  const [, setNowTick] = useState(0)

  const handleEmailChange = useCallback((value: string, isValid: boolean) => {
    if (!touched && value.length > 0) setTouched(true)
    setEmail(value)
    setEmailValid(isValid)
  }, [touched])

  /**
   * In-flight ref — synchronously gates rapid re-taps before React state
   * (`mutation.isPending`) settles. Without this, a second press fired
   * before the next render carries the *previous* render's closure (where
   * `mutation.isPending` was still `false`) and slips through. T-0001-126
   * verifies the call count == 1.
   */
  const inFlightRef = useRef(false)

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
          kind === 'rate_limited'
            ? signInCopy.errorRateLimited
            : kind === 'offline'
              ? signInCopy.errorOffline
              : signInCopy.errorServer
        toast.show(message, {variant: 'error'})
      } finally {
        inFlightRef.current = false
      }
    },
    [mutation, toast],
  )

  const handleSend = useCallback(() => {
    if (mutation.isPending || inFlightRef.current) return // T-0001-126
    void fireMagicLink(email)
  }, [email, fireMagicLink, mutation.isPending])

  // Resend cooldown: tick every second so disabled flips at t=30s without
  // a user interaction. Cleared on unmount or when sentAt clears.
  useEffect(() => {
    if (sentAt === null) return
    const timer = setInterval(() => {
      setNowTick((n) => n + 1)
      // Stop ticking once cooldown elapses.
      if (Date.now() - sentAt >= RESEND_COOLDOWN_MS) {
        clearInterval(timer)
      }
    }, 1_000)
    return () => clearInterval(timer)
  }, [sentAt])

  // Computed on every render — the periodic `setNowTick` (above) is what
  // drives recomputation; including it in a `useMemo` deps list is brittle
  // (relies on tick increments == time deltas), so we just compute fresh.
  const cooldownActive = sentAt !== null && Date.now() - sentAt < RESEND_COOLDOWN_MS

  const handleResend = useCallback(() => {
    if (cooldownActive || mutation.isPending || inFlightRef.current) return
    // Re-fire and reset the cooldown.
    void fireMagicLink(sentToEmail || email)
  }, [cooldownActive, mutation.isPending, fireMagicLink, sentToEmail, email])

  const handleSkipAuth = useCallback(() => {
    session.skipAuth()
  }, [session])

  // Token-verifying state: while session is hydrating mid-redeem,
  // show the full-screen spinner per Sable's state matrix.
  if (session.status === 'loading') {
    return (
      <SafeContainer>
        <View style={styles.verifyingContainer}>
          <Text
            style={[
              theme.typography.heading2,
              {color: theme.palette.text.primary, textAlign: 'center'},
            ]}
            accessibilityRole="header"
          >
            {signInCopy.verifyingHeadline}
          </Text>
        </View>
      </SafeContainer>
    )
  }

  // Sent state — confirmation view + Resend.
  if (sentAt !== null) {
    return (
      <SafeContainer>
        <View style={styles.formWrap}>
          <View style={styles.successHeader}>
            <Feather
              name="check-circle"
              size={48}
              color={theme.palette.primary}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
          </View>
          <Text
            style={[
              styles.headline,
              theme.typography.heading1,
              {color: theme.palette.text.primary},
            ]}
            accessibilityRole="header"
          >
            {signInCopy.sentHeadlinePrefix}
          </Text>
          <Text
            style={[styles.subhead, theme.typography.body, {color: theme.palette.text.muted}]}
          >
            {signInCopy.sentSubheadPrefix}
            <Text
              style={[theme.typography.bodyStrong, {color: theme.palette.text.primary}]}
            >
              {sentToEmail}
            </Text>
            {signInCopy.sentSubheadSuffix}
          </Text>
          <Button
            label={signInCopy.primaryResend}
            accessibilityLabel={signInCopy.a11ySendResend}
            onPress={handleResend}
            disabled={cooldownActive || mutation.isPending}
            loading={mutation.isPending}
            testID="sign-in-resend"
          />
          <Text
            style={[styles.footer, theme.typography.caption, {color: theme.palette.text.muted}]}
          >
            {signInCopy.footer}
          </Text>
        </View>
      </SafeContainer>
    )
  }

  const showInlineError = touched && email.length > 0 && !emailValid
  const sendLabel = mutation.isPending ? signInCopy.primarySending : signInCopy.primaryDefault
  const a11ySendLabel = mutation.isPending
    ? signInCopy.a11ySendSending
    : signInCopy.a11ySendDefault
  const sendDisabled = !emailValid || mutation.isPending

  return (
    <SafeContainer>
      <View style={styles.formWrap}>
        {showExpiredBanner ? (
          <View
            style={[
              styles.banner,
              {
                backgroundColor: theme.palette.bg.subtle,
                borderColor: theme.palette.border.subtle,
                borderRadius: theme.radius.md,
              },
            ]}
          >
            <Text
              style={[
                styles.bannerText,
                theme.typography.body,
                {color: theme.palette.text.primary},
              ]}
              accessibilityLiveRegion="polite"
            >
              {signInCopy.expiredBanner}
            </Text>
            <Pressable
              onPress={() => onDismissExpiredBanner?.()}
              accessibilityRole="button"
              accessibilityLabel={signInCopy.expiredDismiss}
              hitSlop={8}
              testID="sign-in-expired-dismiss"
            >
              <Feather name="x" size={20} color={theme.palette.text.muted} />
            </Pressable>
          </View>
        ) : null}
        <Text
          style={[
            styles.headline,
            theme.typography.heading1,
            {color: theme.palette.text.primary},
          ]}
          accessibilityRole="header"
        >
          {signInCopy.headline}
        </Text>
        <Text
          style={[styles.subhead, theme.typography.body, {color: theme.palette.text.muted}]}
        >
          {signInCopy.subhead}
        </Text>
        <EmailInput
          value={email}
          onChange={handleEmailChange}
          showError={showInlineError}
          editable={!mutation.isPending}
          testID="sign-in-email"
        />
        <Button
          label={sendLabel}
          accessibilityLabel={a11ySendLabel}
          onPress={handleSend}
          disabled={sendDisabled}
          loading={mutation.isPending}
          testID="sign-in-send"
        />
        <Pressable
          onPress={handleSkipAuth}
          accessibilityRole="button"
          accessibilityLabel={signInCopy.a11ySkipAuth}
          hitSlop={8}
          style={styles.skipAuth}
          testID="sign-in-skip"
        >
          <Text
            style={[
              theme.typography.body,
              {color: theme.palette.text.muted, textAlign: 'center'},
            ]}
          >
            {signInCopy.skipAuth}
          </Text>
        </Pressable>
        <Text
          style={[styles.footer, theme.typography.caption, {color: theme.palette.text.muted}]}
        >
          {signInCopy.footer}
        </Text>
      </View>
    </SafeContainer>
  )
}

// Default-export wrapped for navigator props. Named export above is the
// canonical screen; this preserves the navigation typing.
export function SignInScreen(_: Props) {
  return <SignIn />
}

const styles = StyleSheet.create({
  verifyingContainer: {flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24},
  formWrap: {paddingHorizontal: 24, paddingTop: 64, gap: 16},
  successHeader: {alignItems: 'center', marginBottom: 16},
  headline: {textAlign: 'left'},
  subhead: {marginTop: 8, marginBottom: 16},
  footer: {marginTop: 8, textAlign: 'left'},
  skipAuth: {marginTop: 4, paddingVertical: 8, alignItems: 'center'},
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  bannerText: {flex: 1, marginRight: 8},
})
