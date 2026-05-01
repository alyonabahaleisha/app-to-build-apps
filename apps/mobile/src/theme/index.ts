/**
 * Theme tokens — minimal at M1, expand as components land.
 * Per ARCHITECTURE.md §6 / CLAUDE.md §1.
 */

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

export const palette = {
  light: {
    bg: '#ffffff',
    text: '#111111',
    muted: '#666666',
    primary: '#2563eb',
    destructive: '#dc2626',
  },
  dark: {
    bg: '#0b0b0b',
    text: '#f5f5f5',
    muted: '#a1a1aa',
    primary: '#60a5fa',
    destructive: '#f87171',
  },
} as const
