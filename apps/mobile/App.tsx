import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {StatusBar} from 'expo-status-bar'
import {GestureHandlerRootView} from 'react-native-gesture-handler'
import {SafeAreaProvider} from 'react-native-safe-area-context'

import {ToastProvider} from '#/components/ToastProvider'
import {LinkingProvider} from '#/lib/linking/LinkingProvider'
import {Navigation} from '#/Navigation'
import {DevSpecProvider} from '#/screens/Run/devMenu/DevSpecContext'
import {SessionProvider} from '#/state/session/SessionProvider'
import {AppShellThemeProvider} from '#/theme/AppShellThemeProvider'

const queryClient = new QueryClient({
  defaultOptions: {queries: {retry: 1, refetchOnWindowFocus: false}},
})

export default function App() {
  return (
    // GestureHandlerRootView is required by @gorhom/bottom-sheet (ADR-0002 Step 9).
    // Must be at the root so the gesture system is available to all screens.
    <GestureHandlerRootView style={{flex: 1}}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <AppShellThemeProvider>
            <SessionProvider>
              <ToastProvider>
                {/*
                 * LinkingProvider — ADR-0011 Step 12.
                 * Wires Universal Link callbacks at the session-aware level.
                 * Must be inside <SessionProvider> and <ToastProvider> (reads
                 * both). Must be outside <NavigationContainer> (which lives
                 * inside <Navigation>); navigation-to-SignIn is implicit via
                 * session-gated stack in Navigation.tsx.
                 */}
                <LinkingProvider>
                  {/*
                   * DevSpecProvider — ADR-0011 Step 13.
                   * Wraps the entire app so RunScreen can receive in-memory specs
                   * from the eval harness (via LoadSpecFromDevMenu) without a DB write.
                   * The provider itself is lightweight (one useState); registration of
                   * the dev-menu item and URL handler is gated on __DEV__ inside
                   * LoadSpecFromDevMenu.
                   */}
                  <DevSpecProvider>
                    <Navigation />
                    <StatusBar style="auto" />
                  </DevSpecProvider>
                </LinkingProvider>
              </ToastProvider>
            </SessionProvider>
          </AppShellThemeProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  )
}
