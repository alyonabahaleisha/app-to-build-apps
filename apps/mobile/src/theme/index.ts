/**
 * Theme tokens — full token set per UX doc §A2UI Catalog Visual Treatment
 * (`docs/ux/app-creation-poc-ux.md`). Light + dark, both ship at MVP
 * (ARCHITECTURE.md §6, §12).
 *
 * Per CLAUDE.md §1: components consume tokens via `useTheme()`. Never
 * hardcode hex or spacing literals at the call site.
 */
import {useColorScheme} from 'react-native'

// -- Spacing ---------------------------------------------------------------

export const spacing = {
  '2xs': 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
} as const

export type Spacing = keyof typeof spacing

// -- Radii -----------------------------------------------------------------

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  full: 999,
} as const

export type Radius = keyof typeof radius

// -- Typography -----------------------------------------------------------

export const typography = {
  display: {fontSize: 28, fontWeight: '700' as const},
  heading1: {fontSize: 22, fontWeight: '700' as const},
  heading2: {fontSize: 18, fontWeight: '600' as const},
  heading3: {fontSize: 16, fontWeight: '600' as const},
  body: {fontSize: 16, fontWeight: '400' as const},
  bodyStrong: {fontSize: 16, fontWeight: '600' as const},
  caption: {fontSize: 14, fontWeight: '400' as const},
} as const

// -- Palette --------------------------------------------------------------

export interface Palette {
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

const lightPalette: Palette = {
  bg: {surface: '#ffffff', subtle: '#f6f7f9', elevated: '#ffffff'},
  text: {primary: '#0a0a0b', muted: '#5e6470', destructive: '#b3261e'},
  border: {subtle: '#e6e8eb', strong: '#c7ccd1'},
  primary: '#4f46e5',
  primaryHover: '#4338ca',
  primaryFg: '#ffffff',
  destructive: '#dc2626',
  destructiveFg: '#ffffff',
  focusRing: 'rgba(79, 70, 229, 0.4)',
}

const darkPalette: Palette = {
  bg: {surface: '#0a0a0b', subtle: '#16181d', elevated: '#1f2229'},
  text: {primary: '#f5f5f7', muted: '#a4a8b3', destructive: '#f87171'},
  border: {subtle: '#2a2d34', strong: '#3a3f48'},
  primary: '#818cf8',
  primaryHover: '#a5b4fc',
  primaryFg: '#0a0a0b',
  destructive: '#f87171',
  destructiveFg: '#0a0a0b',
  focusRing: 'rgba(129, 140, 248, 0.4)',
}

// `palette` retained as a top-level export so existing imports keep working.
export const palette = {
  light: lightPalette,
  dark: darkPalette,
} as const

// -- Theme bundle ---------------------------------------------------------

export type ColorScheme = 'light' | 'dark'

export interface Theme {
  scheme: ColorScheme
  palette: Palette
  spacing: typeof spacing
  radius: typeof radius
  typography: typeof typography
}

export function buildTheme(scheme: ColorScheme): Theme {
  return {
    scheme,
    palette: scheme === 'dark' ? darkPalette : lightPalette,
    spacing,
    radius,
    typography,
  }
}

/**
 * Resolve the active theme from `useColorScheme()`. Returns the light theme
 * when the OS preference is unset (`null`) — matches iOS default.
 */
export function useTheme(): Theme {
  const scheme = useColorScheme()
  return buildTheme(scheme === 'dark' ? 'dark' : 'light')
}
