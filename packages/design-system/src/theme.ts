// theme(stance, palette) → ResolvedTheme
//
// Resolves all 12 color tokens + spacing + radii + type + elevation + motion
// for a given (stance, palette) combination. Returns a frozen object so
// callers cannot mutate it and affect subsequent calls (MT-5 architectural
// contract, T-0005-218a).
//
// Stance/Palette types come from @app-creator/protocol — never re-exported
// from this module (T-0005-218 typecheck-only constraint).

import type {Stance, Palette} from '@app-creator/protocol'
import {StanceSchema, PaletteSchema} from '@app-creator/protocol'
import {
  SPACING,
  RADII,
  TYPE_BY_STANCE,
  ELEVATION,
  MOTION,
  STANCE_COLORS,
  ACCENT_BY_STANCE_PALETTE,
} from './tokens.js'

// ---------------------------------------------------------------------------
// ResolvedTheme — the full token surface for a (stance, palette) combination.
// ---------------------------------------------------------------------------
export type ResolvedTheme = {
  // Stance-locked colors (10)
  readonly bg: string
  readonly 'bg-elevated': string
  readonly 'bg-overlay': string
  readonly fg: string
  readonly 'fg-muted': string
  readonly 'fg-faint': string
  readonly divider: string
  readonly success: string
  readonly warning: string
  readonly danger: string
  // Palette-resolved colors (2)
  readonly accent: string
  readonly 'accent-fg': string
  // Token constants (same across all theme calls)
  readonly spacing: typeof SPACING
  readonly radii: typeof RADII
  readonly type: typeof TYPE_BY_STANCE[Stance]
  readonly elevation: typeof ELEVATION
  readonly motion: typeof MOTION
}

// ---------------------------------------------------------------------------
// theme() — the single export. Validates inputs (closed enums), then
// assembles and freezes the ResolvedTheme. Returns a fresh frozen object on
// every call — safe for caller mutation attempts, trivially cheap given the
// small token count.
// ---------------------------------------------------------------------------
export function theme(stance: Stance, palette: Palette): ResolvedTheme {
  // Validate against the closed enums from protocol. ZodError thrown if invalid.
  // This gives callers a useful error message on invalid inputs (T-0005-211/212).
  StanceSchema.parse(stance)
  PaletteSchema.parse(palette)

  const stanceColors = STANCE_COLORS[stance]
  const accentPair = ACCENT_BY_STANCE_PALETTE[stance][palette]

  return Object.freeze({
    bg: stanceColors.bg,
    'bg-elevated': stanceColors['bg-elevated'],
    'bg-overlay': stanceColors['bg-overlay'],
    fg: stanceColors.fg,
    'fg-muted': stanceColors['fg-muted'],
    'fg-faint': stanceColors['fg-faint'],
    divider: stanceColors.divider,
    success: stanceColors.success,
    warning: stanceColors.warning,
    danger: stanceColors.danger,
    accent: accentPair.accent,
    'accent-fg': accentPair['accent-fg'],
    spacing: SPACING,
    radii: RADII,
    type: TYPE_BY_STANCE[stance],
    elevation: ELEVATION,
    motion: MOTION,
  } satisfies ResolvedTheme)
}
