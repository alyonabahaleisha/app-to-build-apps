import type {TextStyle} from 'react-native'

import type {A2UIAction, A2UIValue} from '@app-creator/a2ui-schema'

export type RenderState = Record<string, A2UIValue>

/**
 * Dispatch signature — single arg per §D of ADR-0003.
 * The `state` argument was informational only in the previous shape; the
 * reducer always read state from its own closure.
 *
 * TS function compatibility: (action) => void IS assignable to a slot typed
 * as (action, state) => void because TS allows implementations to ignore
 * trailing parameters. This is a non-breaking change (see T-0003-021b).
 */
export type Dispatch = (action: A2UIAction) => void

// -- Typography ---------------------------------------------------------------

export interface RendererTypography {
  display: {fontSize: number; fontWeight: TextStyle['fontWeight']}
  heading1: {fontSize: number; fontWeight: TextStyle['fontWeight']}
  heading2: {fontSize: number; fontWeight: TextStyle['fontWeight']}
  heading3: {fontSize: number; fontWeight: TextStyle['fontWeight']}
  body: {fontSize: number; fontWeight: TextStyle['fontWeight']}
  bodyStrong: {fontSize: number; fontWeight: TextStyle['fontWeight']}
  caption: {fontSize: number; fontWeight: TextStyle['fontWeight']}
}

// -- Spacing ------------------------------------------------------------------

export interface RendererSpacing {
  '2xs': number
  xs: number
  sm: number
  md: number
  lg: number
  xl: number
  '2xl': number
}

// -- Radius -------------------------------------------------------------------

export interface RendererRadius {
  sm: number
  md: number
  lg: number
  full: number
}

// -- Palette ------------------------------------------------------------------

export interface RendererPalette {
  bg: {surface: string; subtle: string; elevated: string}
  text: {primary: string; muted: string; destructive: string}
  border: {subtle: string; strong: string}
  primary: string
  primaryHover: string
  primaryFg: string
  destructive: string
  destructiveFg: string
  focusRing: string
}

// -- Theme bundle -------------------------------------------------------------

/**
 * RendererTheme — mirrors the mobile theme token shape (apps/mobile/src/theme/index.ts)
 * so the AppRunner conversion in Step 8 is a one-line assignment.
 * Only keys the 10 catalog components actually consume are included.
 */
export interface RendererTheme {
  spacing: RendererSpacing
  radius: RendererRadius
  palette: RendererPalette
  typography: RendererTypography
}

// -- Logger -------------------------------------------------------------------

export interface RendererLogger {
  warn(message: string, fields?: Record<string, unknown>): void
  error(message: string, fields?: Record<string, unknown>): void
}

export type Showtoast = (message: string) => void
