# ADR Index

Maintained by Ellis on every commit touching `docs/adrs/ADR-*.md`.
Cal reads this instead of scanning all ADRs for prior art.

Last updated: 2026-05-10

> Reset for the App Creator project. Prior history (syntetiq) was carried in by an earlier `.claude/` swap and is not applicable here.

## Numbered ADRs

| #    | Title                                                              | Status   | Tags                             | Summary                                                                                                                                                                                                                                                      |
| ---- | ------------------------------------------------------------------ | -------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0001 | Foundation — Auth, DB Schema, Library Shell                        | Proposed | auth, db, supabase, mobile-shell | Magic-link auth via Supabase, Drizzle + Postgres schema (7 tables), `requireAuth` middleware, mobile session hook, Sign-In + Home screens.                                                                                                                   |
| 0003 | A2UI Renderer — Full Catalog, Action Dispatcher, View State Engine | Proposed | a2ui, mobile-shell               | Complete A2UI renderer in `packages/a2ui-renderer/`: all 10 catalog components, all 5 action types, multi-view navigation, `useA2UIState` hook, `RendererThemeProvider`, `RendererLoggerProvider`, `RenderErrorBoundary` in AppRunner host.                  |
| 0004 | Plan → Build Generation Pipeline                                   | Accepted (superseded in part by 0005/0007) | llm, a2ui, tests                 | Two-stage generation: Haiku 4.5 planner (archetype + screens + nav) feeds Sonnet 4.6 builder (A2UI spec or RFC 6902 patch). Plan persisted as `plan_json` on `project_versions`. M1 single-call path preserved as fallback. Feature-flagged percent rollout. **Note:** Canvas V0 §0 = Supersede (Sponsor 2026-05-07). Planner stage and `/edit` route retired by ADR-0007; telemetry whitelist (Step 8) and eval-mode short-circuit (Step 9) carry forward. `plan_json` column kept for legacy alpha reads only. |
| 0005 | Canvas V0 — Protocol & Design System                               | **Accepted** | protocol, design-system, schema, tests | Two new packages: `packages/protocol/` (Zod schema, cross-ref validator, codegen targets — single source of truth for V0's 28-component / 12-verb / 4-archetype contract) and `packages/design-system/` (token resolutions across 2 stances × 6 palettes, 80-icon Lucide catalog, deterministic cover-art SVG generation). 10 implementation steps, 1054 tests passing across the protocol + design-system packages. Committed at 51de20a + 084afe5 + b25f843. Foundation for ADR-0006 (renderer), ADR-0007 (generation), ADR-0008 (Universal Links). |
| 0006 | Canvas V0 — Renderer                                                | **Accepted** | renderer, mobile-shell, design-system, tests | Wholesale rewrite of `packages/a2ui-renderer/` against the V0 schema. 28 components + 12-verb dispatcher (middleware-composed) + slot/collection state model + `Binding<T>` resolution + 4 internal nav patterns + Apple Foundation Models AI bridge. M1 sources deleted in Step 13. **Implemented:** 13 steps, 1632 tests, 10 commits (`888dc81` → `2c93759`). Milestones A + B reached on iOS Simulator. |
| 0007 | LLM Generation Pipeline Cutover to V0                              | Proposed (PRs 1+2 implemented) | llm, prompts, generation, v0, tests | Single-call Sonnet pipeline replacing ADR-0004 two-stage. `tool_choice: 'auto'` over 2 tools (`produce_app_spec` + `out_of_scope`) — documented deviation for V0.5 capability detection. Edit pipeline deleted; re-prompt-to-edit hits `/generate`. Deletes planner, pipeline.ts, edit route. New `out_of_scope_intent` table + endpoint. Telemetry whitelist + EVAL_MODE rename. 7 steps, 247 tests across 4 PRs. PR 1 (Steps 1+2+5) committed `ae4ad05`; PR 2 (Steps 3+4) committed `af81abc`. PRs 3-4 in flight. |
| 0009 | Canvas V1 — Catalog Expansion Phase 1                               | Proposed | protocol, design-system, renderer, schema, tests, v1 | Adds 25 new components across the existing 7 V0 tiers. NodeRenderer 28→53 arms; snapshot matrix 56→106. 18 new icons (catalog 80→98). New `CurrencySchema` (7-value closed enum). New `tintColor()` helper. New `SearchFilterContext` renderer architectural surface. 5 new cross-ref validator codes (ValidationErrorCode 12→17); ValidatorResult shape extends with always-present `warnings: []`. 2 new prod deps: `expo-document-picker`, `date-fns`. 10 implementation steps, 247 tests across 5 PRs. **Phase 2 (Charts) and Phase 3 (Compound-AI) deferred to subsequent ADRs.** |

## Tag vocabulary

- `auth` — authentication / session
- `db` — Drizzle, Postgres, schema, migrations
- `supabase` — Supabase-specific (auth, RLS, vector)
- `llm` — Anthropic, prompts, tool use, eval harness
- `a2ui` — schema, renderer, component catalog (legacy M1/M2)
- `protocol` — Canvas V0 schema, validator, codegen (`packages/protocol/`)
- `design-system` — Canvas V0 tokens, theme, icons, cover art (`packages/design-system/`)
- `schema` — Zod schemas (any package)
- `mobile-shell` — RN screens, navigation, theming, app-shell components
- `infra` — env, secrets, EAS, TestFlight, observability
- `tests` — testing strategy / test harness
- `prompts` — system prompts, tool definitions, prompt-engineering
- `generation` — LLM call paths, builder/route surfaces
- `v0` — Canvas V0 milestone (28-component catalog, single-call pipeline)
- `v1` — Canvas V1+ catalog expansion (53-component Phase 1, future phases)
