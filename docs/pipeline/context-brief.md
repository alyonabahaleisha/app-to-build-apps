# Context Brief — App Creation POC

User-stated preferences and mid-flight corrections collected during this pipeline run.
Read before every subagent invocation. Reset at the start of each new feature pipeline.

## Persona

- **Idea-maker** (personal individual). Small-business is Phase 2.
- Pain: gap between "I have an app idea" and "I can show it to someone."

## Scope decisions

- POC includes: auth (magic-link), chat → render, persistence (Supabase), full 10-component renderer, TestFlight ship.
- Phase 2 (still M1): memory layer, edit-by-chat, streaming.
- Phase 3+: marketplace, payments, Android/web.

## Stack confirmations

- Anthropic API (key already in `services/api/.env`).
- Supabase (Postgres + pgvector + magic-link auth).
- Expo RN + EAS Build (managed workflow, dev-client required — Expo Go does not work).
- pnpm monorepo, but Roz/Eva/Colby use `npm run *` (works via package.json scripts).
- iOS only at M1.

## User preferences

- Fast-paced — short answers ("go", "continue"). Match the tempo, don't over-explain.
- Direct. Doesn't want narrative summaries; wants tables and bullets.
- Has redacted-and-rotated a leaked API key already — sensitive to credential handling.

## Architectural anchors

- ARCHITECTURE.md and CLAUDE.md still live at the repo root from a prior workflow. Not auto-read by the new agent set, but contain real M1 design decisions (A2UI catalog, persistence tiers, LLM rules). Treat as side-context.
- Bootstrap commit at `fe4bc9e` on branch `agent/M1-VS-01`. Tooling green: typecheck, lint, test all pass.

## Open questions / unresolved

- Apple Developer enrollment not started (1-2 day verification expected).
- Bundle ID + ASC App ID not chosen.
- Supabase project not created.
- 30 eval prompts not written.

## Corrections so far

(none yet)
