/**
 * Navigation — root stack. Gates Home behind authenticated session per
 * ADR-0001 Step 6/7 acceptance criteria. Loading state renders the
 * hydration splash; unauthenticated → SignIn; authenticated → Home + the
 * stub Chat / AppRunner screens for the Step 7 wire.
 *
 * The auth deep-link handler (`useAuthDeepLink`) lives at the navigator
 * level so it sees URLs regardless of which screen is mounted. When a
 * redeem attempt fails (token expired/used/malformed), we flip
 * `linkExpired` so the SignIn screen renders its "That link expired"
 * banner — the Step 6 prop is wired here in Step 7.
 */
import {NavigationContainer} from '@react-navigation/native'
import {createNativeStackNavigator} from '@react-navigation/native-stack'
import {useCallback, useState} from 'react'
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native'

import {SafeContainer} from '#/components/SafeContainer'
import {useAuthDeepLink} from '#/lib/deepLink'
import {AppRunnerScreen} from '#/screens/AppRunner'
import {ChatScreen} from '#/screens/Chat'
import {HomeScreen} from '#/screens/Home'
import {SignIn} from '#/screens/SignIn'
import {signInCopy} from '#/screens/SignIn/copy'
import {useSession} from '#/state/session/useSession'
import {useTheme} from '#/theme'

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
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Chat" component={ChatScreen} />
            <Stack.Screen name="AppRunner" component={AppRunnerScreen} />
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
  const theme = useTheme()
  return (
    <SafeContainer>
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={theme.palette.primary} />
        <Text
          style={[styles.splashText, theme.typography.body, {color: theme.palette.text.muted}]}
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
