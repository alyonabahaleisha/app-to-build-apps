/**
 * INPUT_DEFAULTS — per-stance default values for input components.
 *
 * Input fields (TextField, NumberField, DateField, Picker) share the same
 * visual rhythm: label in type-caption fg-muted, input container bg-elevated
 * with divider border 1pt and radius-md.
 *
 * Switch rows are 56pt tall minimum (UX doc §Inputs tier, Switch spec).
 * Single-line TextInput and NumberField containers are 44pt minimum.
 *
 * Source: canvas-v0-ux.md §Inputs tier
 */
import type {Stance} from '@app-creator/protocol'

export const INPUT_DEFAULTS = {
  productive: {
    fieldRadius: 'radius-md',
    labelGap: 'space-xs',
    fieldPadding: 'space-md',
    switchRowHeight: 56,
    fieldMinHeight: 44,
    multilineHeight: 88,
  },
  expressive: {
    fieldRadius: 'radius-md',
    labelGap: 'space-xs',
    fieldPadding: 'space-md',
    switchRowHeight: 56,
    fieldMinHeight: 44,
    multilineHeight: 88,
  },
} as const satisfies Record<
  Stance,
  {
    fieldRadius: string
    labelGap: string
    fieldPadding: string
    switchRowHeight: number
    fieldMinHeight: number
    multilineHeight: number
  }
>

export type InputDefaults = (typeof INPUT_DEFAULTS)[Stance]
