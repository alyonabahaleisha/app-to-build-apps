import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {StatusBar} from 'expo-status-bar'
import {GestureHandlerRootView} from 'react-native-gesture-handler'
import {SafeAreaProvider} from 'react-native-safe-area-context'

import {ToastProvider} from '#/components/ToastProvider'
import {Navigation} from '#/Navigation'
import {SessionProvider} from '#/state/session/SessionProvider'

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
          <SessionProvider>
            <ToastProvider>
              <Navigation />
              <StatusBar style="auto" />
            </ToastProvider>
          </SessionProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  )
}
