/**
 * renderWithTheme — test utility that wraps components in the required
 * provider stack for V0 renderer component tests.
 *
 * Wraps in:
 *   - RendererThemeProvider (required by useTheme + useStance)
 *   - HostProvider (required by NodeRenderer's useHost)
 *
 * Usage:
 *   const {toJSON} = renderWithTheme(<ScreenRenderer node={...} />, {
 *     stance: 'productive',
 *     palette: 'focus',
 *   })
 */
import React from 'react'
import {render} from '@testing-library/react-native'
import type {Stance, Palette} from '@app-creator/protocol'
import {RendererThemeProvider} from '../theme/RendererThemeProvider'
import {HostProvider} from '../host/HostContext'
import type {HostCallbacks} from '../state/hostCallbacks'

const DEFAULT_HOST: HostCallbacks = {
  onToast: jest.fn(),
  onAIError: jest.fn(),
  onUnknownNodeType: jest.fn(),
}

type RenderWithThemeOptions = {
  stance?: Stance
  palette?: Palette
  host?: Partial<HostCallbacks>
}

export function renderWithTheme(
  ui: React.ReactElement,
  options: RenderWithThemeOptions = {},
) {
  const {stance = 'productive', palette = 'focus', host} = options
  const hostCallbacks: HostCallbacks = {...DEFAULT_HOST, ...host}

  const wrapper = ({children}: {children: React.ReactNode}) => (
    <RendererThemeProvider stance={stance} palette={palette}>
      <HostProvider value={hostCallbacks}>{children}</HostProvider>
    </RendererThemeProvider>
  )

  return {
    ...render(ui, {wrapper}),
    hostCallbacks,
  }
}
