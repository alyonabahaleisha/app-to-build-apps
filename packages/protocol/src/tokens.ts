import {z} from 'zod'

// Color tokens (12) — resolved per stance + palette by the design-system package.
// The LLM picks token names only; never hex, RGBA, or gradient stops.
export const ColorTokenSchema = z.enum([
  'bg',
  'bg-elevated',
  'bg-overlay',
  'fg',
  'fg-muted',
  'fg-faint',
  'divider',
  'accent',
  'accent-fg',
  'success',
  'warning',
  'danger',
])
export type ColorToken = z.infer<typeof ColorTokenSchema>

// Spacing scale (6) — 0 / 4 / 8 / 12 / 20 / 32 pt
export const SpaceTokenSchema = z.enum([
  'space-none',
  'space-xs',
  'space-sm',
  'space-md',
  'space-lg',
  'space-xl',
])
export type SpaceToken = z.infer<typeof SpaceTokenSchema>

// Radius scale (5 named values — Sponsor-locked at 5 per F-12 ruling 2026-05-08)
// brief §3.2 counted "4" but listed 5 names; count typo, 5 values are correct.
export const RadiusTokenSchema = z.enum([
  'radius-none',
  'radius-sm',
  'radius-md',
  'radius-lg',
  'radius-full',
])
export type RadiusToken = z.infer<typeof RadiusTokenSchema>

// Type roles (6) — stance determines the concrete typeface and scale
export const TypeRoleSchema = z.enum([
  'type-display',
  'type-h1',
  'type-h2',
  'type-body',
  'type-caption',
  'type-micro',
])
export type TypeRole = z.infer<typeof TypeRoleSchema>

// Elevation (3) — shadow recipe resolved by the design-system package
export const ElevationSchema = z.enum([
  'elevation-flat',
  'elevation-raised',
  'elevation-floating',
])
export type Elevation = z.infer<typeof ElevationSchema>

// Motion curves (4) — collapsed to motion-instant in reduced-motion mode
export const MotionCurveSchema = z.enum([
  'motion-instant',
  'motion-snappy',
  'motion-smooth',
  'motion-springy',
])
export type MotionCurve = z.infer<typeof MotionCurveSchema>
