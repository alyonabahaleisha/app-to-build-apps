/**
 * Icon name catalog — 80 semantic icon names (closed set).
 *
 * Source: canvas-v0-ux.md §Iconography. Names are kebab-case and map 1:1 to
 * Lucide icon exports (PascalCase conversion handled by gen-icon-paths.ts).
 *
 * Note: 'refresh-cw' substitutes the UX doc's 'refresh' — Lucide ships the
 * refresh glyph as 'RefreshCw', not 'Refresh'. Reported to Sable; accepted
 * as canonical name for this catalog.
 *
 * Counts by tier:
 *   Navigation   8
 *   Action      10
 *   Indicator    8
 *   Input        6
 *   Content     10
 *   Activity    10
 *   Domain      16
 *   Profile      4
 *   Commerce     4
 *   Time         4
 *   Total       80
 */
import {z} from 'zod'

export const ICON_NAMES = [
  // Navigation (8)
  'chevron-left',
  'chevron-right',
  'chevron-up',
  'chevron-down',
  'arrow-left',
  'arrow-right',
  'x',
  'more-horizontal',
  // Action (10)
  'plus',
  'minus',
  'share',
  'edit',
  'trash',
  'archive',
  'copy',
  'refresh-cw',
  'save',
  'send',
  // Indicator (8)
  'info',
  'alert-triangle',
  'check',
  'check-circle',
  'x-circle',
  'help-circle',
  'sparkles',
  'dot',
  // Input (6)
  'search',
  'filter',
  'eye',
  'eye-off',
  'mic',
  'paperclip',
  // Content kind (10)
  'list',
  'grid-2x2',
  'image',
  'file',
  'link',
  'calendar',
  'clock',
  'map-pin',
  'tag',
  'hash',
  // Activity (10)
  'heart',
  'star',
  'bookmark',
  'flame',
  'zap',
  'target',
  'trophy',
  'medal',
  'gift',
  'party-popper',
  // Domain (16)
  'book',
  'book-open',
  'dumbbell',
  'leaf',
  'droplet',
  'sun',
  'dollar-sign',
  'brain',
  'music',
  'camera',
  'palette',
  'code',
  'globe',
  'coffee',
  'plane',
  'rocket',
  // Profile (4)
  'user',
  'users',
  'log-out',
  'settings',
  // Commerce (4)
  'shopping-bag',
  'shopping-cart',
  'credit-card',
  'receipt',
  // Time (4)
  'timer',
  'hourglass',
  'history',
  'repeat',
] as const

export type IconName = (typeof ICON_NAMES)[number]
export const IconNameSchema = z.enum([...ICON_NAMES])
