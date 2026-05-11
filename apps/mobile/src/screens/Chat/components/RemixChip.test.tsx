/**
 * RemixChip tests — ADR-0002 Step 8.
 *
 * T-0002-142: chip appears when route has parentProjectId + prefilledPrompt params.
 * T-0002-143: dismissing chip via × clears params; parent_project_id NOT in next /generate.
 */
import React from 'react'
import {AccessibilityInfo} from 'react-native'
import {fireEvent, render} from '@testing-library/react-native'
import {SafeAreaProvider} from 'react-native-safe-area-context'
import {NavigationContainer} from '@react-navigation/native'
import {createNativeStackNavigator} from '@react-navigation/native-stack'

import {ToastProvider} from '#/components/ToastProvider'
import {AppShellThemeProvider} from '#/theme/AppShellThemeProvider'
import {ChatScreen} from '#/screens/Chat/index'

import type {NativeStackScreenProps} from '@react-navigation/native-stack'
import type {RootStackParamList} from '#/lib/routes/types'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

jest.mock('@expo/vector-icons', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactInner = require('react')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const RN = require('react-native')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Icon = (props: any) => ReactInner.createElement(RN.View, {testID: `icon-${props.name}`})
  return {__esModule: true, Feather: Icon}
})

const mockGenerate = jest.fn()
const mockReset = jest.fn()
let mockPhase = 'idle'

jest.mock('#/state/queries/generate', () => ({
  useGenerateMutation: () => ({
    phase: mockPhase,
    result: null,
    error: null,
    generate: mockGenerate,
    reset: mockReset,
  }),
  isActivePhase: (phase: string) =>
    phase === 'thinking' || phase === 'building' || phase === 'stalled',
}))

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

const Stack = createNativeStackNavigator<RootStackParamList>()

function renderChatWithRemix(params: NonNullable<RootStackParamList['Chat']>) {
  const replaceSpy = jest.fn()
  const goBackSpy = jest.fn()
  const popToTopSpy = jest.fn()

  const ChatWithSpies = (props: NativeStackScreenProps<RootStackParamList, 'Chat'>) => {
    const wrappedNav = {
      ...props.navigation,
      replace: (...args: Parameters<typeof props.navigation.replace>) => {
        replaceSpy(...(args as unknown[]))
      },
      goBack: () => goBackSpy(),
      popToTop: () => popToTopSpy(),
    } as typeof props.navigation
    return <ChatScreen {...props} navigation={wrappedNav} />
  }

  const result = render(
    <SafeAreaProvider
      initialMetrics={{
        frame: {x: 0, y: 0, width: 390, height: 844},
        insets: {top: 0, bottom: 0, left: 0, right: 0},
      }}
    >
      <AppShellThemeProvider>
        <ToastProvider>
          <NavigationContainer>
            <Stack.Navigator screenOptions={{headerShown: false}}>
              <Stack.Screen name="Chat" component={ChatWithSpies} initialParams={params} />
              <Stack.Screen name="AppRunner" component={() => null} />
              <Stack.Screen name="Library" component={() => null} />
              <Stack.Screen name="SignIn" component={() => null} />
            </Stack.Navigator>
          </NavigationContainer>
        </ToastProvider>
      </AppShellThemeProvider>
    </SafeAreaProvider>,
  )

  return {...result, replaceSpy, goBackSpy, popToTopSpy}
}

// ---------------------------------------------------------------------------
// Per-test setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockPhase = 'idle'
  mockGenerate.mockReset()
  mockReset.mockReset()
  mockGenerate.mockResolvedValue(undefined)
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false)
})

afterEach(() => {
  jest.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// T-0002-142: chip appears when route has remix params
// ---------------------------------------------------------------------------

it('T-0002-142: RemixChip visible when route has parentProjectId + prefilledPrompt', () => {
  const screen = renderChatWithRemix({
    parentProjectId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    prefilledPrompt: 'A habit tracker app',
    parentAuthorHandle: 'lucy',
  })

  // Chip is visible — find via the clear button's testID as a proxy.
  expect(screen.getByTestId('remix-chip-clear')).toBeTruthy()

  // Input is pre-filled.
  const input = screen.getByTestId('prompt-input')
  expect(input.props.value).toBe('A habit tracker app')
})

// ---------------------------------------------------------------------------
// T-0002-143: dismissing chip clears params; parent_project_id NOT in next generate
// ---------------------------------------------------------------------------

it('T-0002-143: dismissing chip removes it and omits parent_project_id from generate', async () => {
  const screen = renderChatWithRemix({
    parentProjectId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    prefilledPrompt: 'A streak counter',
    parentAuthorHandle: 'alex',
  })

  // Chip is present initially.
  expect(screen.getByTestId('remix-chip-clear')).toBeTruthy()

  // Dismiss the chip.
  fireEvent.press(screen.getByTestId('remix-chip-clear'))

  // Chip is gone.
  expect(screen.queryByTestId('remix-chip-clear')).toBeNull()

  // Now submit — parent_project_id must NOT be included.
  fireEvent.press(screen.getByTestId('send-button'))

  expect(mockGenerate).toHaveBeenCalledWith(
    expect.not.objectContaining({parentProjectId: 'dddddddd-dddd-dddd-dddd-dddddddddddd'}),
  )
  // The parentProjectId should be undefined (not passed).
  const callArg = mockGenerate.mock.calls[0]?.[0] as {parentProjectId?: string}
  expect(callArg?.parentProjectId).toBeUndefined()
})
