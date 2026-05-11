/**
 * SignInScreen — V0 shell per ADR-0011 Step 7 + Sable's canvas-v0-ux.md §Screen 1.
 *
 * Layout (top → bottom):
 *   - Top safe area
 *   - Centered hero (40% viewport): wordmark "Canvas" + tagline
 *   - Provider-agnostic sign-in button (full-width, 48pt, accent bg, radius-md)
 *   - Footer micro-copy: "By signing in, you agree to our Terms and Privacy Policy."
 *   - Bottom safe area
 *
 * States:
 *   - Default: button enabled
 *   - Signing in: button shows ActivityIndicator, disabled
 *   - Cancelled: no-op; stay on screen (AuthCanceledError swallowed)
 *   - Error: toast "Sign-in failed. Try again."
 *
 * Provider dispatch: reads `EXPO_PUBLIC_AUTH_PROVIDER` via `getAuthProvider()`.
 *   - magic-link (default): opens EmailEntrySheet (Gorhom BottomSheet)
 *   - apple: calls stubbed siwaProvider.signIn() — ADR-0013 fills in real impl
 *
 * Accessibility (per Sable's spec):
 *   - Wordmark: accessibilityRole="header"
 *   - Button: accessibilityRole="button", provider-appropriate label
 *   - Footer links: accessibilityRole="link"
 *   - Focus order: logo → tagline → button → footer links
 *
 * T-0011-142..161 (20 tests in SignInScreen.test.tsx)
 */
import {BottomSheetModal, BottomSheetModalProvider} from '@gorhom/bottom-sheet'
import {Linking} from 'react-native'
import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native'

import {SafeContainer} from '#/components/SafeContainer'
import {useToast} from '#/components/ToastProvider'
import {AuthCanceledError} from '#/lib/auth/errors'
import {getAuthProvider} from '#/lib/auth/getAuthProvider'
import {magicLinkProvider} from '#/lib/auth/magicLinkProvider'
import {useAppShellTheme} from '#/theme/AppShellThemeProvider'

import {EmailEntrySheet} from './EmailEntrySheet'
import {SIGN_IN_URLS, signInCopy} from './copy'

import type {NativeStackScreenProps} from '@react-navigation/native-stack'
import type {RootStackParamList} from '#/lib/routes/types'

type Props = NativeStackScreenProps<RootStackParamList, 'SignIn'>

interface PublicProps extends Partial<Props> {
  /**
   * Show the "That link expired" banner. The navigator flips this when a
   * deep-link redeem attempt fails. Optional — tests pass it directly.
   * Carryover from M1 per T-0011-161.
   */
  showExpiredBanner?: boolean
  onDismissExpiredBanner?: () => void
}

export function SignInScreen({showExpiredBanner = false, onDismissExpiredBanner}: PublicProps = {}) {
  const theme = useAppShellTheme()
  const toast = useToast()

  const provider = useMemo(() => getAuthProvider(), [])
  const isMagicLink = provider.name === 'magic-link'

  const [signingIn, setSigningIn] = useState(false)
  // Track whether the user has dismissed the expired banner. The `showExpiredBanner`
  // prop is authoritative (controlled by Navigation); we track local dismissal.
  const [expiredBannerDismissed, setExpiredBannerDismissed] = useState(false)
  const effectiveExpiredBanner = showExpiredBanner && !expiredBannerDismissed

  // Ref to the EmailEntrySheet — only mounted when provider is magic-link.
  const sheetRef = useRef<BottomSheetModal>(null)
  // Track whether the sheet is open so we can reject the in-flight promise
  // when the user swipe-dismisses without completing.
  const sheetOpenRef = useRef(false)

  // Register the magic-link open callback once. When provider.signIn() is
  // called, magicLinkProvider fires this to open the sheet.
  // useEffect (not useMemo) — side effects must not run in render; Strict Mode
  // and React Compiler may discard or double-invoke useMemo bodies.
  useEffect(() => {
    if (isMagicLink) {
      magicLinkProvider.setOnSignInRequested(() => {
        sheetOpenRef.current = true
        sheetRef.current?.present()
      })
    }
  }, [isMagicLink])

  const handleSignIn = useCallback(async () => {
    if (signingIn) return
    setSigningIn(true)
    try {
      // For magic-link: provider.signIn() opens the sheet and the promise
      // stays pending until the user completes the flow. For now (pre-ADR-0013
      // full wiring), the sheet handles its own send/resend; the promise
      // resolves when the deep-link token is redeemed (see EmailEntrySheet).
      await provider.signIn()
      // Success: session is now set; navigation will shift to Library.
      // The session state change is observed by Navigation.tsx; no explicit
      // navigation call here per ADR-0011 §Decision 14.
    } catch (err: unknown) {
      if (err instanceof AuthCanceledError) {
        // User cancelled — no toast, no-op per Sable's UX doc §Screen 1 States.
        return
      }
      toast.show(signInCopy.errorSignIn, {variant: 'error'})
    } finally {
      setSigningIn(false)
    }
  }, [provider, signingIn, toast])

  const handleSheetCanceled = useCallback(() => {
    sheetOpenRef.current = false
    // Reject the in-flight magicLinkProvider promise so the button re-enables.
    magicLinkProvider.reject(new AuthCanceledError())
    setSigningIn(false)
  }, [])

  const handleSheetResolved = useCallback(() => {
    sheetOpenRef.current = false
    // Session is handled by Navigation — nothing to do here beyond closing.
  }, [])

  const handleTermsPress = useCallback(() => {
    void Linking.openURL(SIGN_IN_URLS.terms)
  }, [])

  const handlePrivacyPress = useCallback(() => {
    void Linking.openURL(SIGN_IN_URLS.privacy)
  }, [])

  const buttonLabel = provider.name === 'apple' ? signInCopy.buttonApple : signInCopy.buttonMagicLink
  const a11yButtonLabel =
    provider.name === 'apple' ? signInCopy.a11yButtonApple : signInCopy.a11yButtonMagicLink

  const microStyle = {
    fontSize: theme.type.micro.size,
    fontWeight: String(theme.type.micro.weight) as '500',
    lineHeight: theme.type.micro.lineHeight,
  }

  return (
    <BottomSheetModalProvider>
      <SafeContainer>
        <View style={styles.root}>
          {/* Hero — centered at top 40% of viewport */}
          <View style={styles.hero}>
            {/* Wordmark */}
            <Text
              style={[
                styles.wordmark,
                {
                  fontSize: theme.type.display.size,
                  fontWeight: String(theme.type.display.weight) as '600',
                  lineHeight: theme.type.display.lineHeight,
                  color: theme.fg,
                },
              ]}
              accessibilityRole="header"
              testID="sign-in-wordmark"
            >
              {signInCopy.wordmark}
            </Text>
            {/* Tagline */}
            <Text
              style={[
                styles.tagline,
                {
                  fontSize: theme.type.body.size,
                  fontWeight: String(theme.type.body.weight) as '400',
                  lineHeight: theme.type.body.lineHeight,
                  color: theme['fg-muted'],
                },
              ]}
              testID="sign-in-tagline"
            >
              {signInCopy.tagline}
            </Text>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            {/* Provider-agnostic auth button — full-width, 48pt tall, accent bg */}
            <Pressable
              onPress={handleSignIn}
              disabled={signingIn}
              accessibilityRole="button"
              accessibilityLabel={a11yButtonLabel}
              accessibilityState={{disabled: signingIn, busy: signingIn}}
              style={[
                styles.authButton,
                {
                  backgroundColor: theme.accent,
                  borderRadius: theme.radii['radius-md'],
                  opacity: signingIn ? 0.7 : 1,
                },
              ]}
              testID="sign-in-button"
            >
              {signingIn ? (
                <ActivityIndicator color={theme['accent-fg']} />
              ) : (
                <Text
                  style={[
                    {
                      fontSize: theme.type.body.size,
                      fontWeight: '600' as const,
                      lineHeight: theme.type.body.lineHeight,
                      color: theme['accent-fg'],
                    },
                  ]}
                >
                  {buttonLabel}
                </Text>
              )}
            </Pressable>

            {/* Footer micro-copy with Terms + Privacy links */}
            <View style={styles.footerRow}>
              <Text style={[microStyle, {color: theme['fg-faint']}]}>
                {signInCopy.footer}
              </Text>
              <Pressable
                onPress={handleTermsPress}
                accessibilityRole="link"
                accessibilityLabel="Terms"
                hitSlop={{top: 15, bottom: 15, left: 8, right: 8}}
                testID="sign-in-terms"
              >
                <Text
                  style={[
                    microStyle,
                    styles.footerLink,
                    {color: theme['fg-faint'], textDecorationLine: 'underline'},
                  ]}
                >
                  {signInCopy.footerTerms}
                </Text>
              </Pressable>
              <Text style={[microStyle, {color: theme['fg-faint']}]}>
                {signInCopy.footerAnd}
              </Text>
              <Pressable
                onPress={handlePrivacyPress}
                accessibilityRole="link"
                accessibilityLabel="Privacy Policy"
                hitSlop={{top: 15, bottom: 15, left: 8, right: 8}}
                testID="sign-in-privacy"
              >
                <Text
                  style={[
                    microStyle,
                    styles.footerLink,
                    {color: theme['fg-faint'], textDecorationLine: 'underline'},
                  ]}
                >
                  {signInCopy.footerPrivacy}
                </Text>
              </Pressable>
              <Text style={[microStyle, {color: theme['fg-faint']}]}>
                {signInCopy.footerSuffix}
              </Text>
            </View>
          </View>
        </View>

        {/* EmailEntrySheet — only for magic-link provider */}
        {isMagicLink ? (
          <EmailEntrySheet
            ref={sheetRef}
            onResolved={handleSheetResolved}
            onCanceled={handleSheetCanceled}
            showExpiredBanner={effectiveExpiredBanner}
            onDismissExpiredBanner={() => {
              setExpiredBannerDismissed(true)
              onDismissExpiredBanner?.()
            }}
          />
        ) : null}
      </SafeContainer>
    </BottomSheetModalProvider>
  )
}

// Default-export wrapped for navigator props. Named export above is canonical.
export function SignInScreenNavigator(props: Props) {
  return (
    <SignInScreen
      showExpiredBanner={props.route?.params?.showExpiredBanner ?? false}
    />
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 32, // space-xl per Sable's token table
    justifyContent: 'space-between',
    paddingVertical: 48,
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  wordmark: {
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  tagline: {
    textAlign: 'center',
  },
  actions: {
    gap: 16,
  },
  authButton: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  footerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerLink: {},
})
