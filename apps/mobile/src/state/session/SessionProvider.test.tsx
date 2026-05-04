/**
 * SessionProvider tests — 13 of 15 Step 5 T-IDs (the other two —
 * T-0001-082 grep + T-0001-124 config — live in api.test.ts).
 *
 * T-0001-073 — loading→authenticated within 500ms (explicit waitFor timeout
 *              of 600ms per Roz Round 2 N-1 carry-forward).
 * T-0001-074 — cold start, no tokens → unauthenticated.
 * T-0001-075 — redeemToken stores tokens + calls /auth/sync + auth state.
 * T-0001-076 — signOut deletes tokens + apiFetch rejects after.
 * T-0001-077 — malformed token → RedeemFailedError; tokens NOT stored.
 * T-0001-078 — /auth/sync 401 → state stays unauthenticated; tokens NOT stored.
 * T-0001-079 — refresh fires once at exp - 60s.
 * T-0001-080 — secure-store read fails → resolves to unauthenticated.
 * T-0001-081 — after signOut, secureStore.read() returns null tokens.
 * T-0001-083 — two simultaneous redeemToken calls → one /auth/sync call.
 * T-0001-084 — useSession() ref stable across re-renders unless state changed.
 * T-0001-123 — signOut while in-flight: subsequent apiFetch rejects.
 * T-0001-133 — refresh fails → unauthenticated; clears tokens; next apiFetch rejects.
 */
import React, {useEffect, useState} from 'react'
import {Text, View} from 'react-native'
import {act, render, waitFor} from '@testing-library/react-native'

import {
  apiFetch,
  NotAuthenticatedError,
  resetApiForTests,
} from '#/lib/api'
import {
  RedeemFailedError,
  SessionProvider,
  setRefreshClientForTests,
} from './SessionProvider'
import {useSession} from './useSession'

// ---- expo-secure-store mock ------------------------------------------

jest.mock('expo-secure-store', () => {
  const mem = new Map<string, string>()
  return {
    __mem: mem,
    getItemAsync: jest.fn(async (k: string) => mem.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => {
      mem.set(k, v)
    }),
    deleteItemAsync: jest.fn(async (k: string) => {
      mem.delete(k)
    }),
  }
})

// Re-import the live module so we can manipulate the mock store.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const SecureStoreMock = require('expo-secure-store') as {
  __mem: Map<string, string>
  getItemAsync: jest.Mock
  setItemAsync: jest.Mock
  deleteItemAsync: jest.Mock
}

// Re-import the wrapper for direct read assertions (T-0001-081).
import {secureStore} from '#/state/persisted/secure'

// ---- JWT helpers -----------------------------------------------------

function makeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({alg: 'HS256', typ: 'JWT'})).toString(
    'base64url',
  )
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  // Signature segment is unused — server validates, client only decodes.
  return `${header}.${body}.signature-not-validated-on-client`
}

function jwtForUser(opts: {sub?: string; email?: string; expSecondsFromNow?: number} = {}): string {
  const expSecondsFromNow = opts.expSecondsFromNow ?? 60 * 60 // 1h
  return makeJwt({
    sub: opts.sub ?? 'user-uuid-aaa',
    email: opts.email ?? 'a@b.c',
    exp: Math.floor(Date.now() / 1000) + expSecondsFromNow,
  })
}

// ---- Test harness component -----------------------------------------

interface ProbeProps {
  onValue?: (v: ReturnType<typeof useSession>) => void
}

function SessionProbe({onValue}: ProbeProps) {
  const session = useSession()
  useEffect(() => {
    onValue?.(session)
  })
  return (
    <View>
      <Text testID="status">{session.status}</Text>
      <Text testID="email">{session.user?.email ?? ''}</Text>
    </View>
  )
}

// ---- Token-leak guard (T-0001-082, broadened) -----------------------

const CONSOLE_METHODS = ['log', 'info', 'warn', 'error', 'debug'] as const

function spyOnAllConsole() {
  return CONSOLE_METHODS.map((m) =>
    jest.spyOn(console, m).mockImplementation(() => {}),
  )
}

function serializeArg(arg: unknown): string {
  if (typeof arg === 'string') return arg
  try {
    return JSON.stringify(arg)
  } catch {
    return String(arg)
  }
}

/**
 * Across happy and error paths of redeemToken / signOut / useSession,
 * assert no console method ever received the access token (or any
 * 10-char substring of it). T-0001-082 broadened scope.
 */
function assertNoTokenLeak(spies: jest.SpyInstance[], token: string) {
  const segments: string[] = []
  for (let i = 0; i + 10 <= token.length; i += 5) {
    segments.push(token.slice(i, i + 10))
  }
  for (const spy of spies) {
    for (const call of spy.mock.calls) {
      for (const arg of call) {
        const serialized = serializeArg(arg)
        for (const seg of segments) {
          expect(serialized).not.toContain(seg)
        }
      }
    }
  }
}

// ---- Global test plumbing -------------------------------------------

const mockFetch = jest.fn()
let consoleSpies: jest.SpyInstance[] = []

beforeEach(() => {
  SecureStoreMock.__mem.clear()
  SecureStoreMock.getItemAsync.mockClear()
  SecureStoreMock.setItemAsync.mockClear()
  SecureStoreMock.deleteItemAsync.mockClear()
  mockFetch.mockReset()
  resetApiForTests()
  setRefreshClientForTests(null)
  global.fetch = mockFetch as unknown as typeof fetch
  jest.useRealTimers()
  consoleSpies = spyOnAllConsole()
})

afterEach(() => {
  jest.useRealTimers()
  consoleSpies.forEach((s) => s.mockRestore())
})

function mockSyncOk(user = {id: 'user-uuid-aaa', email: 'a@b.c'}) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({user}),
  })
}

function mockSync401() {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status: 401,
    statusText: 'Unauthorized',
    text: async () => 'unauthorized',
  })
}

// ---- Tests -----------------------------------------------------------

describe('SessionProvider', () => {
  it('T-0001-073: cold start with stored tokens → authenticated within 500ms', async () => {
    // Warm up the runtime first — first-render JIT compilation + lazy
    // module loading is NOT part of the provider's hydration budget.
    // The 500ms ceiling is for "provider mount → state resolved", not
    // "jest cold-start → state resolved". The warm-up render exercises
    // every transitive import on a do-nothing tree so the timed render
    // measures only what we care about.
    {
      const warm = render(
        <SessionProvider>
          <SessionProbe />
        </SessionProvider>,
      )
      await waitFor(() => {
        expect(warm.getByTestId('status').props.children).toBe('unauthenticated')
      })
      warm.unmount()
      SecureStoreMock.__mem.clear()
      SecureStoreMock.getItemAsync.mockClear()
    }

    // Seed secure-store directly via the mock memory.
    const accessToken = jwtForUser({sub: 'user-uuid-aaa', email: 'a@b.c', expSecondsFromNow: 3600})
    SecureStoreMock.__mem.set('appcreator.session.accessToken', accessToken)
    SecureStoreMock.__mem.set('appcreator.session.refreshToken', 'rt-abc')
    SecureStoreMock.__mem.set('appcreator.session.userId', 'user-uuid-aaa')

    const start = Date.now()
    const screen = render(
      <SessionProvider>
        <SessionProbe />
      </SessionProvider>,
    )

    // Explicit 600ms timeout — Roz Round 2 N-1 carry-forward: the default
    // waitFor (1000ms) would mask a 500ms-budget violation. 600 leaves a
    // small jest-scheduling buffer but proves the assertion is meaningful.
    await waitFor(
      () => {
        expect(screen.getByTestId('status').props.children).not.toBe('loading')
      },
      {timeout: 600},
    )
    const elapsed = Date.now() - start

    expect(screen.getByTestId('status').props.children).toBe('authenticated')
    expect(elapsed).toBeLessThan(500)
  })

  it('T-0001-074: cold start with no stored tokens → unauthenticated', async () => {
    const screen = render(
      <SessionProvider>
        <SessionProbe />
      </SessionProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('unauthenticated')
    })
  })

  it('T-0001-075: redeemToken stores tokens, calls /auth/sync, transitions to authenticated', async () => {
    const accessToken = jwtForUser({sub: 'user-uuid-aaa', email: 'a@b.c'})
    mockSyncOk({id: 'user-uuid-aaa', email: 'a@b.c'})

    let session: ReturnType<typeof useSession> | undefined
    const screen = render(
      <SessionProvider>
        <SessionProbe onValue={(v) => (session = v)} />
      </SessionProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('unauthenticated')
    })

    await act(async () => {
      await session!.redeemToken({accessToken, refreshToken: 'rt-abc'})
    })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toMatch(/\/auth\/sync$/)
    expect((init as RequestInit).method).toBe('POST')
    expect((init as {headers: Record<string, string>}).headers.Authorization).toBe(
      `Bearer ${accessToken}`,
    )

    expect(screen.getByTestId('status').props.children).toBe('authenticated')
    expect(screen.getByTestId('email').props.children).toBe('a@b.c')

    // Tokens persisted.
    const snap = await secureStore.read()
    expect(snap.accessToken).toBe(accessToken)
    expect(snap.refreshToken).toBe('rt-abc')
    expect(snap.userId).toBe('user-uuid-aaa')

    // T-0001-082: token never logged on the happy path.
    assertNoTokenLeak(consoleSpies, accessToken)
  })

  it('T-0001-076: signOut transitions to unauthenticated; subsequent apiFetch rejects', async () => {
    const accessToken = jwtForUser()
    SecureStoreMock.__mem.set('appcreator.session.accessToken', accessToken)
    SecureStoreMock.__mem.set('appcreator.session.refreshToken', 'rt-abc')
    SecureStoreMock.__mem.set('appcreator.session.userId', 'user-uuid-aaa')

    let session: ReturnType<typeof useSession> | undefined
    const screen = render(
      <SessionProvider>
        <SessionProbe onValue={(v) => (session = v)} />
      </SessionProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('authenticated')
    })

    await act(async () => {
      await session!.signOut()
    })

    expect(screen.getByTestId('status').props.children).toBe('unauthenticated')

    await expect(
      apiFetch('/projects', {baseUrl: 'http://localhost:3000'}),
    ).rejects.toBeInstanceOf(NotAuthenticatedError)

    // T-0001-082: signOut must not log the access token.
    assertNoTokenLeak(consoleSpies, accessToken)
  })

  it('T-0001-081: after signOut, secureStore.read() returns null for all token keys', async () => {
    const accessToken = jwtForUser()
    SecureStoreMock.__mem.set('appcreator.session.accessToken', accessToken)
    SecureStoreMock.__mem.set('appcreator.session.refreshToken', 'rt-abc')
    SecureStoreMock.__mem.set('appcreator.session.userId', 'user-uuid-aaa')

    let session: ReturnType<typeof useSession> | undefined
    render(
      <SessionProvider>
        <SessionProbe onValue={(v) => (session = v)} />
      </SessionProvider>,
    )
    await waitFor(() => expect(session?.status).toBe('authenticated'))

    await act(async () => {
      await session!.signOut()
    })

    const snap = await secureStore.read()
    expect(snap.accessToken).toBeNull()
    expect(snap.refreshToken).toBeNull()
    expect(snap.userId).toBeNull()
  })

  it('T-0001-077: malformed token → RedeemFailedError; tokens NOT stored', async () => {
    let session: ReturnType<typeof useSession> | undefined
    render(
      <SessionProvider>
        <SessionProbe onValue={(v) => (session = v)} />
      </SessionProvider>,
    )
    await waitFor(() => expect(session?.status).toBe('unauthenticated'))

    await expect(
      act(async () => {
        await session!.redeemToken({
          accessToken: 'not-a-real-jwt',
          refreshToken: 'rt-abc',
        })
      }),
    ).rejects.toBeInstanceOf(RedeemFailedError)

    // Tokens not persisted, fetch never called.
    expect(SecureStoreMock.setItemAsync).not.toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()
    expect(session!.status).toBe('unauthenticated')
  })

  it('T-0001-078: /auth/sync returns 401 → stays unauthenticated; tokens NOT stored', async () => {
    const accessToken = jwtForUser()
    mockSync401()

    let session: ReturnType<typeof useSession> | undefined
    render(
      <SessionProvider>
        <SessionProbe onValue={(v) => (session = v)} />
      </SessionProvider>,
    )
    await waitFor(() => expect(session?.status).toBe('unauthenticated'))

    await expect(
      act(async () => {
        await session!.redeemToken({accessToken, refreshToken: 'rt-abc'})
      }),
    ).rejects.toBeInstanceOf(RedeemFailedError)

    expect(SecureStoreMock.setItemAsync).not.toHaveBeenCalled()
    expect(session!.status).toBe('unauthenticated')

    // T-0001-082: even on the failure path, the token never reaches a
    // logger/console method.
    assertNoTokenLeak(consoleSpies, accessToken)
  })

  it('T-0001-123: signOut clears session ref synchronously; subsequent apiFetch rejects', async () => {
    const accessToken = jwtForUser()
    SecureStoreMock.__mem.set('appcreator.session.accessToken', accessToken)
    SecureStoreMock.__mem.set('appcreator.session.refreshToken', 'rt-abc')
    SecureStoreMock.__mem.set('appcreator.session.userId', 'user-uuid-aaa')

    let session: ReturnType<typeof useSession> | undefined
    render(
      <SessionProvider>
        <SessionProbe onValue={(v) => (session = v)} />
      </SessionProvider>,
    )
    await waitFor(() => expect(session?.status).toBe('authenticated'))

    // In-flight request that takes a while to resolve.
    let resolveInFlight: (v: unknown) => void = () => {}
    mockFetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveInFlight = resolve
        }),
    )
    const inFlight = apiFetch('/projects', {baseUrl: 'http://localhost:3000'})

    // User taps sign-out mid-flight.
    await act(async () => {
      await session!.signOut()
    })

    // Subsequent calls must reject — token is gone.
    await expect(
      apiFetch('/projects', {baseUrl: 'http://localhost:3000'}),
    ).rejects.toBeInstanceOf(NotAuthenticatedError)

    // The in-flight call resolves on its own timeline (here we resolve it
    // OK to demonstrate that it doesn't get retroactively poisoned).
    resolveInFlight({
      ok: true,
      status: 200,
      json: async () => ({projects: []}),
    })
    await expect(inFlight).resolves.toEqual({projects: []})
  })

  it('T-0001-133: refresh failure → unauthenticated, tokens cleared, next apiFetch rejects', async () => {
    // Token already past the refresh threshold so mount triggers refresh.
    const accessToken = jwtForUser({expSecondsFromNow: 30}) // <60s, will refresh
    SecureStoreMock.__mem.set('appcreator.session.accessToken', accessToken)
    SecureStoreMock.__mem.set('appcreator.session.refreshToken', 'rt-abc')
    SecureStoreMock.__mem.set('appcreator.session.userId', 'user-uuid-aaa')

    setRefreshClientForTests({
      refresh: jest.fn().mockRejectedValue(new Error('401')),
    })

    let session: ReturnType<typeof useSession> | undefined
    render(
      <SessionProvider>
        <SessionProbe onValue={(v) => (session = v)} />
      </SessionProvider>,
    )

    await waitFor(() => expect(session?.status).toBe('unauthenticated'))

    // Tokens cleared.
    const snap = await secureStore.read()
    expect(snap.accessToken).toBeNull()

    // Next apiFetch rejects.
    await expect(
      apiFetch('/projects', {baseUrl: 'http://localhost:3000'}),
    ).rejects.toBeInstanceOf(NotAuthenticatedError)

    // T-0001-082: refresh-failure path doesn't log the token.
    assertNoTokenLeak(consoleSpies, accessToken)
  })

  it('T-0001-079: refresh fires exactly once at exp - 60s (boundary)', async () => {
    jest.useFakeTimers()
    const expSeconds = 3600
    const accessToken = jwtForUser({expSecondsFromNow: expSeconds})
    SecureStoreMock.__mem.set('appcreator.session.accessToken', accessToken)
    SecureStoreMock.__mem.set('appcreator.session.refreshToken', 'rt-abc')
    SecureStoreMock.__mem.set('appcreator.session.userId', 'user-uuid-aaa')

    const refreshedAccess = jwtForUser({expSecondsFromNow: 3600})
    const refreshSpy = jest.fn().mockResolvedValue({
      accessToken: refreshedAccess,
      refreshToken: 'rt-new',
    })
    setRefreshClientForTests({refresh: refreshSpy})

    let session: ReturnType<typeof useSession> | undefined
    render(
      <SessionProvider>
        <SessionProbe onValue={(v) => (session = v)} />
      </SessionProvider>,
    )

    // Mount hydration runs microtasks; flush them under fake timers.
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(session?.status).toBe('authenticated')
    expect(refreshSpy).not.toHaveBeenCalled()

    // Advance to just before exp - 60s — refresh should not have fired yet.
    await act(async () => {
      jest.advanceTimersByTime((expSeconds - 60) * 1000 - 1000)
    })
    expect(refreshSpy).not.toHaveBeenCalled()

    // Cross the boundary — refresh fires exactly once.
    await act(async () => {
      jest.advanceTimersByTime(2000)
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(refreshSpy).toHaveBeenCalledTimes(1)
  })

  it('T-0001-080: secure-store read fails → resolves to unauthenticated, not stuck loading', async () => {
    SecureStoreMock.getItemAsync.mockRejectedValue(new Error('keychain unavailable'))

    let session: ReturnType<typeof useSession> | undefined
    const screen = render(
      <SessionProvider>
        <SessionProbe onValue={(v) => (session = v)} />
      </SessionProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('unauthenticated')
    })
    expect(session?.status).toBe('unauthenticated')
  })

  it('T-0001-083: two simultaneous redeemToken calls → one /auth/sync call', async () => {
    const accessToken = jwtForUser()
    mockSyncOk()

    let session: ReturnType<typeof useSession> | undefined
    render(
      <SessionProvider>
        <SessionProbe onValue={(v) => (session = v)} />
      </SessionProvider>,
    )
    await waitFor(() => expect(session?.status).toBe('unauthenticated'))

    await act(async () => {
      await Promise.all([
        session!.redeemToken({accessToken, refreshToken: 'rt-abc'}),
        session!.redeemToken({accessToken, refreshToken: 'rt-abc'}),
      ])
    })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(session?.status).toBe('authenticated')
  })

  it('T-0001-084: useSession() returns referentially stable value across renders unless state changed', async () => {
    const observed: Array<ReturnType<typeof useSession>> = []
    function Probe() {
      const s = useSession()
      observed.push(s)
      const [, setN] = useState(0)
      return (
        <Text testID="probe-status" onPress={() => setN((n) => n + 1)}>
          {s.status}
        </Text>
      )
    }

    const screen = render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('probe-status').props.children).toBe('unauthenticated'))

    // Force a re-render of the probe without changing session state.
    const beforeCount = observed.length
    await act(async () => {
      screen.getByTestId('probe-status').props.onPress()
    })

    // After the forced re-render, the latest observed value must be `===`
    // to the previous one (state didn't change).
    expect(observed.length).toBeGreaterThan(beforeCount)
    const last = observed[observed.length - 1]
    const prev = observed[observed.length - 2]
    expect(last).toBe(prev)
  })
})
