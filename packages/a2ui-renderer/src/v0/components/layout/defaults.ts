/**
 * LAYOUT_DEFAULTS — per-stance default token values for layout components.
 *
 * Several layout props (padding, gap, radius) differ by stance:
 *   - Productive: tighter rhythm (space-md, radius-md)
 *   - Expressive: generous rhythm (space-lg, space-xl, radius-lg)
 *
 * Components read from this table instead of inlining literals so the
 * defaults are in one place and easy to reason about.
 *
 * Source: canvas-v0-ux.md §Component Specs, §Stance System
 */
import type {Stance} from '@app-creator/protocol'

export const LAYOUT_DEFAULTS = {
  productive: {
    screenPadding: 'space-lg',
    sectionPadding: 'space-md',
    stackGap: 'space-md',
    rowGap: 'space-sm',
    cardPadding: 'space-md',
    cardRadius: 'radius-md',
  },
  expressive: {
    screenPadding: 'space-xl',
    sectionPadding: 'space-lg',
    stackGap: 'space-lg',
    rowGap: 'space-sm',
    cardPadding: 'space-lg',
    cardRadius: 'radius-lg',
  },
} as const satisfies Record<
  Stance,
  {
    screenPadding: string
    sectionPadding: string
    stackGap: string
    rowGap: string
    cardPadding: string
    cardRadius: string
  }
>

export type LayoutDefaults = (typeof LAYOUT_DEFAULTS)[Stance]
