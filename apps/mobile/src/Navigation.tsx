/**
 * Navigation — root stack. Gates Library behind authenticated session per
 * ADR-0011 Step 8.
 *
 * The auth deep-link handler (`useAuthDeepLink`) lives at the navigator
 * level so it sees URLs regardless of which screen is mounted. When a
 * redeem attempt fails (token expired/used/malformed), we flip
 * `linkExpired` so the SignIn screen renders its "That link expired" banner.
 *
 * ADR-0011 Step 9: CreateScreen, GeneratingScreen, OutOfScopeScreen, and
 * QuotaExhaustedScreen wired. ChatScreen deleted.
 * ADR-0011 Step 10: RunScreen replaces AppRunnerScreen. AppRunnerScreen deleted.
 *
 * Step 11 will finalize this to the full V0 shape:
 *   SignInScreen ↔ ShellLayout (LibraryStack + CreateStack).
 * Until that step lands, we use a flat stack with LibraryScreen as root.
 *
 * T-0011-290, T-0011-291, T-0011-293, T-0011-295.
 */
import {NavigationContainer} from '@react-navigation/native'
import {createNativeStackNavigator} from '@react-navigation/native-stack'
import {useCallback, useState} from 'react'
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native'

import {SafeContainer} from '#/components/SafeContainer'
import {useAuthDeepLink} from '#/lib/deepLink'
import {CreateScreen} from '#/screens/Create/CreateScreen'
import {GeneratingScreen} from '#/screens/Generating/GeneratingScreen'
import {LibraryScreen} from '#/screens/Library/LibraryScreen'
import {OutOfScopeScreen} from '#/screens/OutOfScope/OutOfScopeScreen'
import {QuotaExhaustedScreen} from '#/screens/QuotaExhausted/QuotaExhaustedScreen'
import {RunScreen} from '#/screens/Run/RunScreen'
import {SignInScreen as SignIn} from '#/screens/SignIn/SignInScreen'
import {signInCopy} from '#/screens/SignIn/copy'
import {useSession} from '#/state/session/useSession'
import {useAppShellTheme} from '#/theme/AppShellThemeProvider'

import type {RootStackParamList} from '#/lib/routes/types'

const Stack = createNativeStackNavigator<RootStackParamList>()

export function Navigation() {
  const [linkExpired, setLinkExpired] = useState(false)

  // Mount the deep-link handler at the navigator level so it sees both
  // cold-start and warm-start auth callbacks. On a redeem failure (the
  // token is expired, used, or malformed) flip `linkExpired` — SignIn
  // renders its banner the next render.
  const handleRedeemError = useCallback(() => {
    setLinkExpired(true)
  }, [])
  useAuthDeepLink({onRedeemError: handleRedeemError})

  const dismissExpired = useCallback(() => {
    setLinkExpired(false)
  }, [])

  const session = useSession()

  if (session.status === 'loading') {
    return <HydrationSplash />
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{headerShown: false}}>
        {session.status === 'authenticated' ? (
          <>
            {/* V0 authenticated screens — LibraryScreen is the root (ADR-0011 Step 8) */}
            <Stack.Screen name="Library" component={LibraryScreen} />
            {/* Create flow — Step 9 */}
            <Stack.Screen name="Create" component={CreateScreen} />
            <Stack.Screen
              name="Generating"
              component={GeneratingScreen}
              options={{presentation: 'fullScreenModal'}}
            />
            <Stack.Screen name="OutOfScope" component={OutOfScopeScreen} />
            <Stack.Screen name="QuotaExhausted" component={QuotaExhaustedScreen} />
            {/* Run screen — replaces M1 AppRunner (ADR-0011 Step 10) */}
            <Stack.Screen name="Run" component={RunScreen} />
          </>
        ) : (
          <Stack.Screen name="SignIn">
            {() => (
              <SignIn showExpiredBanner={linkExpired} onDismissExpiredBanner={dismissExpired} />
            )}
          </Stack.Screen>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}

function HydrationSplash() {
  const theme = useAppShellTheme()
  return (
    <SafeContainer>
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text
          style={[
            styles.splashText,
            {
              fontSize: theme.type.body.size,
              fontWeight: String(theme.type.body.weight) as '400',
              lineHeight: theme.type.body.lineHeight,
              color: theme['fg-muted'],
            },
          ]}
          accessibilityRole="header"
        >
          {signInCopy.verifyingHeadline}
        </Text>
      </View>
    </SafeContainer>
  )
}

const styles = StyleSheet.create({
  splash: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16},
  splashText: {textAlign: 'center'},
})
