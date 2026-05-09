/**
 * RendererThemeProvider tests
 * T-0006-029: productive×focus resolves bg → #FAFAF7
 * T-0006-030: all 12 stance×palette pairs resolve correctly
 * T-0006-031: invalid stance throws
 * T-0006-038: resolved theme object is frozen (from design-system; verify pass-through)
 * Bonus (Roz Step 2 note): useTheme outside provider throws
 * Bonus (Roz Step 2 note): useRendererStateContext outside provider throws
 */
import React from 'react'
import {renderHook} from '@testing-library/react-native'
import {RendererThemeProvider, useTheme} from './RendererThemeProvider'
import {useRendererStateContext, RendererStateContext} from '../state/useRendererState'
import type {Stance, Palette} from '@app-creator/protocol'

// ---------------------------------------------------------------------------
// T-0006-029: happy path — productive×focus
// ---------------------------------------------------------------------------

describe('RendererThemeProvider (T-0006-029)', () => {
  it('provides bg=#FAFAF7 for productive×focus', () => {
    const wrapper = ({children}: {children: React.ReactNode}) => (
      <RendererThemeProvider stance="productive" palette="focus">
        {children}
      </RendererThemeProvider>
    )

    const {result} = renderHook(() => useTheme(), {wrapper})
    expect(result.current.bg).toBe('#FAFAF7')
  })
})

// ---------------------------------------------------------------------------
// T-0006-030: parameterized — all 12 stance×palette combinations
// ---------------------------------------------------------------------------

const STANCES: Stance[] = ['productive', 'expressive']
const PALETTES: Palette[] = ['focus', 'health', 'money', 'social', 'learn', 'play']

describe('RendererThemeProvider (T-0006-030) — all 12 registers', () => {
  for (const stance of STANCES) {
    for (const palette of PALETTES) {
      it(`resolves ${stance}×${palette} without throwing`, () => {
        const wrapper = ({children}: {children: React.ReactNode}) => (
          <RendererThemeProvider stance={stance} palette={palette}>
            {children}
          </RendererThemeProvider>
        )

        const {result} = renderHook(() => useTheme(), {wrapper})

        // Every register must produce a bg color (non-empty string).
        expect(typeof result.current.bg).toBe('string')
        expect(result.current.bg.length).toBeGreaterThan(0)

        // Every register must produce accent + accent-fg.
        expect(typeof result.current.accent).toBe('string')
        expect(typeof result.current['accent-fg']).toBe('string')

        // Spacing, radii, type, elevation, motion must be present.
        expect(result.current.spacing).toBeDefined()
        expect(result.current.radii).toBeDefined()
        expect(result.current.type).toBeDefined()
        expect(result.current.elevation).toBeDefined()
        expect(result.current.motion).toBeDefined()
      })
    }
  }
})

// ---------------------------------------------------------------------------
// T-0006-031: invalid stance throws (ZodError from design-system theme())
// ---------------------------------------------------------------------------

describe('RendererThemeProvider (T-0006-031)', () => {
  it('throws when an invalid stance is provided', () => {
    // Suppress React's error boundary noise in the test output.
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    const wrapper = ({children}: {children: React.ReactNode}) => (
      // @ts-expect-error — intentionally passing invalid stance to test runtime validation
      <RendererThemeProvider stance="invalid" palette="focus">
        {children}
      </RendererThemeProvider>
    )

    expect(() => renderHook(() => useTheme(), {wrapper})).toThrow()

    consoleSpy.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// T-0006-038: resolved theme is frozen (Object.freeze pass-through from design-system)
// ---------------------------------------------------------------------------

describe('RendererThemeProvider (T-0006-038)', () => {
  it('provides a frozen ResolvedTheme object', () => {
    const wrapper = ({children}: {children: React.ReactNode}) => (
      <RendererThemeProvider stance="productive" palette="focus">
        {children}
      </RendererThemeProvider>
    )

    const {result} = renderHook(() => useTheme(), {wrapper})
    expect(Object.isFrozen(result.current)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Bonus (Roz Step 2 note): useTheme called outside provider throws
// ---------------------------------------------------------------------------

describe('useTheme (outside provider)', () => {
  it('throws a descriptive error when called outside RendererThemeProvider', () => {
    expect(() => renderHook(() => useTheme())).toThrow(
      '[a2ui-renderer] useTheme must be used within a RendererThemeProvider',
    )
  })
})

// ---------------------------------------------------------------------------
// Bonus (Roz Step 2 note): useRendererStateContext called outside provider throws
// Coverage for the throw path at useRendererState.ts lines 157+.
// ---------------------------------------------------------------------------

describe('useRendererStateContext (outside provider)', () => {
  it('throws a descriptive error when called outside RendererStateContext.Provider', () => {
    expect(() => renderHook(() => useRendererStateContext())).toThrow(
      '[a2ui-renderer] useRendererStateContext must be called inside a RendererStateContext.Provider',
    )
  })

  it('does not throw when called inside RendererStateContext.Provider', () => {
    const mockValue = {
      state: {} as ReturnType<typeof useRendererStateContext>['state'],
      dispatch: jest.fn(),
    }

    const wrapper = ({children}: {children: React.ReactNode}) => (
      <RendererStateContext.Provider value={mockValue}>
        {children}
      </RendererStateContext.Provider>
    )

    const {result} = renderHook(() => useRendererStateContext(), {wrapper})
    expect(result.current.dispatch).toBe(mockValue.dispatch)
  })
})
