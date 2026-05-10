/**
 * Chat screen tests — ADR-0002 Step 8.
 *
 * T-0002-134: loading bubble shows "Thinking about your idea…" during phase=thinking.
 * T-0002-135: loading bubble shows "Building your app…" during phase=building.
 * T-0002-138: on done, navigation replaces with AppRunner + projectId.
 * T-0002-139: SSE error code=invalid_spec → error bubble with correct copy.
 * T-0002-140: SSE error code=rate_limited → error bubble with correct copy.
 * T-0002-145: no client-timer cycling — copy stays on thinking until server event.
 * T-0002-147: back arrow during loading triggers confirmation alert.
 *
 * Strategy: mock fetch directly so the SSE stream is controllable. This lets
 * us drive phase transitions via real server events rather than mocking the
 * hook internals, which gives more honest tests.
 */
import React from 'react'
import {AccessibilityInfo, Alert} from 'react-native'
import {act, fireEvent, render, waitFor} from '@testing-library/react-native'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {SafeAreaProvider} from 'react-native-safe-area-context'
import {NavigationContainer} from '@react-navigation/native'
import {createNativeStackNavigator} from '@react-navigation/native-stack'

import {ToastProvider} from '#/components/ToastProvider'

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

// Mock api module — ChatScreen doesn't call apiFetch directly; generate hook does.
// We mock `getCurrentSession` and `getApiUrl` for the generate hook.
jest.mock('#/lib/api', () => ({
  getCurrentSession: () => ({accessToken: 'test.jwt', userId: 'user-1'}),
  getApiUrl: () => 'http://localhost:3000',
  // Pass-through for other utilities that might be needed:
  NotAuthenticatedError: class NotAuthenticatedError extends Error {},
  ApiError: class ApiError extends Error {
    status: number
    body: string
    constructor(status: number, body: string) {
      super(`API ${status}`)
      this.status = status
      this.body = body
    }
  },
}))

jest.mock('#/logger', () => ({
  logger: {info: jest.fn(), warn: jest.fn(), error: jest.fn()},
  safeMessage: (e: unknown) => String(e),
}))

import {ChatScreen} from './index'
import {chatCopy} from './copy'

// ---------------------------------------------------------------------------
// SSE helpers
// ---------------------------------------------------------------------------

function sseEvent(type: string, data: Record<string, unknown> = {}): string {
  return `data: ${JSON.stringify({type, ...data})}\n\n`
}

function sseDone(): string {
  return 'data: [DONE]\n\n'
}

const RESULT_PAYLOAD = {
  project: {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    title: 'Tip Calculator',
    visibility: 'private',
    original_prompt: 'A tip calculator',
  },
  spec: {},
  render_hash: 'hash123',
  thinking_duration_ms: 3000,
  generation_duration_ms: 45000,
}

function makeMockFetch(status = 200) {
  let ctrl!: ReadableStreamDefaultController<Uint8Array>
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      ctrl = c
    },
  })

  const mockFetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    body: stream,
    json: async () => ({error: 'internal'}),
  })

  return {
    fetch: mockFetch,
    enqueue: (chunk: string) => ctrl.enqueue(new TextEncoder().encode(chunk)),
    close: () => ctrl.close(),
  }
}

// ---------------------------------------------------------------------------
// Navigation harness
// ---------------------------------------------------------------------------

const Stack = createNativeStackNavigator<RootStackParamList>()

interface HarnessOptions {
  routeParams?: RootStackParamList['Chat']
}

function renderChat(opts: HarnessOptions = {}) {
  const replaceSpy = jest.fn()
  const goBackSpy = jest.fn()
  const popToTopSpy = jest.fn()

  function ChatWithSpies(props: NativeStackScreenProps<RootStackParamList, 'Chat'>) {
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

  const qc = new QueryClient({
    defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
  })

  const result = render(
    <SafeAreaProvider
      initialMetrics={{
        frame: {x: 0, y: 0, width: 390, height: 844},
        insets: {top: 0, bottom: 0, left: 0, right: 0},
      }}
    >
      <QueryClientProvider client={qc}>
        <ToastProvider>
          <NavigationContainer>
            <Stack.Navigator screenOptions={{headerShown: false}}>
              <Stack.Screen name="Chat" component={ChatWithSpies} initialParams={opts.routeParams} />
              <Stack.Screen name="AppRunner" component={() => null} />
              <Stack.Screen name="Home" component={() => null} />
              <Stack.Screen name="SignIn" component={() => null} />
            </Stack.Navigator>
          </NavigationContainer>
        </ToastProvider>
      </QueryClientProvider>
    </SafeAreaProvider>,
  )

  return {...result, replaceSpy, goBackSpy, popToTopSpy}
}

// ---------------------------------------------------------------------------
// Per-test setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false)
})

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Helper: type a prompt and submit
// ---------------------------------------------------------------------------

async function typeAndSend(screen: ReturnType<typeof renderChat>, text = 'A habit tracker') {
  await act(async () => {
    fireEvent.changeText(screen.getByTestId('prompt-input'), text)
  })
  await waitFor(() => expect(screen.getByTestId('send-button')).toBeTruthy())
  await act(async () => {
    fireEvent.press(screen.getByTestId('send-button'))
  })
}

// ---------------------------------------------------------------------------
// T-0002-134: loading bubble shows "Thinking about your idea…"
// ---------------------------------------------------------------------------

it('T-0002-134: phase=thinking → loading bubble shows "Thinking about your idea…"', async () => {
  // Stream sends thinking_started and then hangs.
  const {fetch, enqueue} = makeMockFetch()
  global.fetch = fetch as unknown as typeof fetch

  const screen = renderChat()

  await typeAndSend(screen)

  await act(async () => {
    enqueue(sseEvent('thinking_started'))
  })

  await waitFor(() => {
    expect(screen.getByTestId('loading-bubble-text').props.children).toBe(chatCopy.loadingThinking)
  })
})

// ---------------------------------------------------------------------------
// T-0002-135: loading bubble shows "Building your app…" during phase=building
// ---------------------------------------------------------------------------

it('T-0002-135: phase=building → loading bubble shows "Building your app…"', async () => {
  const {fetch, enqueue} = makeMockFetch()
  global.fetch = fetch as unknown as typeof fetch

  const screen = renderChat()

  await typeAndSend(screen)

  await act(async () => {
    enqueue(sseEvent('thinking_started'))
    enqueue(sseEvent('building_started'))
  })

  await waitFor(() => {
    expect(screen.getByTestId('loading-bubble-text').props.children).toBe(chatCopy.loadingBuilding)
  })
})

// ---------------------------------------------------------------------------
// T-0002-138: on done, navigation replaces to AppRunner with projectId
// ---------------------------------------------------------------------------

it('T-0002-138: phase=done → navigation.replace("AppRunner", {projectId})', async () => {
  const {fetch, enqueue, close} = makeMockFetch()
  global.fetch = fetch as unknown as typeof fetch

  const screen = renderChat()

  await typeAndSend(screen)

  await act(async () => {
    enqueue(sseEvent('thinking_started'))
    enqueue(sseEvent('building_started'))
    enqueue(sseEvent('done', RESULT_PAYLOAD))
    enqueue(sseDone())
    close()
  })

  await waitFor(() => {
    expect(screen.replaceSpy).toHaveBeenCalledWith('AppRunner', {
      projectId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    })
  })
})

// ---------------------------------------------------------------------------
// T-0002-139: error code=invalid_spec → correct error copy
// ---------------------------------------------------------------------------

it('T-0002-139: SSE error code=invalid_spec → error bubble with correct copy', async () => {
  const {fetch, enqueue, close} = makeMockFetch()
  global.fetch = fetch as unknown as typeof fetch

  const screen = renderChat()

  await typeAndSend(screen)

  await act(async () => {
    enqueue(sseEvent('thinking_started'))
    enqueue(sseEvent('error', {code: 'invalid_spec'}))
    enqueue(sseDone())
    close()
  })

  await waitFor(() => {
    screen.getByText(chatCopy.errorCodes['invalid_spec']!)
  })
})

// ---------------------------------------------------------------------------
// T-0002-140: error code=rate_limited → correct error copy
// ---------------------------------------------------------------------------

it('T-0002-140: SSE error code=rate_limited → error bubble with correct copy', async () => {
  const {fetch, enqueue, close} = makeMockFetch()
  global.fetch = fetch as unknown as typeof fetch

  const screen = renderChat()

  await typeAndSend(screen)

  await act(async () => {
    enqueue(sseEvent('thinking_started'))
    enqueue(sseEvent('error', {code: 'rate_limited'}))
    enqueue(sseDone())
    close()
  })

  await waitFor(() => {
    screen.getByText(chatCopy.errorCodes['rate_limited']!)
  })
})

// ---------------------------------------------------------------------------
// T-0002-145: no client-timer cycling
// ---------------------------------------------------------------------------

it('T-0002-145: copy stays "Thinking…" for 31s — no timer-driven cycling', async () => {
  // Stream sends thinking_started and hangs — never sends building_started.
  const {fetch, enqueue} = makeMockFetch()
  global.fetch = fetch as unknown as typeof fetch

  const screen = renderChat()

  await typeAndSend(screen)

  await act(async () => {
    enqueue(sseEvent('thinking_started'))
  })

  await waitFor(() => {
    expect(screen.getByTestId('loading-bubble-text').props.children).toBe(chatCopy.loadingThinking)
  })

  // Advance 31s — screen must not advance copy via its own timer.
  await act(async () => {
    jest.advanceTimersByTime(31_000)
  })

  // Copy is still "Thinking…" (the stall timer in the hook flips to 'stalled',
  // but the screen receives this from the hook — the COPY hasn't moved to Building).
  const bubbleText = screen.getByTestId('loading-bubble-text').props.children as string
  expect(bubbleText).not.toBe(chatCopy.loadingBuilding)
  // It's either still "Thinking…" (pre-stall) or "Still working…" (post-stall,
  // from the hook's stall mechanism), but NEVER "Building your app…" without
  // a building_started event.
})

// ---------------------------------------------------------------------------
// T-0002-147: back arrow during loading triggers confirmation alert
// ---------------------------------------------------------------------------

it('T-0002-147: back arrow pressed during generation shows confirmation alert', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert')

  // Stream hangs after thinking_started — stays in generating phase.
  const {fetch, enqueue} = makeMockFetch()
  global.fetch = fetch as unknown as typeof fetch

  const screen = renderChat()

  await typeAndSend(screen)

  await act(async () => {
    enqueue(sseEvent('thinking_started'))
  })

  await waitFor(() => {
    expect(screen.getByTestId('loading-bubble-text')).toBeTruthy()
  })

  fireEvent.press(screen.getByTestId('chat-back-button'))

  expect(alertSpy).toHaveBeenCalledWith(
    chatCopy.cancelAlertTitle,
    chatCopy.cancelAlertBody,
    expect.arrayContaining([
      expect.objectContaining({text: chatCopy.cancelAlertStay}),
      expect.objectContaining({text: chatCopy.cancelAlertConfirm}),
    ]),
  )
})
