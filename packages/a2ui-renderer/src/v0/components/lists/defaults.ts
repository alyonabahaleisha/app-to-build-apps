/**
 * LIST_DEFAULTS — per-stance and per-itemLayout defaults for list components.
 *
 * estimatedItemSize values per ADR-0006 §Step 7 acceptance criteria:
 *   compact  → 44pt
 *   standard → 56pt (default)
 *   expanded → 80pt
 *
 * The stance controls separator style (productive = hairline divider,
 * expressive = gap-only) and minimum row height for press targets.
 *
 * Source: canvas-v0-ux.md §Lists tier
 */
import type {Stance} from '@app-creator/protocol'

export const ITEM_LAYOUT_HEIGHT = {
  compact: 44,
  standard: 56,
  expanded: 80,
} as const satisfies Record<string, number>

export type ItemLayout = keyof typeof ITEM_LAYOUT_HEIGHT

export const LIST_DEFAULTS = {
  productive: {
    /** Hairline 1pt divider between rows (productive stance). */
    separator: 'divider' as const,
    defaultItemLayout: 'standard' as const,
    loadingLines: 3,
    emptyIconSize: 48,
    emptyCircleSize: 88,
  },
  expressive: {
    /** Gap separation — no border line (expressive stance). */
    separator: 'gap' as const,
    defaultItemLayout: 'standard' as const,
    loadingLines: 3,
    emptyIconSize: 48,
    emptyCircleSize: 88,
  },
} as const satisfies Record<Stance, object>

export type ListDefaults = (typeof LIST_DEFAULTS)[Stance]
