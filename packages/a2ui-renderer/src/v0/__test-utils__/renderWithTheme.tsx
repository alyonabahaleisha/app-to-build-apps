/**
 * renderWithTheme — test utility that wraps components in the required
 * provider stack for V0 renderer component tests.
 *
 * Wraps in:
 *   - RendererThemeProvider (required by useTheme + useStance)
 *   - HostProvider (required by NodeRenderer's useHost)
 *   - RendererStateContext.Provider (optional; required by input components
 *     that call useRendererStateContext() to access dispatch)
 *
 * Usage:
 *   const {toJSON} = renderWithTheme(<ScreenRenderer node={...} />, {
 *     stance: 'productive',
 *     palette: 'focus',
 *   })
 *
 * For input components that dispatch actions, pass a mockDispatch:
 *   const mockDispatch = jest.fn()
 *   const {toJSON} = renderWithTheme(<TextFieldRenderer node={...} />, {
 *     stance: 'productive',
 *     palette: 'focus',
 *     dispatch: mockDispatch,
 *     rendererState: buildInitialRendererState(spec),
 *   })
 */
import React from 'react'
import {render} from '@testing-library/react-native'
import type {Stance, Palette, Spec} from '@app-creator/protocol'
import {RendererThemeProvider} from '../theme/RendererThemeProvider'
import {HostProvider} from '../host/HostContext'
import type {HostCallbacks} from '../state/hostCallbacks'
import {RendererStateContext} from '../state/useRendererState'
import type {RendererState} from '../state/types'
import {buildInitialRendererState} from '../state/reducer'
import type {DispatchFn} from '../state/middleware'

const DEFAULT_HOST: HostCallbacks = {
  onToast: jest.fn(),
  onAIError: jest.fn(),
  onUnknownNodeType: jest.fn(),
}

// Minimal spec used when callers don't supply their own rendererState.
// Has no initialState slots and no collections, suitable for read-only tests.
const MINIMAL_SPEC: Spec = {
  version: 1,
  archetype: 'ListCRUD',
  stance: 'productive',
  palette: 'focus',
  coverIcon: 'list',
  navigation: 'none',
  screens: [{id: 's1', root: {id: 'n1', type: 'Heading', text: 'T', level: 1}}],
  initialScreenId: 's1',
  collections: [],
  initialState: {},
}

type RenderWithThemeOptions = {
  stance?: Stance
  palette?: Palette
  host?: Partial<HostCallbacks>
  /** Optional renderer state. Defaults to buildInitialRendererState(MINIMAL_SPEC). */
  rendererState?: RendererState
  /** Optional dispatch mock. Defaults to jest.fn(). */
  dispatch?: DispatchFn
}

export function renderWithTheme(
  ui: React.ReactElement,
  options: RenderWithThemeOptions = {},
) {
  const {stance = 'productive', palette = 'focus', host} = options
  const hostCallbacks: HostCallbacks = {...DEFAULT_HOST, ...host}
  const rendererState = options.rendererState ?? buildInitialRendererState(MINIMAL_SPEC)
  const dispatch = options.dispatch ?? (jest.fn() as DispatchFn)

  const wrapper = ({children}: {children: React.ReactNode}) => (
    <RendererThemeProvider stance={stance} palette={palette}>
      <HostProvider value={hostCallbacks}>
        <RendererStateContext.Provider value={{state: rendererState, dispatch}}>
          {children}
        </RendererStateContext.Provider>
      </HostProvider>
    </RendererThemeProvider>
  )

  return {
    ...render(ui, {wrapper}),
    hostCallbacks,
    dispatch,
  }
}
