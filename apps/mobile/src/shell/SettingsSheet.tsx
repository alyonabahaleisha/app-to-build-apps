/**
 * SettingsSheet — Gorhom Bottom Sheet at 75% snap point.
 * ADR-0011 Step 6 + canvas-v0-ux.md §Screen 5.
 *
 * Sections: Account | Coming next | About | Sign out.
 * Email mask (T-0011-141e): SIWA → `j••@privaterelay.appleid.com`; magic-link → `j••e@example.com`.
 * Sign out (T-0011-141h): signOut() → QC.clear() → navigation.reset(SignIn).
 * forwardRef-wrapped; callers: const {sheetRef, open, close} = useSettingsSheet()
 *                              <SettingsSheet ref={sheetRef} navigation={nav} />
 * T-0011-133..138, T-0011-141, T-0011-141c, T-0011-141e..h.
 */
import React, {useCallback, useRef} from 'react'
import {BottomSheetModal, BottomSheetScrollView} from '@gorhom/bottom-sheet'
import Constants from 'expo-constants'
import {Linking, Pressable, StyleSheet, Text, View} from 'react-native'

import type {NavigationProp} from '@react-navigation/native'
import type {RootStackParamList} from '#/lib/routes/types'
import {Skeleton} from '#/components/Skeleton'
import {
  useOutOfScopeIntentsQuery,
  useUpdateNotifyOptInMutation,
} from '#/state/queries/outOfScopeIntents'
import {useSession} from '#/state/session/useSession'
import {useAppShellTheme} from '#/theme/AppShellThemeProvider'
import {useQueryClient} from '@tanstack/react-query'

import {ComingNextList, Divider, LinkRow, SectionHeader} from './SettingsSheet.parts'

// -- Email masking -----------------------------------------------------------

const SIWA_DOMAIN = 'privaterelay.appleid.com'

/**
 * maskEmail — masks an email address per ADR-0011 §8.
 *
 * SIWA relay:  `j••@privaterelay.appleid.com`
 * Magic-link:  `j••e@example.com`
 */
export function maskEmail(email: string): string {
  const atIndex = email.lastIndexOf('@')
  if (atIndex <= 0) return email

  const local = email.slice(0, atIndex)
  const domain = email.slice(atIndex + 1)

  if (domain === SIWA_DOMAIN) {
    // SIWA: first char + 2 dots + @ + full domain
    return `${local.charAt(0)}••@${domain}`
  }

  // Magic-link: first char + 2 dots + last char of local + @ + domain
  if (local.length === 1) {
    return `${local}••@${domain}`
  }
  return `${local.charAt(0)}••${local.charAt(local.length - 1)}@${domain}`
}

// -- useSettingsSheet hook ---------------------------------------------------

/**
 * useSettingsSheet — returns open() and close() handlers backed by an
 * imperative BottomSheetModal ref. Pass `sheetRef` to <SettingsSheet ref={sheetRef} />.
 *
 * T-0011-137: open() calls BottomSheetModal.present(); close() calls dismiss().
 * T-0011-138: calling open() twice keeps sheet open (idempotent).
 */
export function useSettingsSheet() {
  const sheetRef = useRef<BottomSheetModal>(null)

  const open = useCallback(() => {
    sheetRef.current?.present()
  }, [])

  const close = useCallback(() => {
    sheetRef.current?.dismiss()
  }, [])

  return {sheetRef, open, close}
}

// -- SettingsSheet -----------------------------------------------------------

interface SettingsSheetProps {
  navigation: NavigationProp<RootStackParamList>
}

export const SettingsSheet = React.forwardRef<BottomSheetModal, SettingsSheetProps>(
  function SettingsSheet({navigation}, ref) {
    const theme = useAppShellTheme()
    const session = useSession()
    const qc = useQueryClient()
    const intentsQuery = useOutOfScopeIntentsQuery()
    const updateOptIn = useUpdateNotifyOptInMutation()

    const handleSignOut = useCallback(async () => {
      await session.signOut()
      qc.clear()
      navigation.reset({
        index: 0,
        routes: [{name: 'SignIn'}],
      })
    }, [session, qc, navigation])

    const handleTerms = useCallback(() => {
      void Linking.openURL('https://canvas.app/terms')
    }, [])

    const handlePrivacy = useCallback(() => {
      void Linking.openURL('https://canvas.app/privacy')
    }, [])

    const handleHelp = useCallback(() => {
      void Linking.openURL('mailto:support@canvas.app')
    }, [])

    const version = Constants.expoConfig?.version ?? '—'
    const build = Constants.expoConfig?.ios?.buildNumber ?? '—'

    const user = session.user
    const displayName = user?.displayName ?? user?.email?.split('@')[0] ?? '—'
    const maskedEmail = user?.email ? maskEmail(user.email) : '—'

    // "Coming next update" section: skeleton if loading OR error (T-0011-141c)
    const showSkeleton = intentsQuery.isLoading || intentsQuery.isError

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={['75%']}
        enablePanDownToClose
        backgroundStyle={{backgroundColor: theme['bg-elevated']}}
        handleIndicatorStyle={{backgroundColor: theme.divider}}
        accessibilityViewIsModal
      >
        <BottomSheetScrollView
          contentContainerStyle={[styles.content, {paddingBottom: 40}]}
          testID="settings-sheet-scroll"
        >
          {/* ---- Account section ---- */}
          <SectionHeader title="Account" theme={theme} />
          <View
            style={[styles.section, {backgroundColor: theme.bg, borderColor: theme.divider}]}
            testID="settings-account-section"
          >
            <View style={styles.accountRow}>
              {/* Avatar placeholder circle */}
              <View
                style={[
                  styles.avatar,
                  {backgroundColor: theme['bg-elevated'], borderColor: theme.divider},
                ]}
                accessibilityRole="image"
                accessibilityLabel={`Avatar for ${displayName}`}
                testID="settings-avatar"
              />
              <View style={styles.accountInfo}>
                <Text
                  style={[styles.displayName, {color: theme.fg, fontSize: theme.type.body.size}]}
                  testID="settings-display-name"
                  numberOfLines={1}
                >
                  {displayName}
                </Text>
                <Text
                  style={{color: theme['fg-muted'], fontSize: theme.type.caption.size}}
                  testID="settings-masked-email"
                  numberOfLines={1}
                >
                  {maskedEmail}
                </Text>
              </View>
            </View>
          </View>

          {/* ---- Coming next update section ---- */}
          <SectionHeader title="Coming next update" theme={theme} />
          <View
            style={[styles.section, {backgroundColor: theme.bg, borderColor: theme.divider}]}
            testID="settings-coming-next-section"
          >
            {showSkeleton ? (
              <View style={styles.skeletonStack} testID="settings-coming-next-skeleton">
                <Skeleton width="70%" height={20} />
                <Skeleton width="55%" height={20} />
              </View>
            ) : (
              <ComingNextList
                intents={intentsQuery.data ?? []}
                onToggle={(capability, notifyOptIn) =>
                  updateOptIn.mutate({capability, notifyOptIn})
                }
                theme={theme}
              />
            )}
          </View>

          {/* ---- About section ---- */}
          <SectionHeader title="About" theme={theme} />
          <View
            style={[styles.section, {backgroundColor: theme.bg, borderColor: theme.divider}]}
            testID="settings-about-section"
          >
            <LinkRow
              label="Terms"
              onPress={handleTerms}
              theme={theme}
              testID="settings-terms-link"
            />
            <Divider theme={theme} />
            <LinkRow
              label="Privacy"
              onPress={handlePrivacy}
              theme={theme}
              testID="settings-privacy-link"
            />
            <Divider theme={theme} />
            <LinkRow
              label="Help"
              onPress={handleHelp}
              theme={theme}
              testID="settings-help-link"
            />
            <Divider theme={theme} />
            <View style={styles.versionRow}>
              <Text
                style={{color: theme['fg-muted'], fontSize: theme.type.caption.size}}
                testID="settings-version"
              >
                {`Version ${version} (${build})`}
              </Text>
            </View>
          </View>

          {/* ---- Account actions section ---- */}
          <View style={styles.actionsSection}>
            <Pressable
              onPress={() => {
                void handleSignOut()
              }}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
              style={[styles.signOutButton, {borderColor: theme.danger}]}
              testID="settings-sign-out"
            >
              <Text
                style={[
                  styles.signOutText,
                  {color: theme.danger, fontSize: theme.type.body.size},
                ]}
              >
                Sign out
              </Text>
            </Pressable>
          </View>
        </BottomSheetScrollView>
      </BottomSheetModal>
    )
  },
)

// -- Styles ------------------------------------------------------------------

const styles = StyleSheet.create({
  content: {paddingHorizontal: 16, paddingTop: 8, gap: 4},
  section: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 20,
    overflow: 'hidden',
  },
  accountRow: {flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12},
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    flexShrink: 0,
  },
  accountInfo: {flex: 1, gap: 2},
  displayName: {fontWeight: '600'},
  skeletonStack: {padding: 16, gap: 10},
  versionRow: {paddingHorizontal: 16, paddingVertical: 14},
  actionsSection: {marginTop: 8, marginBottom: 16},
  signOutButton: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: {fontWeight: '600'},
})
