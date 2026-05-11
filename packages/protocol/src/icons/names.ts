/**
 * Icon name catalog — 98 semantic icon names (closed set).
 *
 * Source: canvas-v0-ux.md §Iconography (80 V0) + canvas-v1-catalog-expansion-phase1-ux.md
 * §Iconography (18 V1 Phase 1 additions — ADR-0009 Step 8). Names are kebab-case and
 * map 1:1 to Lucide icon exports (PascalCase conversion handled by gen-icon-paths.ts).
 *
 * Note: 'refresh-cw' substitutes the UX doc's 'refresh' — Lucide ships the
 * refresh glyph as 'RefreshCw', not 'Refresh'. Reported to Sable; accepted
 * as canonical name for this catalog.
 *
 * Note: 'circle-dollar-sign' substitutes the UX doc's 'currency-circle' — Lucide
 * ships the icon as 'CircleDollarSign'. The catalog name is the kebab-case of the
 * actual Lucide export.
 *
 * Counts by tier:
 *   Navigation    10  (+chevrons-up-down, chevrons-left-right)
 *   Action        10
 *   Indicator     10  (+bell, circle, plus-circle)
 *   Input          6
 *   Content       15  (+calendar-days, file-image, file-text, file-video, flag)
 *   Activity      10
 *   Domain        17  (+circle-dollar-sign, lightbulb, sliders-vertical, tags)
 *   Profile        4
 *   Commerce       4
 *   Time           4
 *   Media/Gallery  4  (+gallery-thumbnails, list-checks)
 *   Accessibility  4  (already counted above — no new tier)
 *   Total         98
 */
import {z} from 'zod'

export const ICON_NAMES = [
  // Navigation (10 — V1 adds chevrons-up-down, chevrons-left-right)
  'chevron-left',
  'chevron-right',
  'chevron-up',
  'chevron-down',
  'arrow-left',
  'arrow-right',
  'x',
  'more-horizontal',
  'chevrons-up-down',       // V1 Phase 1 Step 8 — MultiPicker trigger arrow
  'chevrons-left-right',    // V1 Phase 1 Step 8 — BeforeAfter slider handle
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
  // Indicator (11 — V1 adds bell, circle, plus-circle)
  'info',
  'alert-triangle',
  'check',
  'check-circle',
  'x-circle',
  'help-circle',
  'sparkles',
  'dot',
  'bell',                   // V1 Phase 1 Step 8 — notification / Callout warning
  'circle',                 // V1 Phase 1 Step 8 — RatingInput glyph variant
  'plus-circle',            // V1 Phase 1 Step 8 — StepList "Add step" affordance
  // Input (6)
  'search',
  'filter',
  'eye',
  'eye-off',
  'mic',
  'paperclip',
  // Content kind (15 — V1 adds calendar-days, file-image, file-text, file-video, flag)
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
  'calendar-days',          // V1 Phase 1 Step 8 — Calendar component
  'file-image',             // V1 Phase 1 Step 8 — DocumentPicker image type
  'file-text',              // V1 Phase 1 Step 8 — DocumentPicker default
  'file-video',             // V1 Phase 1 Step 8 — DocumentPicker video type
  'flag',                   // V1 Phase 1 Step 8 — StepList completion marker
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
  // Domain (20 — V1 adds circle-dollar-sign, gallery-thumbnails, lightbulb, list-checks, sliders-vertical, tags)
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
  'circle-dollar-sign',     // V1 Phase 1 Step 8 — MoneyField generic icon (Lucide: CircleDollarSign)
  'gallery-thumbnails',     // V1 Phase 1 Step 8 — Gallery empty state icon
  'lightbulb',              // V1 Phase 1 Step 8 — Callout `tip` variant icon
  'list-checks',            // V1 Phase 1 Step 8 — StepList icon
  'sliders-vertical',       // V1 Phase 1 Step 8 — Slider component indicator
  'tags',                   // V1 Phase 1 Step 8 — MultiPicker tag-style icon
  'lock',                   // V1 Phase 1 Step 8 — security / privacy patterns
  'trending-up',            // V1 Phase 1 Step 8 — Stat trend indicator
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
