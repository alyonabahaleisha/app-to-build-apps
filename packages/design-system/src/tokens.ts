// Design-system token resolutions.
// Token NAMES come from @app-creator/protocol. This file resolves those names
// to concrete values (numbers, strings, objects). Never re-export Stance or
// Palette from here — import from @app-creator/protocol directly.
//
// All constant declarations use `as const` for TypeScript readonly types.
// Object.freeze is applied at the top-level to also give runtime immutability.
// Nested objects are frozen individually for deep immutability.

import type {Stance} from '@app-creator/protocol'

// ---------------------------------------------------------------------------
// Spacing (6 named, pt)
// ---------------------------------------------------------------------------
export const SPACING = Object.freeze({
  'space-none': 0,
  'space-xs': 4,
  'space-sm': 8,
  'space-md': 12,
  'space-lg': 20,
  'space-xl': 32,
} as const)

// ---------------------------------------------------------------------------
// Radii (5 named — Sponsor-locked per F-12 ruling 2026-05-08)
// ---------------------------------------------------------------------------
export const RADII = Object.freeze({
  'radius-none': 0,
  'radius-sm': 6,
  'radius-md': 12,
  'radius-lg': 20,
  'radius-full': 9999,
} as const)

// ---------------------------------------------------------------------------
// Type roles per stance (size / lineHeight / weight / letterSpacing, in pt)
// Productive: SF Pro / Inter — single sans family throughout.
// Expressive: Tiempos Headline (or New York fallback) for display/h1/h2;
//             Inter for body/caption/micro.
// ---------------------------------------------------------------------------
export const TYPE_BY_STANCE = Object.freeze({
  productive: Object.freeze({
    display: Object.freeze({size: 32, lineHeight: 40, weight: 600, letterSpacing: -0.4} as const),
    h1: Object.freeze({size: 24, lineHeight: 30, weight: 600, letterSpacing: -0.2} as const),
    h2: Object.freeze({size: 18, lineHeight: 24, weight: 600, letterSpacing: 0} as const),
    body: Object.freeze({size: 16, lineHeight: 24, weight: 400, letterSpacing: 0} as const),
    caption: Object.freeze({size: 13, lineHeight: 18, weight: 400, letterSpacing: 0.1} as const),
    micro: Object.freeze({size: 11, lineHeight: 14, weight: 500, letterSpacing: 0.4} as const),
  } as const),
  expressive: Object.freeze({
    display: Object.freeze({size: 36, lineHeight: 44, weight: 500, letterSpacing: -0.6} as const),
    h1: Object.freeze({size: 28, lineHeight: 36, weight: 500, letterSpacing: -0.3} as const),
    h2: Object.freeze({size: 22, lineHeight: 30, weight: 500, letterSpacing: -0.1} as const),
    body: Object.freeze({size: 16, lineHeight: 26, weight: 400, letterSpacing: 0} as const),
    caption: Object.freeze({size: 14, lineHeight: 20, weight: 400, letterSpacing: 0} as const),
    micro: Object.freeze({size: 11, lineHeight: 14, weight: 500, letterSpacing: 0.4} as const),
  } as const),
} as const)

// ---------------------------------------------------------------------------
// Elevation (3 named, shadow recipe form)
// Same recipes for both stances — iOS-tuned, not Material.
// ---------------------------------------------------------------------------
export const ELEVATION = Object.freeze({
  'elevation-flat': Object.freeze({shadows: [] as readonly string[]} as const),
  'elevation-raised': Object.freeze({
    shadows: Object.freeze([
      '0 1px 2px rgba(15, 18, 22, 0.06)',
      '0 1px 1px rgba(15, 18, 22, 0.04)',
    ] as const),
  } as const),
  'elevation-floating': Object.freeze({
    shadows: Object.freeze([
      '0 8px 24px rgba(15, 18, 22, 0.10)',
      '0 2px 6px rgba(15, 18, 22, 0.06)',
    ] as const),
  } as const),
} as const)

// ---------------------------------------------------------------------------
// Motion curves (4 named)
// motion-springy has a different shape (stiffness/damping) — Reanimated spring.
// ---------------------------------------------------------------------------
export type MotionTimingEntry = {
  readonly type: 'timing'
  readonly duration: number
  readonly easing?: string
}

export type MotionSpringEntry = {
  readonly type: 'spring'
  readonly stiffness: number
  readonly damping: number
}

export type MotionEntry = MotionTimingEntry | MotionSpringEntry

export const MOTION = Object.freeze({
  'motion-instant': Object.freeze({type: 'timing', duration: 0} as const) satisfies MotionEntry,
  'motion-snappy': Object.freeze({
    type: 'timing',
    duration: 150,
    easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  } as const) satisfies MotionEntry,
  'motion-smooth': Object.freeze({
    type: 'timing',
    duration: 280,
    easing: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
  } as const) satisfies MotionEntry,
  'motion-springy': Object.freeze({
    type: 'spring',
    stiffness: 180,
    damping: 18,
  } as const) satisfies MotionEntry,
} as const)

// ---------------------------------------------------------------------------
// Stance-locked colors (10 per stance, same across all 6 palettes within a stance)
// Source of truth: canvas-v0-ux.md §Palette System
// ---------------------------------------------------------------------------
export const STANCE_COLORS = Object.freeze({
  productive: Object.freeze({
    bg: '#FAFAF7',
    'bg-elevated': '#FFFFFF',
    'bg-overlay': 'rgba(20, 23, 26, 0.45)',
    fg: '#14171A',
    'fg-muted': '#5C6470',
    'fg-faint': '#A2A8B2',
    divider: '#ECEEF1',
    success: '#0E8345',
    warning: '#B8580C',
    danger: '#C03A2B',
  } as const),
  expressive: Object.freeze({
    bg: '#FBF8F3',
    'bg-elevated': '#FFFFFF',
    'bg-overlay': 'rgba(26, 23, 21, 0.45)',
    fg: '#1A1715',
    'fg-muted': '#6B5F56',
    'fg-faint': '#B0A89E',
    divider: '#EFE9DF',
    success: '#4A7B45',
    warning: '#C46A2A',
    danger: '#B5392E',
  } as const),
} as const)

// ---------------------------------------------------------------------------
// Palette-resolved colors (accent + accent-fg per palette per stance)
// Source of truth: canvas-v0-ux.md §Palette System table
// NOTE: play/productive accent-fg is #1A1715 (dark) — amber is too light
// for white text. The only exception in the 12-pair table.
// ---------------------------------------------------------------------------
export const ACCENT_BY_STANCE_PALETTE = Object.freeze({
  productive: Object.freeze({
    focus: Object.freeze({accent: '#4F46E5', 'accent-fg': '#FFFFFF'} as const),
    health: Object.freeze({accent: '#0A7048', 'accent-fg': '#FFFFFF'} as const),
    money: Object.freeze({accent: '#0E7C7B', 'accent-fg': '#FFFFFF'} as const),
    social: Object.freeze({accent: '#C73456', 'accent-fg': '#FFFFFF'} as const),
    learn: Object.freeze({accent: '#7C3AED', 'accent-fg': '#FFFFFF'} as const),
    play: Object.freeze({accent: '#EA8B0E', 'accent-fg': '#1A1715'} as const),
  } as const),
  expressive: Object.freeze({
    focus: Object.freeze({accent: '#5B53D9', 'accent-fg': '#FFFFFF'} as const),
    health: Object.freeze({accent: '#4A7438', 'accent-fg': '#FFFFFF'} as const),
    money: Object.freeze({accent: '#2E5E5E', 'accent-fg': '#FFFFFF'} as const),
    social: Object.freeze({accent: '#B7456E', 'accent-fg': '#FFFFFF'} as const),
    learn: Object.freeze({accent: '#8E5DC4', 'accent-fg': '#FFFFFF'} as const),
    play: Object.freeze({accent: '#A85A14', 'accent-fg': '#FFFFFF'} as const),
  } as const),
} as const)

// ---------------------------------------------------------------------------
// Type aliases for internal use. Keep narrow — callers import Stance/Palette
// from @app-creator/protocol, never from this file.
// ---------------------------------------------------------------------------
export type TypeScale = (typeof TYPE_BY_STANCE)[Stance]
