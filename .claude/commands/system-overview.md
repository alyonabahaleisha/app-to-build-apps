---
description: Print a decision-record-style architectural overview of the codebase. Each section answers: what we picked, what we rejected, and the rule going forward. Use to get oriented before any non-trivial work.
argument-hint: [optional section name, e.g. "auth", "persistence", "flags", "debt"]
---

# /system-overview

Render the Bluesky Social app's architecture as a series of **Architectural Decision Records (ADRs)** — not prose. Each decision is three blocks:

1. **Decision** — what we picked (1–2 sentences, concrete).
2. **Rejected alternatives** — what we considered and didn't pick, with the one-line reason.
3. **Rule going forward** — the enforceable rule for new code. Cite the file path / layer / section where it's enforced.

This format scales: it tells a reader what the system does *and* what it explicitly rejects. Prose doesn't.

## Input

Optional argument — a section name. Topic: $ARGUMENTS

Supported shortcuts (case-insensitive substring match):

| Argument | Section |
|---|---|
| *(empty)* | Full overview, all sections below in order |
| `overview`, `diagram`, `layers` | §1 System overview |
| `auth`, `session` | §2 Authentication & session |
| `networking`, `api`, `queries`, `agent` | §3 Networking & API |
| `persistence`, `storage`, `tiers` | §4 Persistence tiers |
| `observability`, `logs`, `logger`, `errors` | §5 Observability |
| `analytics`, `events` | §6 Analytics & events |
| `flags`, `experiments`, `growthbook` | §7 Feature flags |
| `design`, `alf`, `components` | §8 Design system layering |
| `deps`, `dependencies`, `libraries` | §9 Third-party dependency policy |
| `scaling`, `promotion`, `module` | §10 Scaling rules |
| `debt`, `legacy`, `migration` | §11 Known debt |

If the argument doesn't match anything, list these topics and ask the user to pick one.

## Step 1 — Load the source of truth

Read `ARCHITECTURE.md` at the repo root. Also read `CLAUDE.md` for tactical patterns worth surfacing alongside the decisions.

If `ARCHITECTURE.md` is missing, say so and stop.

## Step 2 — Render decision records

Produce the sections below, in order (or only the matched section if an argument was given).

For each section, output in this exact shape:

```
### §N. <Section title>

**Decision.** <1–2 sentences. Concrete. Names the tool / pattern / directory.>

**Rejected alternatives.**
- <Alternative> — <one-line reason we didn't pick it>
- <Alternative> — <one-line reason>

**Rule.** <The enforceable rule for new code. Cite the file/layer/section.>
```

### Section content — source the facts from ARCHITECTURE.md, render them in ADR shape

Below is the *content each section must cover*. The reader must convert ARCHITECTURE.md's prose into the 3-block ADR form, not just quote it. If ARCHITECTURE.md is silent on the "rejected alternatives" block, infer the likely rejected alternatives from §11 (sanctioned libraries) and the §12 red-flag list — those are the rejected alternatives, named explicitly.

**§1. System overview**
- Decision: the layered stack from ARCHITECTURE.md §1 (screens → features → composed/state → primitives/agent → ALF/lib/storage).
- Rejected alternatives: flat src/ layout; strict MVC; Redux-style single store; feature-sliced design at the top level.
- Rule: dependency direction is one-way (§1). Include the ASCII diagram verbatim.

**§2. Authentication & session**
- Decision: atproto agent as the single network client, obtained via `useAgent()`. Session state (tokens, multi-account) lives entirely in `/src/state/session`.
- Rejected alternatives: per-feature auth hooks; reading tokens directly from storage; creating secondary agent instances for "just one call."
- Rule: never access tokens directly; never instantiate a second agent. Cite ARCHITECTURE.md §4 and the red flags in §12.

**§3. Networking & API**
- Decision: all server state goes through TanStack Query hooks in `/src/state/queries`. Query keys use `createQueryKey` (new code) with object params. Paginated APIs use `useInfiniteQuery`.
- Rejected alternatives: raw `fetch`; axios; `useState` holding server data; ad-hoc agent calls from components; array-literal query keys (legacy-tolerated, see §13 debt).
- Rule: if you're calling an API, you're writing a query hook in `/src/state/queries`. Cite §5.

**§4. Persistence tiers**
- Decision: six tiers — React state, TanStack Query cache, persisted query cache (`persistedVersion`), `/src/state/preferences`, `/src/state/session`, `/src/storage` (raw adapter), server (atproto records). Only `/src/storage` touches MMKV / localStorage.
- Rejected alternatives: AsyncStorage directly from components; a new state manager (Redux, Zustand, Jotai); duplicating data across tiers.
- Rule: pick the tier deliberately; document in §14 checklist. Cite §6. Render the §6 table verbatim.

**§5. Observability**
- Decision: `/src/logger` for structured logs (`logger.error('msg', {safeMessage: err})`); Sentry for crashes, wired at app init only; network errors surfaced to the user, not logged.
- Rejected alternatives: `console.*` (legacy-tolerated in `/src/view/` only); logging raw error objects; logging PII (DIDs, handles, tokens, post text); configuring Sentry in feature code.
- Rule: no `console.*` in new code. No PII. Cite §7 and §12.

**§6. Analytics & events**
- Decision: GrowthBook as provider. All events defined in `src/analytics/metrics/types.ts`. Naming convention `<Domain>:<Verb>` for new events; legacy events with `domain:subdomain:verb` are grandfathered.
- Rejected alternatives: inline event definitions; per-feature analytics providers; logging PII in event properties.
- Rule: new event → registry update in same PR. Cite §8.

**§7. Feature flags & experiments**
- Decision: GrowthBook gates, read via a hook, not from components directly. Every flag ships with a cleanup plan (owner, removal date/condition, tracking issue).
- Rejected alternatives: permanent flags without cleanup metadata; build-time flags for runtime experiments; bypassing the hook to read provider state directly.
- Rule: flag without cleanup metadata = technical debt by default. Cite §9.

**§8. Design system layering**
- Decision: ALF — tokens (`/src/alf/tokens.ts`) → atoms (`/src/alf/atoms.ts`) → primitives (`/src/components/{Button, Text, TextField, ...}`) → composed (`/src/components/{Dialog, Menu, Prompt}`) → feature components (`/src/features/*/components`) → screens (`/src/screens`).
- Rejected alternatives: inline hex colors; magic-number spacing; rebuilding a Button/Dialog per feature; one-off styled components; conditional `require()` for platform files.
- Rule: compose from the lowest layer that works. Promote only when a second consumer appears (§3 promotion rules). Cite §3 and CLAUDE.md "Styling System (ALF)".

**§9. Third-party dependency policy**
- Decision: sanctioned libraries per concern — React Navigation, TanStack Query, Lingui, date-fns, Sentry, GrowthBook, MMKV-via-`/src/storage`, atproto agent for HTTP, no form library (use TextField primitives).
- Rejected alternatives: axios/ky/got; dayjs/moment; redux/zustand/jotai; react-hook-form/formik; any second icon set.
- Rule: new dep = PR description justifies why the sanctioned library doesn't work, what alternatives were considered, and what the maintenance plan is. Cite §11. Render the §11 sanctioned-library table.

**§10. Scaling rules (when code moves between layers)**
- Decision: code starts at the lowest layer that works and gets promoted only when reuse is proven. Promotion path: `/src/screens/X/components/` → `/src/features/X/components/` → `/src/components/` (only when truly generic and feature-agnostic). A single file becomes a `/src/screens/Name/` folder when it grows past ~300 lines.
- Rejected alternatives: pre-promoting components "in case we need them"; dumping everything into `/src/components`; letting screen files balloon past 500 lines; keeping feature-specific props on promoted components.
- Rule: a component in `/src/components` must not know about posts, feeds, or profiles. Strip feature-specific props at promotion time. Cite §3 "Promotion rules."

**§11. Known debt & migration plans**
- Decision: the debt ledger in ARCHITECTURE.md §13 is the honest record. Each row has a scope, a plan, and a tracking link (or TBD).
- Rejected alternatives: hiding debt in TODO comments; silent "we'll fix it later"; big-bang rewrites.
- Rule: new code must not add to the ledger (§12 red flags apply in full). Modifying a file already in the ledger = opportunistic cleanup encouraged, not required. Render the §13 ledger table.

### Where to go next (always appended to the full overview, not shown for single-section calls)

- *Reviewing a specific change?* → `/architecture-check <description>`
- *Need a tactical pattern (Dialog, ALF, i18n, TanStack Query)?* → `CLAUDE.md`
- *Something here is wrong or missing?* → update `ARCHITECTURE.md` in a PR; this command is just a view over that file.

## Output rules

- **ADR shape is mandatory.** Every decision block has all three parts. If you can't name a rejected alternative, pull from §11 / §12 / the §13 legacy-tolerated list — silence is not an option.
- **Cite section numbers.** Every rule references the `§X` it came from so the reader can jump to the source.
- **Do not invent rules.** If something isn't in ARCHITECTURE.md, don't write a decision for it. Instead, note "not in the spec — add to ARCHITECTURE.md before enforcing."
- **Do not paraphrase quoted rules.** The exact phrasing in ARCHITECTURE.md is the contract.
- **Do not run code scans or audits.** This is a view over the spec, not a conformance check. If the user wants conformance, redirect to a system audit (currently a manual task — findings belong in §13, not a transient report).
- **Keep it scannable.** Each ADR fits in under 10 lines including the three blocks.
