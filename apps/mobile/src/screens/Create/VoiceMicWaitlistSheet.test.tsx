/**
 * VoiceMicWaitlistSheet tests — ADR-0011 Step 9.
 *
 * T-0011-198: valid submit POSTs to /out-of-scope-intent with
 *             capability=transcription.
 *
 * The sheet is rendered directly (not inside CreateScreen) to isolate its
 * submit logic from the bottom-sheet imperative API.
 */
import React from 'react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {SafeAreaProvider} from 'react-native-safe-area-context'
import {fireEvent, render, waitFor} from '@testing-library/react-native'

// ---- Module mocks -----------------------------------------------------------

jest.mock('@expo/vector-icons', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const R = require('react')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const {View} = require('react-native')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Icon = (props: any) => R.createElement(View, {testID: `icon-${props.name}`})
  return {__esModule: true, Feather: Icon}
})

jest.mock('expo-haptics', () => ({
  __esModule: true,
  ImpactFeedbackStyle: {Light: 'light'},
  impactAsync: jest.fn(async () => {}),
}))

// ---- Imports ----------------------------------------------------------------

import {VoiceMicWaitlistSheet} from './VoiceMicWaitlistSheet'
import {ToastProvider} from '#/components/ToastProvider'
import {AppShellThemeProvider} from '#/theme/AppShellThemeProvider'
import {resetApiForTests, setCurrentSession} from '#/lib/api'

// ---- Fetch mock -------------------------------------------------------------

const mockFetch = jest.fn()

// ---- Setup ------------------------------------------------------------------

beforeEach(() => {
  mockFetch.mockReset()
  global.fetch = mockFetch as unknown as typeof fetch
  resetApiForTests()
  setCurrentSession({
    accessToken: 'test.jwt.token',
    userId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  })
})

afterEach(() => {
  jest.useRealTimers()
})

// ---- Harness ----------------------------------------------------------------

function renderSheet(initialEmail = 'user@example.com') {
  const ref = React.createRef<import('@gorhom/bottom-sheet').BottomSheetModal>()
  const qc = new QueryClient({
    defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
  })

  const result = render(
    <SafeAreaProvider
      initialMetrics={{
        frame: {x: 0, y: 0, width: 393, height: 844},
        insets: {top: 0, bottom: 0, left: 0, right: 0},
      }}
    >
      <AppShellThemeProvider>
        <QueryClientProvider client={qc}>
          <ToastProvider>
            <VoiceMicWaitlistSheet ref={ref} initialEmail={initialEmail} />
          </ToastProvider>
        </QueryClientProvider>
      </AppShellThemeProvider>
    </SafeAreaProvider>,
  )

  return result
}

// ---- Tests ------------------------------------------------------------------

describe('VoiceMicWaitlistSheet', () => {
  it('T-0011-198: valid email submit → POSTs to /out-of-scope-intent with capability=transcription', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => '{}',
    })

    const {getByTestId} = renderSheet('user@example.com')

    // Email is pre-filled; submit button should be enabled.
    await waitFor(() => {
      expect(getByTestId('voice-waitlist-submit').props.accessibilityState?.disabled).toBe(false)
    })

    fireEvent.press(getByTestId('voice-waitlist-submit'))

    await waitFor(() => {
      const fetchCalls = mockFetch.mock.calls
      const intentCall = fetchCalls.find(
        (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('/out-of-scope-intent'),
      )
      expect(intentCall).toBeDefined()
      const body = JSON.parse(intentCall![1].body as string)
      expect(body.capability).toBe('transcription')
      expect(body.email).toBe('user@example.com')
    })
  })

  it('T-0011-198 (success state): valid submit → success message shown', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => '{}',
    })

    const {getByTestId, queryByTestId} = renderSheet('user@example.com')

    await waitFor(() => {
      expect(getByTestId('voice-waitlist-submit').props.accessibilityState?.disabled).toBe(false)
    })

    fireEvent.press(getByTestId('voice-waitlist-submit'))

    await waitFor(() => {
      expect(queryByTestId('voice-waitlist-success')).not.toBeNull()
      expect(queryByTestId('voice-waitlist-submit')).toBeNull()
    })
  })

  it('T-0011-198 (error path): 5xx → submit button stays, success not shown', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'error',
      json: async () => ({error: 'internal'}),
    })

    const {getByTestId, queryByTestId} = renderSheet('user@example.com')

    await waitFor(() => {
      expect(getByTestId('voice-waitlist-submit').props.accessibilityState?.disabled).toBe(false)
    })

    fireEvent.press(getByTestId('voice-waitlist-submit'))

    await waitFor(() => {
      expect(queryByTestId('voice-waitlist-success')).toBeNull()
      expect(queryByTestId('voice-waitlist-submit')).not.toBeNull()
    })
  })

  it('submit button disabled with empty email', () => {
    const {getByTestId} = renderSheet('')
    expect(getByTestId('voice-waitlist-submit').props.accessibilityState?.disabled).toBe(true)
  })

  it('submit button disabled with invalid email', async () => {
    const {getByTestId} = renderSheet('')
    fireEvent.changeText(getByTestId('voice-waitlist-email-input'), 'notanemail')
    await waitFor(() => {
      expect(getByTestId('voice-waitlist-submit').props.accessibilityState?.disabled).toBe(true)
    })
  })
})
