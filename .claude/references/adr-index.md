# ADR Index

Maintained by Ellis on every commit touching `docs/adrs/ADR-*.md`.
Cal reads this instead of scanning all ADRs for prior art.

Last updated: 2026-05-05

> Reset for the App Creator project. Prior history (syntetiq) was carried in by an earlier `.claude/` swap and is not applicable here.

## Numbered ADRs

| #    | Title                                                              | Status   | Tags                             | Summary                                                                                                                                                                                                                                                      |
| ---- | ------------------------------------------------------------------ | -------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0001 | Foundation — Auth, DB Schema, Library Shell                        | Proposed | auth, db, supabase, mobile-shell | Magic-link auth via Supabase, Drizzle + Postgres schema (7 tables), `requireAuth` middleware, mobile session hook, Sign-In + Home screens.                                                                                                                   |
| 0003 | A2UI Renderer — Full Catalog, Action Dispatcher, View State Engine | Proposed | a2ui, mobile-shell               | Complete A2UI renderer in `packages/a2ui-renderer/`: all 10 catalog components, all 5 action types, multi-view navigation, `useA2UIState` hook, `RendererThemeProvider`, `RendererLoggerProvider`, `RenderErrorBoundary` in AppRunner host.                  |
| 0004 | Plan → Build Generation Pipeline                                   | Accepted | llm, a2ui, tests                 | Two-stage generation: Haiku 4.5 planner (archetype + screens + nav) feeds Sonnet 4.6 builder (A2UI spec or RFC 6902 patch). Plan persisted as `plan_json` on `project_versions`. M1 single-call path preserved as fallback. Feature-flagged percent rollout. |

## Tag vocabulary

- `auth` — authentication / session
- `db` — Drizzle, Postgres, schema, migrations
- `supabase` — Supabase-specific (auth, RLS, vector)
- `llm` — Anthropic, prompts, tool use, eval harness
- `a2ui` — schema, renderer, component catalog
- `mobile-shell` — RN screens, navigation, theming, app-shell components
- `infra` — env, secrets, EAS, TestFlight, observability
- `tests` — testing strategy / test harness
