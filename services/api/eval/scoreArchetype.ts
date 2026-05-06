/**
 * Shadow-mode archetype heuristic — infers an archetype from a legacy A2UI spec.
 *
 * Intentionally crude: the goal is to spot order-of-magnitude divergences
 * (planner says "Calculator" but legacy spec is clearly a 3-screen Tracker),
 * not to grade with precision. Do not over-engineer.
 *
 * Heuristic rules (first match wins):
 *   1. Single view, no List nodes, no Form nodes:
 *        → 'Calculator' (single-screen, input-driven)
 *   2. Single view, no List nodes, has Form or Counter/Toggle:
 *        → 'Calculator' (still single-screen compute pattern)
 *   3. Multi-view (≥ 2), any view has a List node:
 *        → 'ListCRUD' (most common multi-screen + list pattern)
 *   4. Multi-view (≥ 2), no List anywhere, has Counter or Toggle:
 *        → 'Tracker' (repeated logging without a full CRUD list)
 *   5. Anything else:
 *        → 'unknown'
 *
 * The heuristic is NOT authoritative. It is used only in --mode=shadow reports.
 */

import type {A2UISpec, A2UINode} from '@app-creator/a2ui-schema'

type HeuristicArchetype = 'Calculator' | 'ListCRUD' | 'Tracker' | 'unknown'

/**
 * Walk a node tree and collect the set of node types present anywhere in it.
 */
function collectNodeTypes(node: A2UINode, out: Set<string>): void {
  out.add(node.type)
  switch (node.type) {
    case 'Container':
      for (const child of node.children) collectNodeTypes(child, out)
      break
    case 'List':
      for (const item of node.items) collectNodeTypes(item, out)
      break
    case 'Form':
      for (const field of node.fields) collectNodeTypes(field, out)
      break
    default:
      break
  }
}

/**
 * Infer an approximate archetype from a legacy A2UI spec.
 * Returns one of 'Calculator' | 'ListCRUD' | 'Tracker' | 'unknown'.
 */
export function inferArchetypeFromSpec(spec: A2UISpec): HeuristicArchetype {
  const viewCount = spec.views.length

  // Collect all node types across all views.
  const allTypes = new Set<string>()
  for (const view of spec.views) {
    collectNodeTypes(view.root, allTypes)
  }

  const hasList = allTypes.has('List')
  const hasCounter = allTypes.has('Counter')
  const hasToggle = allTypes.has('Toggle')

  if (viewCount === 1) {
    // Single-view specs are most likely Calculator or SimpleGame.
    // Both collapse to 'Calculator' for shadow-mode purposes (we can't
    // reliably distinguish them without semantic context).
    return 'Calculator'
  }

  // Multi-view specs.
  if (hasList) {
    return 'ListCRUD'
  }

  if (hasCounter || hasToggle) {
    return 'Tracker'
  }

  return 'unknown'
}
