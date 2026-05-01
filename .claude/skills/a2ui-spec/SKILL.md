---
description: "A2UI spec skill: the JSON schema, 10-component catalog, action contract, render rules, and edit-by-JSON-Patch protocol for the App Creator's generated apps."
user-invocable: false
---

# A2UI Spec Skill

The A2UI ("AI-to-UI") spec is the contract between the LLM and the renderer. It lives in `packages/a2ui-schema/` (Zod definitions + TS types) and is consumed by both the server (validates LLM output before persistence) and the mobile client (validates before render).

## When to use this skill

- Adding or modifying a component type in the catalog.
- Designing prompts that emit an A2UI spec.
- Implementing a renderer for a catalog component.
- Validating a stored spec before render.
- Producing or applying an edit patch.

## The hard contract

ARCHITECTURE.md §6 is binding. Adding a component type requires **all five gates**:

1. Zod schema entry in `packages/a2ui-schema/`.
2. Renderer implementation in `packages/a2ui-renderer/components/<Type>.tsx`.
3. Catalog entry in the system prompt at `services/api/src/llm/prompts/catalog.ts`.
4. At least 3 eval prompts that exercise it.
5. Entry in ARCHITECTURE.md §6 catalog table.

Skip any of these and the QA agent will reject the PR.

## The 10-component catalog (M1)

| Type | Required | Optional |
|---|---|---|
| `Heading` | `text: string` | `level: 1|2|3` |
| `Text` | `text: string` | `weight: 'normal'|'bold', color: 'primary'|'muted'|'destructive'` |
| `Image` | `src: string` | `aspectRatio: number, alt: string` |
| `Button` | `label: string, action: A2UIAction` | `variant: 'primary'|'secondary'|'destructive'` |
| `TextInput` | `id: string, label: string` | `placeholder: string, multiline: boolean` |
| `Toggle` | `id: string, label: string` | `defaultValue: boolean` |
| `Counter` | `id: string, label: string` | `min: number, max: number, step: number` |
| `List` | `items: A2UINode[]` | `separator: boolean` |
| `Form` | `id: string, fields: A2UINode[]` | `submitLabel: string, submitAction: A2UIAction` |
| `Container` | `direction: 'row'|'column', children: A2UINode[]` | `padding, gap, align, justify` |

## The action contract

`A2UIAction` is a closed sum type:

```ts
type A2UIAction =
  | {type: 'set'; targetId: string; value: A2UIValue}
  | {type: 'increment'; targetId: string; by?: number}
  | {type: 'decrement'; targetId: string; by?: number}
  | {type: 'toast'; message: string}
  | {type: 'navigate'; viewId: string}
```

`A2UIValue` is `string | number | boolean | null` — no nested objects.

**No fetch. No JS execution. No eval.** The renderer is a closed sandbox. If a feature needs fetch (e.g. a real to-do list with backend persistence), that's a Phase 2 capability and lives behind a different mechanism — not by extending the action set.

## Spec shape

```ts
type A2UISpec = {
  version: 1
  views: Array<{id: string; root: A2UINode}>
  initialViewId: string
  initialState?: Record<string, A2UIValue>  // optional, defaults derive from inputs
}
type A2UINode = {type: 'Heading' | 'Text' | ... ; ...props}
```

A spec **must** have `version: 1` and at least one view. The `initialViewId` must reference an existing view ID.

## Render contract

`render_hash = sha256(canonical(spec_json))`. Two clients with the same `render_hash` must produce identical UI. This is what makes the M1 acceptance "reopen → identical app" verifiable.

`canonical()` serializes:
- Object keys sorted alphabetically.
- Numbers in their shortest exact representation (no trailing zeros).
- No whitespace.

Implementation: `packages/a2ui-schema/canonical.ts`.

## Validation rules

Server validation (`services/api/src/llm/validate.ts`):
1. Zod parse — schema-level validation.
2. Reference integrity — every `targetId` in an action must reference an existing input `id` in any view.
3. View integrity — every `navigate` action's `viewId` must reference an existing view.
4. No cycles — actions cannot create cycles (a button on view A navigating to view B, view B navigating to view A is allowed; but `set(targetId, value)` cannot trigger another `set` on itself).
5. Depth limit — max nesting depth of 8. Anything deeper is almost certainly malformed LLM output.

Client validation: same Zod parse before `render()`. If validation fails, render an error placeholder, not an exception.

## Edit-by-JSON-Patch

Edits are RFC 6902 JSON Patches applied to the stored spec.

```ts
const editTool = {
  name: 'produce_app_spec_patch',
  description: 'Produce an RFC 6902 JSON Patch to apply to the current spec. Output must result in a valid A2UISpec when applied.',
  input_schema: {
    type: 'object',
    properties: {
      patch: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            op: {enum: ['add', 'remove', 'replace', 'move', 'copy', 'test']},
            path: {type: 'string'},
            value: {},  // required for add/replace
            from: {type: 'string'},  // required for move/copy
          },
          required: ['op', 'path'],
        },
      },
    },
    required: ['patch'],
  },
}
```

Server flow:
1. Receive edit prompt + current spec.
2. LLM call with `produce_app_spec_patch` tool, system prompt includes the current spec.
3. Apply patch with `fast-json-patch.applyPatch(currentSpec, patch, true, false)` (validate, no mutate).
4. Re-parse the result with the A2UI Zod schema.
5. If invalid: return a structured 400 with `{error: 'patch_invalid', detail}`. Do NOT persist.
6. If valid: write a new `project_versions` row, update `projects.current_version_id`, return the new spec.

## Prompt block — component catalog

The catalog block is sent as a `cache_control: {type: 'ephemeral'}` system block. Stable across requests, ~3K tokens. Its content lives in `services/api/src/llm/prompts/catalog.ts` and is the **only** place the LLM learns about the catalog. Do not duplicate the schema in inline messages.

## Eval harness invariants

Every prompt in `services/api/eval/prompts.ts` records:
- `id`: stable identifier
- `prompt`: the user input
- `expectations`: structured assertions (must contain a `Heading`, must have ≥1 `TextInput`, etc.) — not exact-match expected output
- `category`: form / list / calculator / info / game

Pass criteria: spec validates, all expectations satisfied, p95 latency ≤ 90s.

## Common mistakes to avoid

- **Inventing component types not in the catalog.** The LLM will sometimes try; the validator must reject the spec, the orchestrator must retry with a stronger system prompt nudge.
- **Letting the LLM output `accessibilityLabel`.** It'll be wrong. The renderer wires a11y props from the type — see ARCHITECTURE.md §6, §12.
- **Allowing free-text JSON parsing.** Tool-use is mandatory.
- **Forgetting to bump `version`** when the schema changes. Old stored specs must continue to render or be migrated explicitly.
- **Patching without re-validation.** Always re-parse the result of `applyPatch`; never trust the patch to preserve schema validity.
