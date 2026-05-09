// Public API for @app-creator/design-system.
// Consumers import Stance/Palette types from @app-creator/protocol directly.
// This package exports token resolutions and the theme() resolver.

export {
  SPACING,
  RADII,
  TYPE_BY_STANCE,
  ELEVATION,
  MOTION,
  STANCE_COLORS,
  ACCENT_BY_STANCE_PALETTE,
} from './tokens.js'

export type {TypeScale, MotionEntry, MotionTimingEntry, MotionSpringEntry} from './tokens.js'

export {theme} from './theme.js'
export type {ResolvedTheme} from './theme.js'

// Icon component — <Icon name="..." size={24} color="..." />
export {Icon} from './icons/index.js'
export type {IconProps} from './icons/index.js'

// Cover art — deterministic SVG generation for mini-app library cards
export {coverArt, SHAPE_VOCABULARY, ALLOWED_SVG_ATTRS} from './coverArt.js'
export type {CoverArtInput, ShapeName} from './coverArt.js'
