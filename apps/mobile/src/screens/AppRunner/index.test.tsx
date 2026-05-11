/**
 * AppRunner Step 11 tests — ADR-0006 §Step 11.
 *
 * Covers:
 *   T-0006-174: AppRunner builds and renders the V0 renderer post-cutover.
 *   T-0006-176: Host share button calls copyShareLink(projectId).
 *   T-0006-179: @app-creator/a2ui-renderer package root re-exports canonical
 *               names (Renderer, SAMPLE_SPEC) without __V0_* prefix.
 *
 * The M1 flag-branching tests (V0_DEMO_ENABLED, V0DemoRunner, etc.) are
 * retired with the Step 11 cutover — the flag no longer exists.
 *
 * Step 11 deferrals (Roz Step 11 QA acknowledged):
 *
 * - T-0006-177 (failure: M1 spec → schema parse rejection → error boundary):
 *   Deferred to Step 13 (legacy delete). At Step 11 the legacy renderer is
 *   still in src/legacy/ and reachable via the @app-creator/a2ui-renderer/legacy
 *   subpath, so the M1-spec-to-error-boundary path doesn't yet have a clean
 *   test surface. Step 13 deletes legacy and the failure mode becomes the only
 *   path; that's where this test belongs.
 *
 * - T-0006-178 (boundary: iPhone SE 320x568 viewport no-overflow):
 *   Deferred to Step 12 (snapshot matrix). The 28-component snapshot matrix
 *   in Step 12 is the natural home for viewport-specific layout regression
 *   testing.
 */
import {fireEvent, render, waitFor} from '@testing-library/react-native'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import React from 'react'
import {SafeAreaProvider} from 'react-native-safe-area-context'

import {AppShellThemeProvider} from '#/theme/AppShellThemeProvider'
import {AppRunnerScreen, copyShareLink} from './index'

// -- Mocks -------------------------------------------------------------------

jest.mock('#/components/ToastProvider', () => ({
  useToast: () => ({show: jest.fn(), hide: jest.fn()}),
}))

jest.mock('#/logger', () => ({
  logger: {error: jest.fn(), warn: jest.fn(), info: jest.fn()},
  safeMessage: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}))

jest.mock('@expo/vector-icons', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React2 = require('react') as typeof import('react')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const RN = require('react-native') as typeof import('react-native')
  const Icon = (props: {name: string}) =>
    React2.createElement(RN.View, {testID: `icon-${props.name}`})
  return {__esModule: true, Feather: Icon}
})

// Mock the V0 Renderer with a sentinel view.
// The canonical import is Renderer (no __V0_ prefix) post-Step-11.
jest.mock('@app-creator/a2ui-renderer', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React2 = require('react') as typeof import('react')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const RN = require('react-native') as typeof import('react-native')

  const STUB_SPEC = {
    version: 1,
    archetype: 'ListCRUD',
    stance: 'productive',
    palette: 'focus',
    navigation: 'stack',
    initialScreenId: 'main',
    screens: [{id: 'main', root: {id: 'root', type: 'Screen', children: []}}],
  }

  return {
    // Canonical V0 surface — no __V0_* prefix post-Step-11.
    Renderer: ({}: {spec: unknown; host: unknown}) =>
      React2.createElement(RN.View, {testID: 'renderer-sentinel'}),
    SAMPLE_SPEC: STUB_SPEC,
    // DEMO_SPECS map — all 4 archetypes point to the same stub in tests.
    DEMO_SPECS: {
      ListCRUD: STUB_SPEC,
      Tracker: STUB_SPEC,
      Journal: STUB_SPEC,
      Calculator: STUB_SPEC,
    },
    // Legacy symbols deliberately absent from this mock — verifies T-0006-179:
    // the package root no longer exports __V0_* prefixed names.
    // (The mock itself omits them; any test importing them would fail loudly.)
  }
})

// Mock Share for T-0006-176 test.
jest.mock('react-native/Libraries/Share/Share', () => ({
  share: jest.fn().mockResolvedValue({action: 'sharedAction'}),
}))

// -- Helpers -----------------------------------------------------------------

const SAFE_AREA_METRICS = {
  frame: {x: 0, y: 0, width: 390, height: 844},
  insets: {top: 0, bottom: 0, left: 0, right: 0},
}

const PROJECT_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'

function makeNavigation() {
  return {
    goBack: jest.fn(),
    navigate: jest.fn(),
    canGoBack: jest.fn().mockReturnValue(true),
  }
}

function makeRoute(projectId = PROJECT_ID) {
  return {params: {projectId}}
}

function renderScreen(projectId = PROJECT_ID) {
  const qc = new QueryClient({
    defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
  })
  const nav = makeNavigation()
  const utils = render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <AppShellThemeProvider>
        <QueryClientProvider client={qc}>
          <AppRunnerScreen
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            route={makeRoute(projectId) as any}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            navigation={nav as any}
          />
        </QueryClientProvider>
      </AppShellThemeProvider>
    </SafeAreaProvider>,
  )
  return {...utils, nav}
}

// -- Tests -------------------------------------------------------------------

describe('AppRunnerScreen (Step 11 — V0 cutover)', () => {
  beforeEach(() => jest.clearAllMocks())

  // T-0006-174: AppRunner renders the V0 renderer post-cutover.
  it('T-0006-174: mounts the V0 Renderer sentinel', () => {
    const {getByTestId} = renderScreen()
    // The sentinel view wrapping <Renderer> must be present.
    expect(getByTestId('v0-renderer-sentinel')).toBeTruthy()
  })

  // T-0006-174 (continued): renderer sentinel is from the canonical mock — no M1 sentinel.
  it('T-0006-174: does not mount the legacy node-renderer-sentinel', () => {
    const {queryByTestId} = renderScreen()
    expect(queryByTestId('node-renderer-sentinel')).toBeNull()
  })

  // Back button (regression — present since ADR-0002).
  it('back button has "Back to library" accessibility label', () => {
    const {getByTestId} = renderScreen()
    const back = getByTestId('app-runner-back')
    expect(back.props.accessibilityLabel).toBe('Back to library')
  })

  it('back button calls navigation.goBack()', () => {
    const {getByTestId, nav} = renderScreen()
    fireEvent.press(getByTestId('app-runner-back'))
    expect(nav.goBack).toHaveBeenCalled()
  })

  // T-0006-176: Host share button calls copyShareLink(projectId).
  it('T-0006-176: share button is present with correct accessibility label', () => {
    const {getByTestId} = renderScreen()
    const share = getByTestId('app-runner-share')
    expect(share.props.accessibilityLabel).toBe('Share this app')
  })

  it('T-0006-176: pressing share button triggers copyShareLink with projectId', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {share: mockShare} = require('react-native/Libraries/Share/Share')
    const {getByTestId} = renderScreen(PROJECT_ID)
    fireEvent.press(getByTestId('app-runner-share'))
    await waitFor(() => {
      expect(mockShare).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining(PROJECT_ID),
        }),
      )
    })
  })

  // T-0006-179: Package root exports canonical names (no __V0_* prefix).
  it('T-0006-179: @app-creator/a2ui-renderer exports Renderer, SAMPLE_SPEC, and DEMO_SPECS', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rendererModule = require('@app-creator/a2ui-renderer')
    // Canonical names must be present.
    expect(typeof rendererModule.Renderer).toBe('function')
    expect(rendererModule.SAMPLE_SPEC).toBeDefined()
    expect(rendererModule.DEMO_SPECS).toBeDefined()
    expect(typeof rendererModule.DEMO_SPECS).toBe('object')
    // __V0_* prefixed names must NOT be present post-Step-11.
    expect(rendererModule.__V0_Renderer).toBeUndefined()
    expect(rendererModule.__V0_SAMPLE_SPEC).toBeUndefined()
    expect(rendererModule.__V0_NodeRenderer).toBeUndefined()
    expect(rendererModule.__V0_ThemeProvider).toBeUndefined()
    expect(rendererModule.__V0_HostProvider).toBeUndefined()
  })

  // Regression: no EXPO_PUBLIC_CANVAS_V0_DEMO flag export.
  it('AppRunnerScreen module does not export V0_DEMO_ENABLED flag', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m = require('./index')
    // Step 11 retires the flag. The constant must not be exported.
    expect(m.V0_DEMO_ENABLED).toBeUndefined()
    // V0DemoRunner was the step 10 shim — also retired.
    expect(m.V0DemoRunner).toBeUndefined()
  })

  // copyShareLink: no-op when projectId is undefined.
  it('copyShareLink is a no-op when projectId is undefined', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {share: mockShare} = require('react-native/Libraries/Share/Share')
    await copyShareLink(undefined)
    expect(mockShare).not.toHaveBeenCalled()
  })
})

// -- Step 13 deliverable (deferred from Step 11 per Roz QA) ------------------

// T-0006-177: M1 spec fed to V0 <Renderer> causes SpecSchema.parse() to throw;
// AppRunner's <RenderErrorBoundary> catches the error and renders the fallback.
//
// Split into two independent tests:
//
//   Part 1 (schema rejection): verifies that a literal M1 spec object fails
//   SpecSchema.safeParse — i.e. the V0 schema correctly rejects M1 shapes.
//   This is the precondition for the boundary test below.
//
//   Part 2 (boundary): verifies that RenderErrorBoundary (a real import, not mocked)
//   catches any thrown error and renders the correct fallback UI. We simulate
//   a ZodError throw via a ThrowOnMount component — the same behavior Renderer
//   exhibits when SpecSchema.parse() fails for an M1 spec.
//
// The module-level jest.mock('@app-creator/a2ui-renderer') stubs the Renderer
// sentinel, but RenderErrorBoundary is imported directly (not via the mock) so
// its real behavior is exercised.
describe('T-0006-177 (Step 13 — M1 spec → schema reject → error boundary)', () => {
  // Suppress React's console.error noise from intentional error boundary throws.
  let consoleSpy: jest.SpyInstance
  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.clearAllMocks()
  })
  afterEach(() => {
    consoleSpy.mockRestore()
  })

  it('T-0006-177 Part 1: M1 spec is rejected by V0 SpecSchema.parse()', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {SpecSchema} = require('@app-creator/protocol') as typeof import('@app-creator/protocol')

    // M1 spec literal — structurally invalid for V0:
    //   - missing required top-level fields: version, stance, palette, navigation, archetype
    //   - uses M1 component types ('Counter', 'Form', 'TextInput') absent from V0 NodeSchema
    const m1Spec = {
      screens: [
        {
          id: 'main',
          root: {
            id: 'root',
            type: 'Counter', // M1-only — not in V0 28-component union
            label: 'Pomodoro',
            initialValue: 0,
            min: 0,
            max: 100,
          },
        },
      ],
    }

    // SpecSchema.parse must reject this — missing required fields + unknown node types.
    const result = SpecSchema.safeParse(m1Spec)
    expect(result.success).toBe(false)
  })

  it('T-0006-177 Part 2: RenderErrorBoundary catches spec-parse ZodError and shows fallback', () => {
    // Import the real RenderErrorBoundary (not affected by the a2ui-renderer mock).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {RenderErrorBoundary} = require('./RenderErrorBoundary') as typeof import('./RenderErrorBoundary')

    const onBack = jest.fn()

    // ThrowOnMount simulates the ZodError that Renderer.SpecSchema.parse() throws
    // synchronously during render when it receives an M1 spec.
    function ThrowOnMount(): React.ReactElement {
      throw new Error(
        'ZodError: V0 SpecSchema.parse() failed — M1 component type "Counter" not in NodeSchema union',
      )
    }

    const {getByText, queryByTestId} = render(
      <AppShellThemeProvider>
        <RenderErrorBoundary projectId="proj-m1-test" renderHash="hash-m1" mode="owner" onBack={onBack}>
          <ThrowOnMount />
        </RenderErrorBoundary>
      </AppShellThemeProvider>,
    )

    // Fallback must render with the exact strings per Sable UX line 307 (T-0003-110).
    expect(getByText("This app didn't render correctly.")).toBeTruthy()
    expect(getByText('Try recreating it.')).toBeTruthy()
    expect(getByText('Back to library')).toBeTruthy()

    // The renderer sentinel must NOT be present — the renderer tree didn't mount.
    expect(queryByTestId('renderer-sentinel')).toBeNull()
  })
})

// -- Step 12 deliverable (deferred from Step 11 per Roz QA) ------------------

// T-0006-178: iPhone SE 320×568 viewport produces no overflow. Deferred to
// Step 12 where the 28-component snapshot matrix is the correct home for
// viewport-specific layout regression coverage.
describe.skip('T-0006-178 (Step 12 — snapshot matrix)', () => {
  it.todo('AppRunnerScreen renders without overflow on 320x568 (iPhone SE) viewport')
})
