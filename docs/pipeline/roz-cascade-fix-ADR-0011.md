# QA Report — Stranded ADR-0011 Phase 1 PR 1 Cascade Fixes

_Reviewed by Roz — 2026-05-10_

## Verdict: REVISE

| Check | Status |
|---|---|
| Type Check | PASS |
| Tests | CONDITIONAL PASS (494 passed, 272 Docker-gated failures pre-existing; no new test regressions) |
| Complexity | PASS |
| DB Migrations | REVISE (0008 missing down-migration comment) |
| Security | PASS |
| Dependencies | PASS |

## BLOCKING — FINDING 1: `generate.ts:267` renames external API wire field

In `0e2cc70`, the `done` event SSE payload was:
```ts
miniApp: { ..., parent_project_id: detail.project.parentProjectId, ... }
```

Stranded change renamed to:
```ts
miniApp: { ..., parent_mini_app_id: detail.miniApp.parentMiniAppId, ... }
```

**This is a breaking wire-protocol change** that mobile clients (which read `parent_project_id`) will fail on. ADR-0011 explicitly defers wire-format changes to Step 4 (mobile state-queries rename). The comment at `marketplace.service.ts:30` documents this convention: "the field name change is deferred until the mobile state-queries rename in Step 4."

**Resolution:** Revert line 267 from `parent_mini_app_id` → `parent_project_id` on the JSON key. The internal Drizzle property `parentMiniAppId` is correct (post-rename); only the wire field stays old until Step 4.

This bug passes typecheck, passes lint, passes all non-Docker tests. The test that would catch it (T-0007-082) requires Docker. Not a coincidence.

## REQUIRED — FINDING 2: Migration 0008 missing down-migration comment

`0008_out_of_scope_notify_opt_in.sql` is 9 lines, no down-migration comment. Project convention from `0007_mini_app_rename.sql` (line 87) requires:

```sql
-- Down-migration (NOT auto-executed; documented for Eva/Ellis if rollback needed)
--
-- ALTER TABLE out_of_scope_intent DROP COLUMN IF EXISTS notify_opt_in;
```

Without this, Ellis has no documented rollback path. Per T-0011-020a.

## NOTE — FINDING 3: marketplace.service.ts correctly preserves `parent_project_id`

Lines 135, 146, 265, 326, 353, 370. `PublishResult.project.parent_project_id` retained intentionally per Phase 1 deferral. Service comment at line 30 explains. **Not a finding** — confirms the convention Colby followed for marketplace but BROKE for generate.

## NOTE — FINDING 4: Stale JSDoc in library.service.ts:195-198

JSDoc block references `project_versions`, `projects`, `parent_project_id`. Actual SQL below correctly uses new names. Cosmetic; clean up in this fix.

## Acceptance Criteria Audit

1. Raw SQL `projects` → `mini_apps` — PASS (library + marketplace)
2. `parent_project_id` FK → `parent_mini_app_id` in raw SQL JOIN conditions — PASS
3. `deleted_at IS NULL` filters added — PASS (library.service.ts:228, :256, :338)
4. Test factories — PASS (`miniAppRow` + deprecated `projectRow` shim)
5. `server.ts` route registration — PASS (`projectsRoutes` → `miniAppsRoutes`)
6. `generate.ts` `parent_project_id` — **FAIL** (line 267 wire rename — see Finding 1)

## 0008 Migration Scrutiny

- Idempotent `ADD COLUMN IF NOT EXISTS` — PASS
- Default `false` (opt-out) — PASS, matches Cal intent
- `out_of_scope_intent` table presence (was NOT renamed in 0007) — PASS
- `notifyOptIn` column in Drizzle schema — PASS (`schema.ts:242`)
- Down-migration comment — **MISSING** (Finding 2)
- Sequencing 0007 → 0008 → 0009 — PASS

## Roz's Assessment

Cascade fix is 90% correct. Raw SQL renames, `deleted_at` filters, test factory update, server route registration — all exactly right. The blocking issue is one line: `generate.ts:267`. The internal Drizzle property was correctly updated but the JSON wire key was also renamed, which contradicts the explicit Phase 1 deferral pattern Colby followed elsewhere in marketplace.service.ts.

Migration 0008 is valid and safe to ship. Needs the down-migration comment per project convention.

Two surgical fixes → ready to commit.
