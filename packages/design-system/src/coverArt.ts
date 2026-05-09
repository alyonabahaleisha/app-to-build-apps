// coverArt({ stance, palette, icon, seed }) → canonical SVG string.
//
// Determinism contract (ADR-0005 §J):
//   1. PRNG: seedrandom@3.0.5 (pure JS, pinned exact) — same on Node + RN.
//   2. SHA-256 pre-hash: sha256(seed) → 64-char hex → seedrandom input.
//   3. Attribute serialization: alphabetical order, every element, every call.
//   4. Float precision: .toFixed(3) then trailing-zero strip. 0.500→0.5, 3.000→3.
//   5. Lucide path: looked up from ICON_PATHS at call time (deterministic table).
//
// Composition (canvas-v0-ux.md §Generated Cover Art Composition Formula):
//   Layer 1: bg-elevated background (both stances → #FFFFFF)
//   Layer 2: 3 shapes from 6-shape vocabulary, positioned via PRNG
//   Layer 3: 56pt icon-circle (bg color), 32pt Lucide icon (accent color)
//   Layer 4: NOT HERE — belongs in renderer per F-11 closure.
//
// Output is an SVG string with `\n` between element siblings.

import seedrandom from 'seedrandom'
import {sha256} from './hash.js'
import {ICON_PATHS} from '@app-creator/protocol'
import {theme} from './theme.js'
import type {Stance, Palette, IconName} from '@app-creator/protocol'
import {StanceSchema, PaletteSchema, IconNameSchema} from '@app-creator/protocol'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CoverArtInput = {
  readonly stance: Stance
  readonly palette: Palette
  readonly icon: IconName
  readonly seed: string // must be exactly 32 lowercase hex chars
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Card canvas dimensions per UX doc §Generated Cover Art Composition Formula
const CARD_W = 174
const CARD_H = 130

// Icon layer geometry (pt)
const ICON_CIRCLE_DIAMETER = 56
const ICON_SIZE = 32

// 6-shape vocabulary — canonical names (T-0005-267)
export const SHAPE_VOCABULARY = [
  'circle',
  'square',
  'rounded-square',
  'triangle',
  'ribbon',
  'arc',
] as const

export type ShapeName = (typeof SHAPE_VOCABULARY)[number]

// Seed validation: exactly 32 lowercase hex chars
const SEED_RE = /^[0-9a-f]{32}$/

// Allowed SVG attribute set (T-0005-266 security test)
// Layer 4 gradient attrs NOT included per F-11 closure.
export const ALLOWED_SVG_ATTRS = new Set([
  'cx',
  'cy',
  'd',
  'fill',
  'fill-opacity',
  'font-family',
  'font-size',
  'height',
  'r',
  'rx',
  'ry',
  'stroke',
  'stroke-width',
  'transform',
  'version',
  'viewBox',
  'width',
  'x',
  'xmlns',
  'y',
])

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateInput(input: CoverArtInput): void {
  // stance and palette — Zod throws a ZodError with a useful message
  StanceSchema.parse(input.stance)
  PaletteSchema.parse(input.palette)

  // icon — must be a known IconName
  IconNameSchema.parse(input.icon)

  // seed — must be exactly 32 lowercase hex chars
  if (input.seed === undefined || input.seed === null) {
    throw new Error('coverArt: seed is required')
  }
  if (!SEED_RE.test(input.seed)) {
    throw new Error(
      `coverArt: seed must be exactly 32 lowercase hex characters, got: "${input.seed}"`,
    )
  }
}

// ---------------------------------------------------------------------------
// SVG canonical serialization helpers
// ---------------------------------------------------------------------------

/**
 * Formats a numeric value: .toFixed(3) then strip trailing zeros and trailing '.'.
 * Examples: 0.500→"0.5", 3.000→"3", 3.140→"3.14", 0.001→"0.001"
 */
function formatValue(v: string | number): string {
  if (typeof v === 'string') return v
  return v.toFixed(3).replace(/\.?0+$/, '')
}

/**
 * Serializes an attribute map to canonical form: alphabetical key order,
 * each value formatted via formatValue.
 */
function canonicalAttrs(attrs: Record<string, string | number>): string {
  return Object.keys(attrs)
    .sort()
    .map(k => `${k}="${formatValue(attrs[k] as string | number)}"`)
    .join(' ')
}

/**
 * Wraps children in an SVG tag with the given attributes (alphabetical).
 * Children joined by \n.
 */
function svgTag(
  tag: string,
  attrs: Record<string, string | number>,
  children: string[] = [],
): string {
  const attrStr = canonicalAttrs(attrs)
  if (children.length === 0) {
    return `<${tag} ${attrStr}/>`
  }
  return `<${tag} ${attrStr}>\n${children.join('\n')}\n</${tag}>`
}

// ---------------------------------------------------------------------------
// PRNG helpers
// ---------------------------------------------------------------------------

/** Pick n distinct indices from an array of length len, using rng. */
function pickDistinctIndices(len: number, n: number, rng: seedrandom.PRNG): number[] {
  const available = Array.from({length: len}, (_, i) => i)
  const picked: number[] = []
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(rng() * available.length)
    picked.push(available[idx] as number)
    available.splice(idx, 1)
  }
  return picked
}

// ---------------------------------------------------------------------------
// Shape placement
// ---------------------------------------------------------------------------

type PlacedShape = {
  name: ShapeName
  x: number
  y: number
  size: number
  rotation: number
}

/**
 * Pick 3 distinct shapes from SHAPE_VOCABULARY and place each with a
 * deterministic position, size, and rotation derived from the PRNG.
 */
function pickAndPlaceShapes(rng: seedrandom.PRNG): PlacedShape[] {
  const indices = pickDistinctIndices(SHAPE_VOCABULARY.length, 3, rng)
  return indices.map(i => {
    const name = SHAPE_VOCABULARY[i] as ShapeName
    // Position: across the full canvas with some margin
    const margin = 20
    const x = margin + rng() * (CARD_W - 2 * margin)
    const y = margin + rng() * (CARD_H - 2 * margin)
    // Size: 24–80pt
    const size = 24 + rng() * 56
    // Rotation: -45 to +45 degrees
    const rotation = (rng() - 0.5) * 90
    return {name, x, y, size, rotation}
  })
}

// ---------------------------------------------------------------------------
// Shape → SVG element
// ---------------------------------------------------------------------------

/**
 * Renders a single shape element at its placed position.
 * All coordinates use canonicalAttrs for deterministic attribute order + floats.
 */
function renderShape(shape: PlacedShape, fill: string, fillOpacity: number): string {
  const {name, x, y, size, rotation} = shape
  const half = size / 2
  const transform = `rotate(${formatValue(rotation)},${formatValue(x)},${formatValue(y)})`

  switch (name) {
    case 'circle':
      return svgTag('circle', {
        cx: x,
        cy: y,
        fill,
        'fill-opacity': fillOpacity,
        r: half,
        transform,
      })

    case 'square':
      return svgTag('rect', {
        fill,
        'fill-opacity': fillOpacity,
        height: size,
        transform,
        width: size,
        x: x - half,
        y: y - half,
      })

    case 'rounded-square': {
      const rx = size * 0.2
      return svgTag('rect', {
        fill,
        'fill-opacity': fillOpacity,
        height: size,
        rx,
        ry: rx,
        transform,
        width: size,
        x: x - half,
        y: y - half,
      })
    }

    case 'triangle': {
      // Equilateral triangle centered at (x, y)
      const h = (size * Math.sqrt(3)) / 2
      const x1 = x
      const y1 = y - (h * 2) / 3
      const x2 = x - half
      const y2 = y + h / 3
      const x3 = x + half
      const y3 = y + h / 3
      const d = `M${formatValue(x1)},${formatValue(y1)} L${formatValue(x2)},${formatValue(y2)} L${formatValue(x3)},${formatValue(y3)} Z`
      return svgTag('path', {
        d,
        fill,
        'fill-opacity': fillOpacity,
        transform,
      })
    }

    case 'ribbon': {
      // Diagonal parallelogram ribbon
      const thickness = size * 0.25
      const halfLen = half
      const d = [
        `M${formatValue(x - halfLen)},${formatValue(y - thickness / 2)}`,
        `L${formatValue(x + halfLen)},${formatValue(y - thickness / 2)}`,
        `L${formatValue(x + halfLen)},${formatValue(y + thickness / 2)}`,
        `L${formatValue(x - halfLen)},${formatValue(y + thickness / 2)}`,
        'Z',
      ].join(' ')
      return svgTag('path', {
        d,
        fill,
        'fill-opacity': fillOpacity,
        transform,
      })
    }

    case 'arc': {
      // Semicircle arc (open path with stroke, no fill area)
      // Represent as a thick stroke arc for visual interest
      const r = half
      const strokeW = size * 0.15
      // Arc from left to right, top half
      const d = `M${formatValue(x - r)},${formatValue(y)} A${formatValue(r)},${formatValue(r)} 0 0,1 ${formatValue(x + r)},${formatValue(y)}`
      return svgTag('path', {
        d,
        fill: 'none',
        stroke: fill,
        'stroke-width': strokeW,
        transform,
      })
    }

    default: {
      // Should never happen — SHAPE_VOCABULARY is exhaustive
      const _exhaustive: never = name
      throw new Error(`coverArt: unknown shape "${_exhaustive as string}"`)
    }
  }
}

// ---------------------------------------------------------------------------
// Layer builders
// ---------------------------------------------------------------------------

function backgroundLayer(bgElevated: string): string {
  return svgTag('rect', {
    fill: bgElevated,
    height: CARD_H,
    width: CARD_W,
    x: 0,
    y: 0,
  })
}

function iconCircleLayer(bg: string): string {
  const cx = CARD_W / 2
  // 8pt below center per UX doc Layer 3
  const cy = CARD_H / 2 + 8
  return svgTag('circle', {
    cx,
    cy,
    fill: bg,
    r: ICON_CIRCLE_DIAMETER / 2,
  })
}

function iconElement(pathData: string, accent: string): string {
  const cx = CARD_W / 2
  const cy = CARD_H / 2 + 8
  // Icon is 32pt, centered within the 56pt circle.
  // Translate so path origin (0,0) maps to top-left of the 32pt bounding box.
  const iconX = cx - ICON_SIZE / 2
  const iconY = cy - ICON_SIZE / 2
  // Scale the 24-viewBox Lucide paths to ICON_SIZE (32pt)
  const scale = ICON_SIZE / 24
  const transform = `translate(${formatValue(iconX)},${formatValue(iconY)}) scale(${formatValue(scale)})`
  return svgTag('path', {
    d: pathData,
    fill: 'none',
    stroke: accent,
    'stroke-width': formatValue(2 / scale), // keep stroke visually ~2pt
    transform,
  })
}

// ---------------------------------------------------------------------------
// Canonical SVG assembly
// ---------------------------------------------------------------------------

function canonicalSVG(layers: string[]): string {
  const root = svgTag(
    'svg',
    {
      height: CARD_H,
      version: '1.1',
      viewBox: `0 0 ${CARD_W} ${CARD_H}`,
      width: CARD_W,
      xmlns: 'http://www.w3.org/2000/svg',
    },
    layers,
  )
  return root
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns a canonical, deterministic SVG string for the given cover art inputs.
 *
 * Determinism guarantee: same (stance, palette, icon, seed) → byte-identical
 * output on every call, across Node and React Native runtimes.
 *
 * Does NOT mutate the input object.
 * Does NOT produce Layer 4 (title gradient) — that lives in the renderer per
 * ADR-0005 F-11 closure.
 */
export function coverArt(input: CoverArtInput): string {
  // Validate first — throws descriptive errors for bad inputs
  validateInput(input)

  // Shallow copy — we never mutate input
  const {stance, palette, icon, seed} = input

  // MT-3 runtime guard — defense-in-depth even if codegen validated at build time
  const pathData = ICON_PATHS[icon]
  if (!pathData || pathData.length === 0) {
    throw new Error(
      `coverArt: empty path for icon "${icon}"; gen-icons codegen integrity broken`,
    )
  }

  // Resolve theme for this stance/palette combination
  const t = theme(stance, palette)

  // Seed the PRNG: sha256(seed) → 64-char hex → seedrandom
  const rng = seedrandom(sha256(seed))

  // Shape layer
  const shapes = pickAndPlaceShapes(rng)
  const shapeOpacity = stance === 'productive' ? 0.12 : 0.24

  // Build SVG layers
  const layers: string[] = [
    backgroundLayer(t['bg-elevated']),
    ...shapes.map(s => renderShape(s, t.accent, shapeOpacity)),
    iconCircleLayer(t.bg),
    iconElement(pathData, t.accent),
  ]

  return canonicalSVG(layers)
}
