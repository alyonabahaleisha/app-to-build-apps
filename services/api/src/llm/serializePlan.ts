/**
 * Serialize a Plan into the third system block for the builder.
 *
 * The returned string starts with the rule paragraph, then the pretty-printed
 * JSON of the plan. The output is deterministic for a given input —
 * JSON.stringify(plan, null, 2) produces a stable key order because Plan fields
 * are always present and the schema is well-typed.
 *
 * This block is injected as the *third* system block (after the cached catalog)
 * so it does not invalidate the catalog cache hit.
 */
import type {Plan} from '@app-creator/a2ui-schema'

export function serializePlan(plan: Plan): string {
  // plan.screens is validated min(1) by PlanSchema, so screens[0] is always present.
  const firstScreenId = plan.screens[0]!.id
  const idList = plan.screens.map(s => `"${s.id}"`).join(', ')
  const viewWord = plan.screens.length === 1 ? 'view' : 'views'
  return `This generation MUST honor the following plan exactly:
- Output exactly ${plan.screens.length} ${viewWord}, with view ids matching ${idList}.
- Set initialViewId to "${firstScreenId}".
- Honor the navigation pattern. If navigation === 'none', emit zero navigate actions anywhere in the spec.
- Do not invent extra screens; do not collapse screens.

PLAN:
${JSON.stringify(plan, null, 2)}`
}
