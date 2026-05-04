## QA Report — Step 4 of ADR-0001
*Reviewed by Roz, 2026-05-01*

### Verdict: PASS

| Check | Status | Details |
|-------|--------|---------|
| Type Check | PASS | `pnpm typecheck` — all 4 workspaces clean (api, a2ui-schema, a2ui-renderer, mobile). |
| Lint | PASS | `pnpm lint` — eslint clean, no output. |
| Tests | PASS | 42/42 Step 4 (15 service + 11 routes + 16 specValidation across 3 suites) / 97/97 full server (matches Step 3 count of 55 + Step 4 of 42). |
| Coverage (proxy) | PASS | Every Step 4 T-ID maps to a non-tautological assertion; 071/072 correctly N/A. |
| Complexity | PASS | `projects.service.ts` 243 LOC, longest function `create` 47 LOC, nesting ≤3; `specValidation.ts` 171 LOC, longest 18 LOC; `projects.ts` (route) 163 LOC, longest handler 58 LOC, nesting ≤3; `canonical.ts` 18 LOC. All within thresholds. |
| Security | PASS | No hardcoded secrets. Zero `console.*` introduced in Step 4 source (env.ts:91 boot fail-fast remains the only allowed call site; migrate.ts:113/117 are Step 1 CLI carry-over). All response bodies key-strict via Ajv `additionalProperties: false`. Email never written to any logger field — verified by Pino-spy substring scan in T-0001-063 and T-0001-120. specJson never present in list responses (3-layer defense, see below) and never in audit logs. Drizzle parameterization upheld in projectsService (`.values({...})` + `.where(eq(...))`); zero string concatenation. 404 not 403 confirmed for cross-user reads. Token never echoed in error bodies (key-strict 400/401/404/500). |
| Steps 1-3 regression | PASS | schema 16/16, lib auth 15/15, routes auth 20/20, users.service 3/3, health 1/1 — all green. a2ui-schema package 5/5 still pass after `canonicalize`/`renderHash` re-export added to `src/index.ts`. |

### AC Coverage trace

| AC (ADR §Step 4) | Test ID | Status |
|---|---|---|
| `create` writes 1 project + 1 version in single tx | T-0001-049 | PASS — service.test.ts:69 asserts both row counts post-call + currentVersionId points at the version id |
| Title auto-derives from first Heading | T-0001-050, 051 | PASS — service.test.ts:95, 104 |
| Title whitespace-only fallback to "Untitled" | T-0001-121 | PASS — service.test.ts:216, asserts trim before fallback decision |
| Title >60 chars truncated to 60 + ellipsis (length 61) | T-0001-059 | PASS — service.test.ts:205, asserts both `length === 61` and exact prefix |
| `list` sorted by updatedAt DESC, owner-scoped | T-0001-052 | PASS — service.test.ts:113, three projects, asserts both id and title order |
| `get` returns null for non-owner | T-0001-056 (service-side sanity at :347) | PASS — also covered by route layer T-0001-056/065 |
| `GET /projects` 200 strict shape | T-0001-053 | PASS — routes.test.ts:202, Ajv `strict: true` + `additionalProperties: false` |
| `GET /projects/:id` 200 strict shape | T-0001-054 | PASS — routes.test.ts:229, same Ajv discipline |
| `GET /projects/:id` 404 not 403 for non-owner | T-0001-065 (combined with 056) | PASS — routes.test.ts:296, asserts statusCode 404 + body deep-equals `{error: 'not_found'}` + `Object.keys === ['error']` |
| List excludes specJson | T-0001-064 | PASS — routes.test.ts:436, three-layer defense (see below) |
| Concurrent create → 2 distinct projects, no FK violation | T-0001-067 | PASS — service.test.ts:276, `Promise.all` + assert distinct ids + distinct version ids + list count = 2 |
| `parentProjectId` roundtrip create→list→get | T-0001-122 | PASS — routes.test.ts:255, fork projects asserted on both detail.project AND list-item shapes |

All 8 explicit AC bullets covered; no uncovered AC. Total Step 4 T-IDs verified: 28 ADR T-IDs + 14 sanity/internal cases = 42 tests, matches `--testPathPattern` count.

### normalizeRow defense (3 layers)

| Layer | File:line | Verdict |
|---|---|---|
| Service (SELECT-explicit + type-level exclusion) | projects.service.ts:188–199 (explicit column list, no `select()` star), :55 (`Pick<Project, 'id'\|'title'\|'currentVersionId'\|'parentProjectId'>` — `specJson` cannot be in the type) | PASS |
| Route (Ajv response-shape gate) | projects.ts:75–82 (route maps service items into a fixed key set), enforced at the test boundary by routes.test.ts:75–87 (projectListItemSchema with `additionalProperties: false`) | PASS |
| Test (key-set assertion + Ajv) | routes.test.ts:454–472 (Ajv compile + `Object.keys(item).sort() === expectedKeys` allowlist + explicit `not.toHaveProperty('specJson')` and `not.toHaveProperty('ownerId')`) | PASS |

Three layers, three independent signals. A future contributor adding `specJson` to the list-item shape would have to defeat: (1) the TS Pick type, (2) the route-layer key projection, (3) the test allowlist + explicit `not.toHaveProperty` + Ajv strict-mode. Cleanest defense in the codebase to date.

### userCount / response-shape strictness

| Endpoint | T-ID | Strict-mode? | additionalProperties:false? |
|---|---|---|---|
| `GET /projects` (list) | T-0001-053, T-0001-064 | YES — `new Ajv({strict: true, allErrors: true})` at routes.test.ts:73 | YES on response root AND on list-item schema (lines 76, 91) |
| `GET /projects/:id` (detail) | T-0001-054 | YES — same Ajv instance | YES on response root, on `project` sub-schema, AND on `currentVersion` sub-schema (lines 100, 122, 136) |
| 4xx error bodies | T-0001-056, 057, 058, 065 | n/a (deep-equal) | YES — every error test asserts `Object.keys(body).sort() === ['error']` |

Adding any new field to either response without updating BOTH the schema AND the explicit key-set assertion will fail the test. Verified.

### Spot-checks (high-risk patterns)

1. **404-not-403 (T-0001-065)** — routes.test.ts:296–326. Asserts `statusCode === 404`, `body deep-equals {error: 'not_found'}`, AND `Object.keys(body).sort() === ['error']`. Body does NOT include the `:id` (no echo of the requested project id). Sanity tail at :316 also asserts a phantom UUID returns the same shape — the 404 is indistinguishable for "doesn't exist" vs "not yours". PASS.

2. **Audit log T-0001-120** — routes.test.ts:513–549. Mints unique-per-test heading text `'Audit me'` (line 518) and asserts `wholeLog.not.toContain('Audit me')` (line 544) — defends against accidental specJson serialization. Asserts the audit record contains `userId`, `projectId`, `action: 'project.read'`, `durationMs` (number, >= 0). Asserts the whole serialized log does NOT contain `email` (line 543) NOR the bearer token (line 545). PASS.

3. **Deep-validation tests:**
   - T-0001-130 — service.test.ts:151. Uses `specWithUnresolvedTargetId()` which constructs `targetId: 'nonexistent'` (factories.ts:135) and confirms zero TextInput/Toggle/Counter has that id (the only node is a Button). After throw, asserts `db.select().from(projects).length === 0` AND `db.select().from(projectVersions).length === 0`. PASS.
   - T-0001-131 — service.test.ts:170. Asserts depth=9 throws `max_depth_exceeded` AND zero rows written, THEN asserts depth=8 PASSES (ok.project.id defined). Boundary precision verified. PASS.
   - T-0001-138 — service.test.ts:190. Form.submitAction navigate to `'unknown'` viewId (factories.ts:154) — asserts ValidationError code + zero project rows. PASS.
   - All three deep-validation tests assert NO DB writes via post-throw `db.select()` count assertions (cheaper than a stack-spy mock and equally definitive — the table is truncated between tests).

4. **Transaction rollback (T-0001-062)** — service.test.ts:225–271. Uses a nested Proxy on `db.transaction` that wraps the inner `tx` so `tx.update` (NOT `db.update`) throws — correctly targets the in-transaction call site. Post-throw, asserts via raw `pool.query('SELECT COUNT(*) FROM projects')` AND `'SELECT COUNT(*) FROM project_versions'` that both counts are `'0'`. The Proxy nesting is necessary because Drizzle's `tx` is a separate object from the outer `db`. Cleanly written. PASS.

5. **Cross-user isolation (T-0001-066)** — routes.test.ts:487–506. Creates 2 projects under ownerA, calls `GET /projects` with ownerB's JWT, asserts response is exactly `{projects: []}`. PASS.

6. **parentProjectId roundtrip (T-0001-122)** — routes.test.ts:255–291. Exercises create-parent → create-child-with-parentProjectId → GET /projects/:id (detail asserts `project.parentProjectId === parent.id`) → GET /projects (asserts the child item's parentProjectId equals parent.id AND the parent item's parentProjectId is null). Both list AND detail covered. PASS.

### Scope Check

ADR §Step 4 file list: `projects.service.ts`, `projects.service.test.ts`, `routes/projects.ts`, `routes/projects.test.ts`, `lib/canonical.ts`. Actual diff:

- New: all 5 ADR files + `services/specValidation.ts` + `services/specValidation.test.ts` (the deep-validation module Cal didn't itemize but T-0001-130/131/138 imply — accepted).
- Modified: `services/api/package.json` (adds `ajv` dev-dep — justified per Cal's "use a JSON Schema validator" guidance), `services/api/src/server.ts` (registers `projectsRoutes` — required for routes to be reachable, justified), `packages/a2ui-schema/src/index.ts` (re-exports `canonicalize`/`renderHash` from package main — Colby explained CJS resolution can't honor the `./canonical` subpath under api's tsconfig; the cross-package test still passes 5/5 so no regression; justified), `services/api/test/factories.ts` (adds `specWithHeading`, `specWithoutHeading`, `specWithLongHeading`, `specWithDeepNesting`, `specWithUnresolvedTargetId`, `specWithUnresolvedViewId`, `specWithFork` — all required by Step 4 tests, justified).

No drive-by edits. Clean scope.

### Issues Found

None.

Editorial notes (non-blocking):

- `projects.service.ts:208` uses `r.currentVersionId as string` to narrow the nullable column. Colby's defense in the comment block (lines 201–204) cites T-0001-068 (concurrent list+create can't observe a half-formed row, since UPDATE happens inside the same transaction as INSERT). The argument is sound: row visibility is gated by tx commit, and `create` only commits after the UPDATE. The cast is therefore safe in normal operation. **Accept.** A defensive runtime guard (`if (r.currentVersionId === null) throw ...` like the one in `get` at line 225) would cost two lines and gain a fail-fast signal if a future contributor introduces a code path that commits a half-formed row (e.g. an admin tool that writes projects directly). Suggest for a future hardening pass; not blocking Step 4.
- `validateNavigateTargets` does not double-validate `initialViewId`. Colby cites the schema's superRefine (a2ui-schema/src/index.ts:160–169) which catches `initialViewId` not in `viewIds`. The Zod check runs before `deepValidateSpec`, so the case is covered upstream. **Accept** — duplication would add code without changing behavior. The doc-comment in specValidation.ts:9–11 explicitly notes this is intentional, which is the right move.

### Predicted Roz flags (Colby's two)

Both anticipated correctly and resolved above. Net findings: zero.

### Carry-forward

- **Round 2 N-2 — ADR §Step 6 boundary count summary off by 1.** Lines 697 (`Boundary | 4`) and 704 (`Total | 21`) STILL uncorrected after three clean QA cycles. Recount: Step 6 has 20 rows excluding N/A (Boundary = 3: T-0001-092, T-0001-125, T-0001-102). Fix to `Boundary | 3` / `Total | 20`, or add the fourth Boundary test you intended. **Cal — fourth request, MUST action before Step 6 implementation begins.** This is now a process anti-pattern; the count discrepancy will cause Roz's Step 6 verdict to fail the AC-coverage trace step until reconciled.
- **Round 2 N-1 — T-0001-073 `waitFor` slack.** Step 5 territory. Coming up next — flag for Sable/Colby when Step 5 lands.

### Roz's assessment

Four consecutive clean passes, and Step 4 is the largest server-side step. The three-layer normalizeRow defense (service-SELECT, route-projection, test-allowlist+Ajv) is exactly what the retro-lesson demands — a future contributor can't accidentally leak `specJson` into the list response without defeating three independent signals from three different files. The userCount defense via Ajv `strict: true` + `additionalProperties: false` on every response sub-schema is similarly belt-and-braces: the JSON-Schema validation runs on the live response body, not on a hand-rolled fixture, so any new top-level field shows up as a validation error rather than passing silently.

The transactional rollback test (T-0001-062) deserves specific praise: the nested Proxy correctly targets `tx.update` rather than `db.update`, and the post-throw assertion via raw `pg` `COUNT(*)` queries (rather than the Drizzle wrapper) is the right call — it bypasses any Drizzle-internal caching that could mask a leaked row. The depth-boundary test (T-0001-131) asserts BOTH `depth=9 fails` AND `depth=8 passes` in the same `it()`, which is the precision Cal asked for in test-spec review and the precision I'd have demanded.

The audit-log test (T-0001-120) uses a unique-per-test heading text (`'Audit me'`) as a canary for accidental spec serialization into the log stream — that's the assertion I'd have written. The token-substring scan and email-substring scan together cover the two PII vectors most likely to leak through Fastify's incidental req-completed logging.

Two minor editorial notes (the `currentVersionId as string` cast and the `initialViewId` double-validation question) are accepted with documented rationale; neither rises to a finding. Colby's pre-emptive flagging of both shows good QA hygiene — she anticipated my questions and addressed them in code comments.

The cross-package modification (re-exporting `canonicalize`/`renderHash` from `@app-creator/a2ui-schema`'s main entry) is the right engineering call: api's tsconfig uses CJS module resolution which doesn't honor the package's `exports` map, and the alternative (rewriting api's tsconfig to ESM) would have been a much larger surface change. The schema package's own 5/5 tests still pass, so no regression. The new re-export is documented in both `index.ts` and `lib/canonical.ts` with the reasoning preserved for the next reader.

Colby may begin Step 5 (Mobile session hook + secure-store — first mobile work). Cal — fix Step 6 totals before Step 6 lands; this is the fourth pass it has carried.

— Roz
