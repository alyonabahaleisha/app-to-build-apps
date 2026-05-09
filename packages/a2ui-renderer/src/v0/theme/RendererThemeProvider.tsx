/**
 * RendererThemeProvider — resolves (stance, palette) → ResolvedTheme and
 * provides it to the renderer tree via context.
 *
 * Consumes `Spec.stance` and `Spec.palette` from the host renderer root.
 * theme() validates inputs via Zod (StanceSchema / PaletteSchema); it will
 * throw a ZodError on invalid values — the host must pass valid spec values.
 *
 * The resolved object from theme() is already frozen (Object.freeze) by the
 * design-system; no additional freezing required here (T-0006-038).
 *
 * Step 4 addition: RendererStanceContext provides the raw Stance string so
 * layout components can pick stance-aware defaults without deriving stance
 * from type-scale magic numbers. useStance() is the companion hook.
 */
import React, {createContext, useContext, useMemo} from 'react'
import {theme} from '@app-creator/design-system'
import type {ResolvedTheme} from '@app-creator/design-system'
import type {Stance, Palette} from '@app-creator/protocol'

// ---------------------------------------------------------------------------
// Contexts
// ---------------------------------------------------------------------------

// null default so useTheme can detect missing provider and throw.
const RendererThemeContext = createContext<ResolvedTheme | null>(null)

// null default so useStance can detect missing provider and throw.
const RendererStanceContext = createContext<Stance | null>(null)

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export type RendererThemeProviderProps = {
  stance: Stance
  palette: Palette
  children: React.ReactNode
}

export function RendererThemeProvider({stance, palette, children}: RendererThemeProviderProps) {
  // theme() validates stance and palette via Zod; throws ZodError on invalid (T-0006-031).
  // useMemo prevents re-resolution on unrelated re-renders; only re-runs when
  // stance or palette identity changes (both are string literals, so this is
  // effectively "only when the spec changes").
  const resolved = useMemo(() => theme(stance, palette), [stance, palette])

  return (
    <RendererStanceContext.Provider value={stance}>
      <RendererThemeContext.Provider value={resolved}>
        {children}
      </RendererThemeContext.Provider>
    </RendererStanceContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useTheme(): ResolvedTheme {
  const ctx = useContext(RendererThemeContext)
  if (ctx === null) {
    throw new Error(
      '[a2ui-renderer] useTheme must be used within a RendererThemeProvider',
    )
  }
  return ctx
}

/**
 * useStance — returns the current stance ('productive' | 'expressive').
 *
 * Provided separately from useTheme() because ResolvedTheme (from the
 * design-system package) does not carry a stance field — it only carries
 * resolved token values. Layout components need the raw stance to pick
 * per-stance defaults (e.g., screenPadding, stackGap).
 */
export function useStance(): Stance {
  const ctx = useContext(RendererStanceContext)
  if (ctx === null) {
    throw new Error(
      '[a2ui-renderer] useStance must be used within a RendererThemeProvider',
    )
  }
  return ctx
}
