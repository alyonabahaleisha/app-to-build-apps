/**
 * api.ts tests — covers T-0001-082 (token-leak grep) and T-0001-124
 * (EXPO_PUBLIC_API_URL config exhaustion, 5 sub-cases).
 *
 * The token-leak portion is the security-critical lane: across happy-path
 * AND failure-path runs of `apiFetch`, no `console.*` method ever receives
 * the access token (or any ≥10-char substring) in any argument.
 *
 * Also enforces the `expo-secure-store` import boundary: only `secure.ts`
 * may import that module (ARCHITECTURE.md §5 + ADR-0001 Step 5 AC).
 */
import {execSync} from 'node:child_process'
import path from 'node:path'

import {
  ApiError,
  apiFetch,
  NotAuthenticatedError,
  resetApiForTests,
  resolveApiUrl,
  setCurrentSession,
} from './api'

// ---- Helpers ----------------------------------------------------------

const FAKE_TOKEN =
  'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEyMyIsImV4cCI6OTk5OTk5OTk5OX0.test-signature-please-do-not-leak'

const CONSOLE_METHODS = ['log', 'info', 'warn', 'error', 'debug'] as const

function spyOnAllConsole() {
  return CONSOLE_METHODS.map(m => jest.spyOn(console, m).mockImplementation(() => {}))
}

function serializeArg(arg: unknown): string {
  if (typeof arg === 'string') return arg
  try {
    return JSON.stringify(arg)
  } catch {
    return String(arg)
  }
}

function assertNoTokenLeak(spies: jest.SpyInstance[], token: string) {
  // Substrings ≥10 chars derived from the token. Catches partial logging
  // (e.g. someone logging just the signature segment) that a literal
  // includes-check would miss.
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

// ---- Module boundary: `expo-secure-store` is imported only by secure.ts

describe('expo-secure-store import boundary', () => {
  it('is imported only by src/state/persisted/secure.ts (and its own test)', () => {
    const srcRoot = path.resolve(__dirname, '..')
    // grep through src/ for `expo-secure-store`. Allowed: secure.ts (the
    // wrapper) and any test that mocks the module.
    // Build the package name from parts so this test file itself doesn't
    // match the grep (the file's own source code would otherwise show up
    // as a match).
    const pkg = 'expo-' + 'secure-store'
    let raw: string
    try {
      raw = execSync(
        `grep -rEl "(from|require\\() ?['\\\"]${pkg}['\\\"]" "${srcRoot}" --include="*.ts" --include="*.tsx"`,
        {encoding: 'utf8'},
      )
    } catch (err: unknown) {
      // grep exits 1 when no matches — treat as empty.
      const e = err as {status?: number; stdout?: string}
      if (e.status === 1) raw = e.stdout ?? ''
      else throw err
    }
    const files = raw
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
      .map(f => path.relative(srcRoot, f))

    const allowed = new Set([
      'state/persisted/secure.ts',
      // Tests are allowed to `jest.mock(...)` the package.
      'state/session/SessionProvider.test.tsx',
      // Coachmark dismissal state is stored in the iOS keychain (T-0011 AC).
      // Uses a separate key namespace (coachmark.*) from the session tokens.
      'lib/coachmarkStorage.ts',
      'lib/coachmarkStorage.test.ts',
      // RunScreen test mocks expo-secure-store for coachmark fixture control.
      'screens/Run/RunScreen.test.tsx',
      // Pending-clone intent persists share_id across the SIWA round-trip
      // (ADR-0008 Step 5). Separate key namespace (pendingClone.*) from
      // session tokens and coachmark state.
      'lib/pendingClone.ts',
      'lib/pendingClone.test.ts',
    ])
    const violations = files.filter(f => !allowed.has(f))
    expect(violations).toEqual([])
  })
})

// ---- T-0001-124: resolveApiUrl ---------------------------------------

describe('resolveApiUrl (T-0001-124)', () => {
  it('unset → falls back to localhost in dev with a warning; null otherwise', () => {
    const dev = resolveApiUrl(undefined, {isDev: true})
    expect(dev.url).toBe('http://localhost:3000')
    expect(dev.warning).toMatch(/not set/)

    const prod = resolveApiUrl(undefined, {isDev: false})
    expect(prod.url).toBeNull()
    expect(prod.warning).toMatch(/not set/)
  })

  it('empty string → same as unset', () => {
    expect(resolveApiUrl('', {isDev: true}).url).toBe('http://localhost:3000')
    expect(resolveApiUrl('   ', {isDev: false}).url).toBeNull()
  })

  it('valid HTTPS URL → used as-is', () => {
    const r = resolveApiUrl('https://api.example.com', {isDev: false})
    expect(r.url).toBe('https://api.example.com')
    expect(r.warning).toBeUndefined()
  })

  it('HTTP URL on non-localhost → dev: warns + uses; non-dev: refuses', () => {
    const dev = resolveApiUrl('http://192.168.1.10:3000', {isDev: true})
    expect(dev.url).toBe('http://192.168.1.10:3000')
    expect(dev.warning).toMatch(/HTTP/)

    const prod = resolveApiUrl('http://192.168.1.10:3000', {isDev: false})
    expect(prod.url).toBeNull()
    expect(prod.warning).toMatch(/HTTPS/)
  })

  it('HTTP URL on localhost → dev: accepted with no warning; non-dev: refused', () => {
    const dev = resolveApiUrl('http://localhost:3000', {isDev: true})
    expect(dev.url).toBe('http://localhost:3000')
    expect(dev.warning).toBeUndefined()

    const prod = resolveApiUrl('http://localhost:3000', {isDev: false})
    expect(prod.url).toBeNull()
  })

  it('malformed URL → dev: falls back; non-dev: refuses', () => {
    const dev = resolveApiUrl('not a url at all', {isDev: true})
    expect(dev.url).toBe('http://localhost:3000')
    expect(dev.warning).toMatch(/malformed/)

    const prod = resolveApiUrl('not a url at all', {isDev: false})
    expect(prod.url).toBeNull()
    expect(prod.warning).toMatch(/malformed/)
  })
})

// ---- apiFetch + token-leak (T-0001-082, T-0001-076) ------------------

describe('apiFetch — auth gate + token-leak grep', () => {
  const realFetch = global.fetch
  let consoleSpies: jest.SpyInstance[]

  beforeEach(() => {
    resetApiForTests()
    consoleSpies = spyOnAllConsole()
  })

  afterEach(() => {
    global.fetch = realFetch
    consoleSpies.forEach(s => s.mockRestore())
  })

  it('rejects authenticated routes with NotAuthenticatedError when no session (T-0001-076)', async () => {
    const fetchSpy = jest.fn()
    global.fetch = fetchSpy as unknown as typeof fetch

    await expect(apiFetch('/projects', {baseUrl: 'http://localhost:3000'})).rejects.toBeInstanceOf(
      NotAuthenticatedError,
    )
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('allows public paths without a session', async () => {
    const okBody = {sent: true}
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => okBody,
    }) as unknown as typeof fetch

    const result = await apiFetch<typeof okBody>('/auth/magic-link', {
      method: 'POST',
      body: JSON.stringify({email: 'a@b.c'}),
      baseUrl: 'http://localhost:3000',
    })
    expect(result).toEqual(okBody)
  })

  it('attaches Authorization header when session is set; never logs the token', async () => {
    setCurrentSession({accessToken: FAKE_TOKEN, userId: 'user-123'})
    const fetchSpy = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ok: true}),
    })
    global.fetch = fetchSpy as unknown as typeof fetch

    await apiFetch('/projects', {baseUrl: 'http://localhost:3000'})

    const [, init] = fetchSpy.mock.calls[0]
    expect(init.headers.Authorization).toBe(`Bearer ${FAKE_TOKEN}`)
    assertNoTokenLeak(consoleSpies, FAKE_TOKEN)
  })

  it('throws ApiError on non-2xx response; does not log the token (T-0001-082 failure path)', async () => {
    setCurrentSession({accessToken: FAKE_TOKEN, userId: 'user-123'})
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal',
      text: async () => 'boom',
    }) as unknown as typeof fetch

    await expect(apiFetch('/projects', {baseUrl: 'http://localhost:3000'})).rejects.toBeInstanceOf(
      ApiError,
    )

    assertNoTokenLeak(consoleSpies, FAKE_TOKEN)
  })
})
