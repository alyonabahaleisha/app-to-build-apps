/**
 * EmptyLibrary — the empty-state body for Home (Sable §Screen 2 → Empty).
 *
 * Per Sable: "large illustration (a flat sketch of a phone with sparkles
 * around it — kept minimal)." We use a Feather `smartphone` icon in a
 * tinted circle. No CTA — the sticky hero CTA above the list is the call
 * to action.
 */
import {EmptyState} from '#/components/EmptyState'

import {homeCopy} from '../copy'

export function EmptyLibrary() {
  return (
    <EmptyState
      iconName="smartphone"
      headline={homeCopy.emptyHeadline}
      subhead={homeCopy.emptySubhead}
      testID="library-empty"
    />
  )
}
