/**
 * validate.ts — Cross-reference validator for parsed Spec objects.
 *
 * Two-pass validation per ADR-0005 §G:
 *   1. Zod parse (SpecSchema.parse) — structural shape
 *   2. validateCrossRefs (this file) — referential integrity across the spec
 *
 * The validator runs 10 named checks and returns ALL errors, not just the first.
 * Each check accumulates its errors independently; the function merges them all.
 *
 * Data Sensitivity (Roz note): error returns are `public-safe` for server-side
 * logging. The `message` and `path` fields MUST NOT be returned verbatim to
 * end-users (they reveal collection IDs, field names, screen IDs from the LLM's
 * emission). Route handlers should return only `code` to the client. See ADR-0005
 * Data Sensitivity table.
 */
import type {Spec, Node} from './spec.zod.js'
import {MAX_NESTING_DEPTH} from './components/index.js'
import type {Action} from './actions.js'

// ---------------------------------------------------------------------------
// § Types
// ---------------------------------------------------------------------------

/**
 * Closed enum of 12 error codes. Adding a 13th requires an ADR bump —
 * escalate to Cal. MT-2 architectural call: slot_name_too_long is a Zod-parse
 * failure, not a cross-ref failure; it is intentionally absent.
 */
export type ValidationErrorCode =
  | 'unknown_collection'
  | 'unknown_field'
  | 'field_type_mismatch'
  | 'unknown_screen'
  | 'unknown_state_slot'
  | 'seed_field_missing'
  | 'seed_field_extra'
  | 'seed_required_missing'
  | 'nav_screen_count_mismatch'
  | 'none_nav_multiple_screens'
  | 'nesting_too_deep'
  | 'duplicate_id'

export type ValidationError = {
  path: (string | number)[]
  message: string
  code: ValidationErrorCode
}

export type ValidatorResult = {ok: true; spec: Spec} | {ok: false; errors: ValidationError[]}

// ---------------------------------------------------------------------------
// § Internal helpers
// ---------------------------------------------------------------------------

/** Shorthand to build a ValidationError. */
function err(
  code: ValidationErrorCode,
  path: (string | number)[],
  message: string,
): ValidationError {
  return {code, path, message}
}

/**
 * Walk every Node in a SpecScreen tree, calling `visit` with the node and
 * its current JSONPath (relative to spec root, e.g. ['screens', 0, 'root']).
 *
 * `visit` receives (node, path, depth). Returning `false` from `visit` stops
 * recursion into that node's children — used by depth-check to avoid useless
 * descending after the cap is hit.
 */
function walkNodes(
  node: Node,
  basePath: (string | number)[],
  depth: number,
  visit: (node: Node, path: (string | number)[], depth: number) => boolean | void,
): void {
  const continueDown = visit(node, basePath, depth)
  if (continueDown === false) return

  const children = 'children' in node ? (node.children as Node[]) : undefined
  if (!children) return

  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    if (child !== undefined) {
      walkNodes(child, [...basePath, 'children', i], depth + 1, visit)
    }
  }
}

/**
 * Walk every Action embedded anywhere in a Node (tapAction, action, swipe
 * actions, etc.). `basePath` is the JSONPath to the node itself; `actionKey`
 * is the property name that holds the action.
 */
function* extractNodeActions(
  node: Node,
  nodePath: (string | number)[],
): Generator<{action: Action; path: (string | number)[]}> {
  // All components that can carry one or more ActionSchema fields:
  // Button, FAB, Chip, EmptyState, ListItem, SwipeableRow, MediaTray

  const n = node as Record<string, unknown>

  const singleActionKeys = [
    'action',
    'tapAction',
    'leadingAction',
    'trailingAction',
  ] as const

  for (const key of singleActionKeys) {
    if (n[key] !== undefined && n[key] !== null) {
      yield {action: n[key] as Action, path: [...nodePath, key]}
    }
  }
}

// ---------------------------------------------------------------------------
// § Check 1 — collection refs (unknown_collection)
//
// Checks: every collectionId on a component or action references a collection
// that exists in spec.collections. Also feeds check 2 (field refs) and
// check 3 (field type).
// ---------------------------------------------------------------------------
function checkCollectionRefs(spec: Spec): ValidationError[] {
  const errors: ValidationError[] = []
  const collectionIds = new Set(spec.collections.map(c => c.id))

  function checkCollectionId(id: string, path: (string | number)[]): void {
    if (!collectionIds.has(id)) {
      errors.push(err('unknown_collection', path, `collection "${id}" not found`))
    }
  }

  // Walk node-level collectionId references.
  for (let si = 0; si < spec.screens.length; si++) {
    const screen = spec.screens[si]
    if (!screen) continue
    walkNodes(screen.root, ['screens', si, 'root'], 0, (node, nodePath) => {
      const n = node as Record<string, unknown>
      // Components: ConditionalSection, ListSummary, MediaTray, List
      if (typeof n['collectionId'] === 'string') {
        checkCollectionId(n['collectionId'], [...nodePath, 'collectionId'])
      }
      // Bindings: StringBinding/etc. with kind: 'collectionField'
      for (const bindingKey of ['valueBinding', 'disabled']) {
        if (n[bindingKey] && typeof n[bindingKey] === 'object') {
          const b = n[bindingKey] as Record<string, unknown>
          if (b['kind'] === 'collectionField' && typeof b['collectionId'] === 'string') {
            checkCollectionId(b['collectionId'], [...nodePath, bindingKey, 'collectionId'])
          }
        }
      }
    })

    // Walk actions embedded in nodes.
    walkNodes(screen.root, ['screens', si, 'root'], 0, (node, nodePath) => {
      for (const {action, path: actionPath} of extractNodeActions(node, nodePath)) {
        checkActionCollectionRef(action, actionPath)
      }
    })
  }

  function checkActionCollectionRef(action: Action, actionPath: (string | number)[]): void {
    if (
      action.type === 'update' ||
      action.type === 'addItem' ||
      action.type === 'removeItem' ||
      action.type === 'updateItem' ||
      action.type === 'clearCollection' ||
      action.type === 'aiProcess'
    ) {
      checkCollectionId(action.collection, [...actionPath, 'collection'])
    }
  }

  return errors
}

// ---------------------------------------------------------------------------
// § Check 2 — field refs (unknown_field) and Check 3 — field type mismatch
//
// MediaTray.imageField must reference a field that (a) exists on the named
// collection, (b) has type 'image'.
//
// Binding<collectionField>.field must reference a field that exists on the
// named collection. No type constraint on bindings (the LLM picks the right
// binding type for the field type; mismatches are caught at runtime).
// ---------------------------------------------------------------------------
function checkFieldRefs(spec: Spec): ValidationError[] {
  const errors: ValidationError[] = []
  const collectionMap = new Map(spec.collections.map(c => [c.id, c]))

  for (let si = 0; si < spec.screens.length; si++) {
    const screen = spec.screens[si]
    if (!screen) continue

    walkNodes(screen.root, ['screens', si, 'root'], 0, (node, nodePath) => {
      const n = node as Record<string, unknown>

      // MediaTray: imageField must exist and be type 'image'
      if (n['type'] === 'MediaTray') {
        const collId = n['collectionId'] as string | undefined
        const fieldName = n['imageField'] as string | undefined
        if (collId && fieldName) {
          const coll = collectionMap.get(collId)
          if (coll) {
            const field = coll.fields.find(f => f.name === fieldName)
            if (!field) {
              errors.push(
                err(
                  'unknown_field',
                  [...nodePath, 'imageField'],
                  `field "${fieldName}" not found on collection "${collId}"`,
                ),
              )
            } else if (field.type.type !== 'image') {
              errors.push(
                err(
                  'field_type_mismatch',
                  [...nodePath, 'imageField'],
                  `field "${fieldName}" on collection "${collId}" has type "${field.type.type}", expected "image"`,
                ),
              )
            }
          }
          // If collId is unknown, check 1 already reported it; skip field check.
        }
      }

      // Bindings with kind: 'collectionField' — field must exist on the collection
      for (const bindingKey of ['valueBinding', 'disabled']) {
        if (n[bindingKey] && typeof n[bindingKey] === 'object') {
          const b = n[bindingKey] as Record<string, unknown>
          if (b['kind'] === 'collectionField') {
            const collId = b['collectionId'] as string | undefined
            const fieldName = b['field'] as string | undefined
            if (collId && fieldName) {
              const coll = collectionMap.get(collId)
              if (coll) {
                const field = coll.fields.find(f => f.name === fieldName)
                if (!field) {
                  errors.push(
                    err(
                      'unknown_field',
                      [...nodePath, bindingKey, 'field'],
                      `field "${fieldName}" not found on collection "${collId}"`,
                    ),
                  )
                }
              }
            }
          }
        }
      }
    })
  }

  return errors
}

// ---------------------------------------------------------------------------
// § Check 4 — screen refs (unknown_screen)
//
// navigate actions must target a screen id in spec.screens.
// ---------------------------------------------------------------------------
function checkScreenRefs(spec: Spec): ValidationError[] {
  const errors: ValidationError[] = []
  const screenIds = new Set(spec.screens.map(s => s.id))

  for (let si = 0; si < spec.screens.length; si++) {
    const screen = spec.screens[si]
    if (!screen) continue

    walkNodes(screen.root, ['screens', si, 'root'], 0, (node, nodePath) => {
      for (const {action, path: actionPath} of extractNodeActions(node, nodePath)) {
        if (action.type === 'navigate') {
          if (!screenIds.has(action.target)) {
            errors.push(
              err(
                'unknown_screen',
                [...actionPath, 'target'],
                `screen "${action.target}" not found`,
              ),
            )
          }
        }
      }
    })
  }

  return errors
}

// ---------------------------------------------------------------------------
// § Check 5 — state slot refs (unknown_state_slot)
//
// Binding<state>.slot must be declared in initialState OR auto-derivable from
// a set/reset/capture/aiProcess action target in the same spec.
// ---------------------------------------------------------------------------
function checkStateSlotRefs(spec: Spec): ValidationError[] {
  const errors: ValidationError[] = []

  // Collect all slot names declared in initialState.
  const declaredSlots = new Set(Object.keys(spec.initialState ?? {}))

  // Collect all auto-derivable slots from set/reset/capture/aiProcess action targets.
  const autoSlots = new Set<string>()

  function collectActionTargets(action: Action): void {
    if (
      action.type === 'set' ||
      action.type === 'reset' ||
      action.type === 'capture'
    ) {
      autoSlots.add(action.target)
    }
    if (action.type === 'aiProcess') {
      autoSlots.add(action.target)
    }
  }

  // Walk all nodes in all screens to collect action targets.
  for (let si = 0; si < spec.screens.length; si++) {
    const screen = spec.screens[si]
    if (!screen) continue

    walkNodes(screen.root, ['screens', si, 'root'], 0, (node, _nodePath) => {
      for (const {action} of extractNodeActions(node, [])) {
        collectActionTargets(action)
      }
    })
  }

  const validSlots = new Set([...declaredSlots, ...autoSlots])

  // Now walk all bindings and check slot references.
  for (let si = 0; si < spec.screens.length; si++) {
    const screen = spec.screens[si]
    if (!screen) continue

    walkNodes(screen.root, ['screens', si, 'root'], 0, (node, nodePath) => {
      const n = node as Record<string, unknown>

      for (const bindingKey of ['valueBinding', 'disabled']) {
        if (n[bindingKey] && typeof n[bindingKey] === 'object') {
          const b = n[bindingKey] as Record<string, unknown>
          if (b['kind'] === 'state' && typeof b['slot'] === 'string') {
            if (!validSlots.has(b['slot'])) {
              errors.push(
                err(
                  'unknown_state_slot',
                  [...nodePath, bindingKey, 'slot'],
                  `state slot "${b['slot']}" not declared in initialState and not auto-derivable`,
                ),
              )
            }
          }
        }
      }
    })
  }

  return errors
}

// ---------------------------------------------------------------------------
// § Check 6+7+8 — seed data validation
//
// For each collection, every seed row:
//   6. seed_field_missing — row key set is missing a known field (row has a
//      subset of fields, but the absent field is in the collection's field list;
//      distinguished from required_missing by intent: this fires when a known
//      field key is simply absent from the row, whether or not it is required)
//      NOTE: The ADR treats seed_field_missing as "row missing a required field"
//      but the instruction distinguishes: "seed_field_missing means the row's
//      keyset is missing a known field" — we fire this when any field key is
//      missing from the row (required or not). This is the more conservative
//      interpretation that ensures all row keys match the field set exactly.
//
//   7. seed_field_extra — row has a key not in the collection's field names
//   8. seed_required_missing — a field with required: true is absent from the row
//
// Implementation note: seed_field_missing fires when the row is missing a field
// key entirely (the field exists in the collection but the row doesn't have it).
// seed_required_missing fires when that missing field also has required: true.
// A row missing a non-required field → seed_field_missing only.
// A row missing a required field → both seed_field_missing AND seed_required_missing.
//
// Per ADR: distinguish by: seed_field_missing = row keyset missing a known field;
// seed_required_missing = required: true field is absent. They can co-fire on the
// same field.
// ---------------------------------------------------------------------------
function checkSeedData(spec: Spec): ValidationError[] {
  const errors: ValidationError[] = []

  for (let ci = 0; ci < spec.collections.length; ci++) {
    const coll = spec.collections[ci]
    if (!coll) continue

    const fieldNames = new Set(coll.fields.map(f => f.name))
    const requiredFields = new Set(coll.fields.filter(f => f.required === true).map(f => f.name))

    for (let ri = 0; ri < coll.seedData.length; ri++) {
      const row = coll.seedData[ri]
      if (!row) continue

      const rowKeys = new Set(Object.keys(row))

      // Check 7: seed_field_extra — row has keys not in the field set
      for (const key of rowKeys) {
        if (!fieldNames.has(key)) {
          errors.push(
            err(
              'seed_field_extra',
              ['collections', ci, 'seedData', ri, key],
              `seed row key "${key}" is not a field on collection "${coll.id}"`,
            ),
          )
        }
      }

      // Check 6: seed_field_missing — row is missing a known field key
      for (const fieldName of fieldNames) {
        if (!rowKeys.has(fieldName)) {
          errors.push(
            err(
              'seed_field_missing',
              ['collections', ci, 'seedData', ri],
              `seed row is missing field "${fieldName}" on collection "${coll.id}"`,
            ),
          )
        }
      }

      // Check 8: seed_required_missing — required field is absent
      for (const fieldName of requiredFields) {
        if (!rowKeys.has(fieldName)) {
          errors.push(
            err(
              'seed_required_missing',
              ['collections', ci, 'seedData', ri],
              `seed row is missing required field "${fieldName}" on collection "${coll.id}"`,
            ),
          )
        }
      }
    }
  }

  return errors
}

// ---------------------------------------------------------------------------
// § Check 9 — navigation screen count
//
// tabs: 2–4 screens. T-0005-167 tests tabs with 1 screen → nav_screen_count_mismatch.
// ADR §G #6: "number of declared tabs matches number of screens (≤4)."
// none: exactly 1 screen. T-0005-168 tests none with 2 screens.
// stack/modal-overlay: no constraint (any number within the 1–4 Zod bounds).
// ---------------------------------------------------------------------------
function checkNavScreenCount(spec: Spec): ValidationError[] {
  const errors: ValidationError[] = []
  const count = spec.screens.length

  if (spec.navigation === 'tabs') {
    // tabs requires 2–4 screens (Zod already caps at 4; we enforce the minimum of 2)
    if (count < 2 || count > 4) {
      errors.push(
        err(
          'nav_screen_count_mismatch',
          ['navigation'],
          `tabs navigation requires 2–4 screens, but spec has ${count}`,
        ),
      )
    }
  } else if (spec.navigation === 'none') {
    if (count > 1) {
      errors.push(
        err(
          'none_nav_multiple_screens',
          ['navigation'],
          `none navigation requires exactly 1 screen, but spec has ${count}`,
        ),
      )
    }
  }

  return errors
}

// ---------------------------------------------------------------------------
// § Check 10 — nesting depth
//
// Max nesting depth is MAX_NESTING_DEPTH (8). A node at depth 9 (0-indexed from
// root = 0) fires nesting_too_deep. Path points to the deepest offending node.
// ---------------------------------------------------------------------------
function checkNestingDepth(spec: Spec): ValidationError[] {
  const errors: ValidationError[] = []

  for (let si = 0; si < spec.screens.length; si++) {
    const screen = spec.screens[si]
    if (!screen) continue

    walkNodes(screen.root, ['screens', si, 'root'], 0, (node, nodePath, depth) => {
      if (depth > MAX_NESTING_DEPTH) {
        errors.push(
          err(
            'nesting_too_deep',
            nodePath,
            `node at depth ${depth} exceeds max nesting depth of ${MAX_NESTING_DEPTH}`,
          ),
        )
        // Stop descending — every deeper node would also fire; one error per branch is enough.
        return false
      }
    })
  }

  return errors
}

// ---------------------------------------------------------------------------
// § Check 11 — duplicate ids
//
// All of the following must be globally unique within a spec:
//   - screen ids (spec.screens[].id)
//   - collection ids (spec.collections[].id)
//   - component node ids (all node .id values across all screens)
//   - initialState slot keys (Object.keys(spec.initialState))
//
// Each collision produces one duplicate_id error pointing to the second
// occurrence (the one that introduced the duplicate).
// ---------------------------------------------------------------------------
function checkDuplicateIds(spec: Spec): ValidationError[] {
  const errors: ValidationError[] = []
  const seen = new Map<string, (string | number)[]>() // id → first-seen path

  function check(id: string, path: (string | number)[]): void {
    if (seen.has(id)) {
      errors.push(err('duplicate_id', path, `id "${id}" is already used at ${JSON.stringify(seen.get(id))}`))
    } else {
      seen.set(id, path)
    }
  }

  // Screen ids
  for (let si = 0; si < spec.screens.length; si++) {
    const screen = spec.screens[si]
    if (screen) check(screen.id, ['screens', si, 'id'])
  }

  // Collection ids
  for (let ci = 0; ci < spec.collections.length; ci++) {
    const coll = spec.collections[ci]
    if (coll) check(coll.id, ['collections', ci, 'id'])
  }

  // Component node ids (walk all screens)
  for (let si = 0; si < spec.screens.length; si++) {
    const screen = spec.screens[si]
    if (!screen) continue

    walkNodes(screen.root, ['screens', si, 'root'], 0, (node, nodePath) => {
      const n = node as Record<string, unknown>
      if (typeof n['id'] === 'string') {
        check(n['id'], [...nodePath, 'id'])
      }
    })
  }

  // initialState slot keys
  if (spec.initialState) {
    const keys = Object.keys(spec.initialState)
    for (const key of keys) {
      check(key, ['initialState', key])
    }
  }

  return errors
}

// ---------------------------------------------------------------------------
// § validateCrossRefs — public API
// ---------------------------------------------------------------------------

/**
 * Runs 10 named cross-reference checks on a parsed Spec.
 *
 * Returns ALL errors across all checks — not just the first. Each check
 * accumulates independently; results are merged into a single error array.
 *
 * Contract: call AFTER SpecSchema.parse() succeeds. The validator assumes
 * the spec is structurally valid (Zod-pass) and only checks referential
 * integrity.
 */
export function validateCrossRefs(spec: Spec): ValidatorResult {
  const errors: ValidationError[] = [
    ...checkCollectionRefs(spec),   // Check 1: unknown_collection
    ...checkFieldRefs(spec),        // Check 2+3: unknown_field, field_type_mismatch
    ...checkScreenRefs(spec),       // Check 4: unknown_screen
    ...checkStateSlotRefs(spec),    // Check 5: unknown_state_slot
    ...checkSeedData(spec),         // Check 6+7+8: seed_field_missing/extra/required_missing
    ...checkNavScreenCount(spec),   // Check 9: nav_screen_count_mismatch, none_nav_multiple_screens
    ...checkNestingDepth(spec),     // Check 10: nesting_too_deep
    ...checkDuplicateIds(spec),     // Check 11: duplicate_id
  ]

  return errors.length > 0 ? {ok: false, errors} : {ok: true, spec}
}
