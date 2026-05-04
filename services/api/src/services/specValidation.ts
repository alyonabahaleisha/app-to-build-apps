/**
 * Deep validation for A2UISpec — three checks the Zod schema can't catch alone.
 *
 *   1. validateActionTargets — every set/increment/decrement.targetId must
 *      reference an input/Counter/Toggle id present somewhere in the spec.
 *      Catches LLM-generated specs that wire a Button to a non-existent input.
 *
 *   2. validateNavigateTargets — every navigate(viewId) action must point at
 *      a real `views[i].id`. The `initialViewId` itself is already enforced
 *      by the Zod superRefine in `@app-creator/a2ui-schema`.
 *
 *   3. validateMaxDepth — recursive walk of the node tree; rejects any path
 *      that exceeds 8 levels of nesting (per ARCHITECTURE.md §6 / ADR-0001
 *      T-0001-131). Defends the renderer against pathological LLM output.
 *
 * Throws `ValidationError` with a typed `.code` and an optional `.detail`
 * payload (the offending id/viewId for the unresolved-* cases). Routes
 * translate the error code to the HTTP error shape; services let it bubble.
 *
 * Pure module — no DB, no I/O, no side effects. Cheap to call before any
 * write.
 */
import type {A2UIAction, A2UINode, A2UISpec} from '@app-creator/a2ui-schema'

/**
 * Per ARCHITECTURE.md §6: the renderer expects bounded specs. 8 levels of
 * nesting is generous for hand-built layouts but tight enough to bound
 * recursion + render time. The root node counts as level 1.
 */
export const MAX_NESTING_DEPTH = 8

export type ValidationCode =
  | 'unresolved_target_id'
  | 'unresolved_view_id'
  | 'max_depth_exceeded'

export class ValidationError extends Error {
  override readonly name = 'ValidationError'
  readonly code: ValidationCode
  readonly detail?: string

  constructor(input: {code: ValidationCode; detail?: string; message?: string}) {
    super(input.message ?? `${input.code}${input.detail ? `: ${input.detail}` : ''}`)
    this.code = input.code
    this.detail = input.detail
  }
}

// ---------------------------------------------------------------------------
// Internal traversal helpers — narrow node shape and walk the tree.
// ---------------------------------------------------------------------------

/**
 * Walk every node in the spec, depth-first. Pure visitor — caller controls
 * what to do with each node. The root of every view is yielded.
 */
function walk(spec: A2UISpec, visit: (node: A2UINode) => void): void {
  for (const view of spec.views) walkNode(view.root, visit)
}

function walkNode(node: A2UINode, visit: (node: A2UINode) => void): void {
  visit(node)
  switch (node.type) {
    case 'List':
      for (const item of node.items) walkNode(item, visit)
      return
    case 'Form':
      for (const field of node.fields) walkNode(field, visit)
      return
    case 'Container':
      for (const child of node.children) walkNode(child, visit)
      return
    default:
      // Leaf nodes (Heading, Text, Image, Button, TextInput, Toggle, Counter)
      // have no children to walk.
      return
  }
}

// ---------------------------------------------------------------------------
// validateActionTargets
// ---------------------------------------------------------------------------

/** Component types that own an `id` referenceable by set/increment/decrement actions. */
const TARGETABLE_TYPES = new Set(['TextInput', 'Toggle', 'Counter'])

/** Collect every node's `id` whose type is in TARGETABLE_TYPES. */
function collectTargetableIds(spec: A2UISpec): Set<string> {
  const ids = new Set<string>()
  walk(spec, (node) => {
    if (TARGETABLE_TYPES.has(node.type)) {
      // TextInput/Toggle/Counter make `id` required at the schema level, so
      // the cast is safe. Belt-and-braces: only add when present + non-empty.
      const id = (node as {id?: string}).id
      if (typeof id === 'string' && id.length > 0) ids.add(id)
    }
  })
  return ids
}

/** Yield every Action carried by the spec — Button.action and Form.submitAction. */
function* allActions(spec: A2UISpec): Iterable<A2UIAction> {
  const seen: A2UIAction[] = []
  walk(spec, (node) => {
    if (node.type === 'Button') seen.push(node.action)
    if (node.type === 'Form' && node.submitAction) seen.push(node.submitAction)
  })
  yield* seen
}

export function validateActionTargets(spec: A2UISpec): void {
  const validIds = collectTargetableIds(spec)
  for (const action of allActions(spec)) {
    if (action.type === 'set' || action.type === 'increment' || action.type === 'decrement') {
      if (!validIds.has(action.targetId)) {
        throw new ValidationError({code: 'unresolved_target_id', detail: action.targetId})
      }
    }
  }
}

// ---------------------------------------------------------------------------
// validateNavigateTargets
// ---------------------------------------------------------------------------

export function validateNavigateTargets(spec: A2UISpec): void {
  const viewIds = new Set(spec.views.map((v) => v.id))
  for (const action of allActions(spec)) {
    if (action.type === 'navigate' && !viewIds.has(action.viewId)) {
      throw new ValidationError({code: 'unresolved_view_id', detail: action.viewId})
    }
  }
}

// ---------------------------------------------------------------------------
// validateMaxDepth
// ---------------------------------------------------------------------------

export function validateMaxDepth(spec: A2UISpec): void {
  for (const view of spec.views) checkDepth(view.root, 1)
}

function checkDepth(node: A2UINode, depth: number): void {
  if (depth > MAX_NESTING_DEPTH) {
    throw new ValidationError({code: 'max_depth_exceeded'})
  }
  switch (node.type) {
    case 'List':
      for (const item of node.items) checkDepth(item, depth + 1)
      return
    case 'Form':
      for (const field of node.fields) checkDepth(field, depth + 1)
      return
    case 'Container':
      for (const child of node.children) checkDepth(child, depth + 1)
      return
    default:
      return
  }
}

// ---------------------------------------------------------------------------
// Entry point — runs all three. Order: depth first (cheapest sanity check),
// then targets, then views. First failure short-circuits.
// ---------------------------------------------------------------------------

export function deepValidateSpec(spec: A2UISpec): void {
  validateMaxDepth(spec)
  validateActionTargets(spec)
  validateNavigateTargets(spec)
}
