/**
 * Archetype scoring — ADR-0007 Step 6 stub.
 *
 * The M1 heuristic (inferArchetypeFromSpec) is retired with the shadow mode.
 * V0 specs carry an explicit `archetype` field (one of the 4 closed enum values),
 * so archetype scoring is a direct field read — no heuristic needed.
 *
 * The full V0 scoring implementation is in ADR-0007 Step 7 / PR 4.
 * T-0007-174: scoreArchetype matches V0 spec.archetype field directly.
 */

import type {Spec} from '@app-creator/protocol'

export type Archetype = 'ListCRUD' | 'Tracker' | 'Journal' | 'Calculator'

/**
 * Return the archetype from a V0 spec directly.
 * The V0 spec carries an explicit archetype field — no inference needed.
 */
export function scoreArchetype(spec: Spec): Archetype {
  return spec.archetype as Archetype
}
