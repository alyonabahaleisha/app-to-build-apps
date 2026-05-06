/**
 * Tests for RendererThemeProvider and useRendererTheme.
 *
 * T-0003-017: RendererThemeProvider exposes the provided theme via useRendererTheme()
 * T-0003-018: useRendererTheme() outside the provider returns the default-light fallback (no throw)
 */
import {renderHook} from '@testing-library/react-native'
import React from 'react'

import {DEFAULT_LIGHT_THEME, RendererThemeProvider, useRendererTheme} from './RendererThemeProvider'
import type {RendererTheme} from '../types'

// -- Helpers ------------------------------------------------------------------

const CUSTOM_THEME: RendererTheme = {
  ...DEFAULT_LIGHT_THEME,
  palette: {
    ...DEFAULT_LIGHT_THEME.palette,
    primary: '#ff0000',
  },
}

// -- Tests --------------------------------------------------------------------

describe('RendererThemeProvider', () => {
  // T-0003-017
  it('exposes the provided theme via useRendererTheme()', () => {
    const {result} = renderHook(() => useRendererTheme(), {
      wrapper: ({children}) => (
        <RendererThemeProvider value={CUSTOM_THEME}>{children}</RendererThemeProvider>
      ),
    })
    expect(result.current.palette.primary).toBe('#ff0000')
    expect(result.current).toBe(CUSTOM_THEME)
  })

  it('passes through all theme shape keys (spacing, radius, palette, typography)', () => {
    const {result} = renderHook(() => useRendererTheme(), {
      wrapper: ({children}) => (
        <RendererThemeProvider value={CUSTOM_THEME}>{children}</RendererThemeProvider>
      ),
    })
    expect(result.current).toHaveProperty('spacing')
    expect(result.current).toHaveProperty('radius')
    expect(result.current).toHaveProperty('palette')
    expect(result.current).toHaveProperty('typography')
  })

  // T-0003-018
  it('useRendererTheme() outside provider returns default-light fallback — no throw', () => {
    // renderHook without a wrapper → no RendererThemeProvider in tree.
    const {result} = renderHook(() => useRendererTheme())
    expect(result.current).toBe(DEFAULT_LIGHT_THEME)
    // Verify it's actually the light theme (spot-check a few values).
    expect(result.current.palette.primary).toBe('#4f46e5')
    expect(result.current.spacing.md).toBe(16)
  })

  it('default-light theme has the same token shape as apps/mobile/src/theme/index.ts', () => {
    // Verify structure mirrors mobile theme so Step 8 conversion is one-line.
    const theme = DEFAULT_LIGHT_THEME
    // Spacing keys
    expect(theme.spacing['2xs']).toBe(2)
    expect(theme.spacing.xs).toBe(4)
    expect(theme.spacing.sm).toBe(8)
    expect(theme.spacing.md).toBe(16)
    expect(theme.spacing.lg).toBe(24)
    expect(theme.spacing.xl).toBe(32)
    expect(theme.spacing['2xl']).toBe(48)
    // Radius keys
    expect(theme.radius.sm).toBe(6)
    expect(theme.radius.md).toBe(10)
    expect(theme.radius.lg).toBe(16)
    expect(theme.radius.full).toBe(999)
    // Typography keys present
    expect(theme.typography.display).toBeDefined()
    expect(theme.typography.heading1).toBeDefined()
    expect(theme.typography.heading2).toBeDefined()
    expect(theme.typography.heading3).toBeDefined()
    expect(theme.typography.body).toBeDefined()
    expect(theme.typography.bodyStrong).toBeDefined()
    expect(theme.typography.caption).toBeDefined()
    // Palette structure
    expect(theme.palette.bg.surface).toBe('#ffffff')
    expect(theme.palette.text.primary).toBe('#0a0a0b')
  })

  it('RendererThemeProvider with no value prop uses default-light fallback', () => {
    const {result} = renderHook(() => useRendererTheme(), {
      wrapper: ({children}) => <RendererThemeProvider>{children}</RendererThemeProvider>,
    })
    expect(result.current).toBe(DEFAULT_LIGHT_THEME)
  })
})
