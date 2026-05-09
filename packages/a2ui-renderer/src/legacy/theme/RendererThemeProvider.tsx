/**
 * RendererThemeProvider — injects theme tokens into the renderer component tree.
 *
 * The renderer cannot import from apps/mobile/src/theme (workspace boundary).
 * AppRunner converts its useTheme() into a RendererTheme and wraps the
 * rendered tree in this provider (Step 8).
 *
 * Default (no provider): the default-light fallback theme (T-0003-018).
 * Calling useRendererTheme() outside a provider returns the light theme, not
 * a throw — the renderer must always be able to paint something.
 *
 * Token shape mirrors apps/mobile/src/theme/index.ts exactly so the Step 8
 * conversion is a one-line cast.
 */
import React, {createContext, useContext} from 'react'

import type {RendererTheme} from '../types'

// -- Default light theme (mirrors apps/mobile/src/theme/index.ts values) -----

export const DEFAULT_LIGHT_THEME: RendererTheme = {
  spacing: {
    '2xs': 2,
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    '2xl': 48,
  },
  radius: {
    sm: 6,
    md: 10,
    lg: 16,
    full: 999,
  },
  palette: {
    bg: {surface: '#ffffff', subtle: '#f6f7f9', elevated: '#ffffff'},
    text: {primary: '#0a0a0b', muted: '#5e6470', destructive: '#b3261e'},
    border: {subtle: '#e6e8eb', strong: '#c7ccd1'},
    primary: '#4f46e5',
    primaryHover: '#4338ca',
    primaryFg: '#ffffff',
    destructive: '#dc2626',
    destructiveFg: '#ffffff',
    focusRing: 'rgba(79, 70, 229, 0.4)',
  },
  typography: {
    display: {fontSize: 28, fontWeight: '700'},
    heading1: {fontSize: 22, fontWeight: '700'},
    heading2: {fontSize: 18, fontWeight: '600'},
    heading3: {fontSize: 16, fontWeight: '600'},
    body: {fontSize: 16, fontWeight: '400'},
    bodyStrong: {fontSize: 16, fontWeight: '600'},
    caption: {fontSize: 14, fontWeight: '400'},
  },
}

// -- Context ------------------------------------------------------------------

const RendererThemeContext = createContext<RendererTheme>(DEFAULT_LIGHT_THEME)

// -- Provider -----------------------------------------------------------------

export interface RendererThemeProviderProps {
  value?: RendererTheme
  children: React.ReactNode
}

export function RendererThemeProvider({
  value,
  children,
}: RendererThemeProviderProps): React.ReactElement {
  return (
    <RendererThemeContext.Provider value={value ?? DEFAULT_LIGHT_THEME}>
      {children}
    </RendererThemeContext.Provider>
  )
}

// -- Hook ---------------------------------------------------------------------

/**
 * useRendererTheme — returns the injected theme, or the default-light fallback
 * if no provider is mounted (T-0003-018). Never throws.
 */
export function useRendererTheme(): RendererTheme {
  return useContext(RendererThemeContext)
}
