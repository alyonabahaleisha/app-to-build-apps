# ARCHITECTURE.md — App Creator MVP

> Source-of-truth architectural spec. Each section follows a **Decision /
> Rejected / Rule** shape. The rule is what new code must follow; violations
> are debt (see §17).
>
> Generated: 2026-05-01 — **inferred from the product spec, not yet from
> code**, because the project is pre-bootstrap. Refresh with
> `/architecture-discover refresh` after the first vertical slice lands and
> on every major refactor thereafter.
>
> Scope of this document: Milestone 1 (the App Creation Technology POC).
> Marketplace, payments, share URLs, Android, and web are out of scope at
> this revision and will be added in subsequent refreshes.

---

## 0. Stack signature

- **Mobile**: React Native 0.76+ on Expo SDK 52+ (managed workflow). TypeScript strict.
- **Build**: EAS Build (cloud) for iOS; local dev via Expo Go is **not** supported because we use custom native modules (sentry, mmkv). Use EAS dev-client.
- **Backend**: Single Node 20+ service, Fastify + TypeScript, deployed as one container.
- **Database**: PostgreSQL 16 with `pgvector` extension. Hosting TBD (Supabase, Neon, or Fly Postgres) — pick at bootstrap.
- **LLM**: Anthropic API via `@anthropic-ai/sdk`. Default model `claude-sonnet-4-6` for generation, `claude-haiku-4-5-20251001` for cheap classification. Prompt caching is mandatory (see §4).
- **Targets**: iOS only at M1 (TestFlight internal testing). Android and Web join in M2+.
- **Entry**: `App.tsx` → React Navigation root. No Expo Router.
- **Package manager**: `pnpm` (mobile and backend share a workspace at the repo root).

**Repo layout (target):**
```
app-creator/
├── apps/
│   └── mobile/              # Expo RN app
├── services/
│   └── api/                 # Fastify backend
├── packages/
│   ├── a2ui-schema/         # Shared spec types + Zod schema
│   └── a2ui-renderer/       # RN renderer (consumed only by mobile)
├── ARCHITECTURE.md
├── CLAUDE.md
└── pnpm-workspace.yaml
```

Open question (decide at bootstrap): pnpm monorepo vs. two separate repos. **Default rule**: monorepo, because the A2UI schema must be a single source of truth shared between server (validates output) and client (validates before render).

---

## 1. Layering & directory structure

**Decision.** Layered split per app.

### `apps/mobile/src/`
| Layer | Folder | Owns |
|---|---|---|
| Design tokens | `theme/` | Tokens, light/dark themes, spacing/typography scales. |
| Primitives | `components/` | Reusable RN UI: Button, TextInput, Card, ListItem, Sheet. |
| Features | `features/<name>/` | Cohesive cross-screen modules: `chat`, `library`, `appRunner`, `auth`. |
| Screens | `screens/<Name>/index.tsx` | Route-level components. |
| State | `state/queries/`, `state/session/`, `state/persisted/` | TanStack Query hooks, session, persisted store. |
| Lib | `lib/` | Utilities, API client wrapper, constants, route types. |

### `services/api/src/`
| Layer | Folder | Owns |
|---|---|---|
| Routes | `routes/` | Fastify route handlers — thin, validate, call services. |
| Services | `services/` | Business logic: generation, memory, projects, edit. |
| LLM | `llm/` | Anthropic client wrapper, prompts, tool schemas. |
| DB | `db/` | Drizzle ORM client, migrations, repositories. |
| Lib | `lib/` | Logger, error helpers, env. |

**Dependency direction.** `screens → state hooks → components → theme`. Features may own their own state and components but consume `theme/components`. Components never import from screens. Backend: `routes → services → (llm | db)`. Services never import from routes.

**Rejected.** Flat `src/` layout; domain-first top-level folders (`src/projects/`, `src/chat/` as siblings of `lib/`); a barrel `src/index.ts` re-exporting everything; placing renderer code inside `apps/mobile/` (it must live in `packages/a2ui-renderer/`).

**Rule.**
- New screens land in `apps/mobile/src/screens/<Name>/index.tsx` with sibling `components/` when screen-specific.
- New primitives land in `apps/mobile/src/components/<Name>/`.
- New features land in `apps/mobile/src/features/<name>/`.
- Server routes are thin: parse + validate body → delegate to a service → return. No DB calls in routes.
- Renderer code lives only in `packages/a2ui-renderer/`.

---

## 2. Navigation

**Decision.** React Navigation v7 — `@react-navigation/native`, `native-stack`. Single-stack at M1.

- Navigator setup: `apps/mobile/src/Navigation.tsx`.
- Route type registry: `apps/mobile/src/lib/routes/types.ts` (`RootStackParamList`).
- Screens: `Home` (project library + new-app entry), `Chat` (conversational creation/edit), `AppRunner` (renders a stored A2UI app), `Settings`.
- Deep links not needed at M1 (no share URL).

**Rejected.** Expo Router; tab navigator at M1 (premature for 4 screens); nested stacks.

**Rule.**
- Add the route to `RootStackParamList` first.
- Always type screen props with `NativeStackScreenProps<RootStackParamList, 'Name'>`.
- Use the exported `navigate()` helper from `#/Navigation` for programmatic nav.
- New routes require an entry in `RootStackParamList`, the `Navigation.tsx` switch, and a screen component — no exceptions.

---

## 3. Authentication & session

**Decision.** Email magic-link auth via Supabase Auth at M1 (decision deferred at bootstrap if a different provider is chosen — see §17).

- Single user session at a time. Multi-account is out of scope at M1.
- Session module: `apps/mobile/src/state/session/index.tsx` (React context).
- Tokens persisted via `expo-secure-store` (NOT AsyncStorage — tokens are sensitive).
- Server validates the JWT on every authenticated request; no anonymous mode at M1.
- Access in components: `useSession()` hook.

**Rejected.** Apple/Google sign-in at M1 (deferred to M2 — adds App Store review complexity); password-based auth (defeats the point of magic-link); raw AsyncStorage for tokens; multiple HTTP clients.

**Rule.**
- Never read tokens directly from secure storage in components — use the agent.
- Gate authenticated UI on `useSession().hasSession`.
- Server routes that require auth use a `requireAuth` Fastify hook that 401s on missing/invalid JWT. Never inline auth checks.

---

## 4. Networking & server state

**Decision.** TanStack Query v5 as the canonical server-state layer. Plain `fetch` wrapped in a tiny `apiClient` helper for the actual transport.

- Query keys: `apps/mobile/src/state/queries/util.ts::createQueryKey(root, args, options?)`.
- Error handling:
  - Network errors → silent log + toast (`isNetworkError` helper).
  - 4xx/5xx with typed body → narrow handling per route.
  - Unknown → `logger.error('...', {safeMessage: error})`.
  - Mutations: optimistic where possible, rollback in `onError` from context snapshot, then `invalidateQueries`.
- LLM streaming: server → client via Server-Sent Events (SSE) over POST. Client uses `eventsource-parser` against a `fetch` ReadableStream — no third-party SSE lib at M1.

**Server-side LLM rules.**
- All Anthropic calls go through `services/api/src/llm/anthropic.ts`. No call site instantiates the SDK directly.
- **Prompt caching is mandatory** for the system prompt and the component-catalog block — these are stable across requests. Use `cache_control: {type: 'ephemeral'}` markers per the `claude-api` skill.
- Generation uses **structured tool-use**: the model must emit the spec via a `produce_app_spec` tool whose `input_schema` is the Zod-derived JSON schema. Free-text JSON is forbidden.
- Edit-by-chat uses a `produce_app_spec_patch` tool that emits an RFC 6902 JSON Patch; server applies the patch to the stored spec and re-validates.
- Token budget per generation: hard cap 8k output, 12k input including system. Refuse the request rather than truncate.

**Rejected.** Apollo, urql, SWR, axios; raw fetch in components; LLM SDK calls outside `services/api/src/llm/`; streaming free-text JSON and parsing it ourselves.

**Rule.**
- Co-locate query + mutation hooks per domain in `apps/mobile/src/state/queries/<domain>.ts`.
- Hook naming: `use<Name>Query`, `use<Name>Mutation`, `use<Name>InfiniteQuery`.
- Export a `createXxxQueryKey({...})` factory; never inline array-literal keys.
- Always log errors with `logger.error` and include a `safeMessage`.
- Use `STALE.*` constants from `apps/mobile/src/state/queries/index.ts` — don't hardcode ms.
- Server LLM calls always pass `metadata.user_id` (hashed) for Anthropic-side rate limiting and abuse signals.

---

## 5. Persistence tiers

**Decision.** Five tiers, each with a clear owner.

| # | Tier | Location | Backing | Contents |
|---|---|---|---|---|
| 1 | Auth tokens | `apps/mobile/src/state/persisted/secure.ts` | `expo-secure-store` | Access/refresh JWT only. |
| 2 | Device state | `apps/mobile/src/state/persisted/device.ts` | MMKV (`appcreator_device`) | Device ID, theme toggle, last opened project ID. |
| 3 | User state | `apps/mobile/src/state/persisted/user.ts` | MMKV scoped by user ID | Recent prompts, draft messages, NUX flags. |
| 4 | Query cache | TanStack Query | In-memory (no persist at M1) | Server state cache. |
| 5 | Server data | Postgres via Drizzle | Disk | Users, Projects, ProjectVersions, Messages, Facts, Embeddings, Events. |

**Rejected.** AsyncStorage (replaced by MMKV for non-secret data, secure-store for secrets); SQLite on device (no offline editing at M1); persisting the TanStack cache (M1 doesn't need offline read of server data).

**Rule.**
- Never write tokens to MMKV or AsyncStorage. Only secure-store.
- Never write user-scoped data to the device tier; scope by user ID.
- Schema changes to MMKV-backed state require a `version` bump and a migration in `state/persisted/migrations.ts`.
- All Postgres writes go through Drizzle; no raw SQL in route handlers.

### Server data model (M1)

```
users(id, email, created_at)
projects(id, owner_id, title, current_version_id, parent_project_id, created_at, updated_at)
project_versions(id, project_id, spec_json, render_hash, created_by_message_id, created_at)
messages(id, project_id, role, content, tool_calls_json, created_at)
facts(id, user_id, key, value, source_message_id, created_at)
memory_embeddings(id, user_id, chunk, embedding vector(1536), source_id, created_at)
events(id, user_id, type, payload_json, created_at)
```

`render_hash = sha256(canonical(spec_json))`. Two clients rendering the same `render_hash` must produce identical UI — this is the contract that lets us assert "reopen → identical app" (M1 acceptance).

---

## 6. Component / design system

**Decision.** Two distinct component layers — do not conflate them.

1. **App-shell components** (`apps/mobile/src/components/`): used to build the App Creator itself (chat bubble, library card, settings row). Standard RN + our theme tokens.
2. **A2UI catalog** (`packages/a2ui-renderer/components/`): the **fixed set of 10 components** the LLM is allowed to assemble into a generated app. This is the surface area the user-described apps render through.

### A2UI catalog (locked at M1)

| Type | Purpose | Required props | Optional props |
|---|---|---|---|
| `Heading` | Title text | `text` | `level: 1\|2\|3` |
| `Text` | Body text | `text` | `weight, color` |
| `Image` | Static image | `src` | `aspectRatio, alt` |
| `Button` | Tap target | `label, action` | `variant: primary\|secondary\|destructive` |
| `TextInput` | Single-line input | `id, label` | `placeholder, multiline` |
| `Toggle` | Boolean | `id, label` | `defaultValue` |
| `Counter` | Integer +/- | `id, label` | `min, max, step` |
| `List` | Vertical collection | `items: A2UINode[]` | `separator: bool` |
| `Form` | Group of inputs | `id, fields: A2UINode[]` | `submitLabel, submitAction` |
| `Container` | Layout box | `direction: row\|column, children: A2UINode[]` | `padding, gap, align, justify` |

**Actions** (the closure of what `Button.action` and `Form.submitAction` can do at M1):
- `set(targetId, value)` — write a state value.
- `increment(targetId, by)` / `decrement(targetId, by)` — for Counter.
- `toast(message)` — show a toast.
- `navigate(viewId)` — within a multi-view spec.

No JS execution, no eval, no fetch. The renderer is a closed sandbox.

**Rejected.** A larger catalog at M1 (10 covers ~80% of test prompts; expand only when an eval prompt fails for catalog reasons); free-form JSX from the LLM (impossible to sandbox); per-component styling overrides at M1 (forces theme conformance).

**Rule.**
- Adding a component type to the catalog requires: (a) Zod schema entry in `packages/a2ui-schema`, (b) renderer implementation in `packages/a2ui-renderer/components/<Type>.tsx`, (c) catalog entry in the system prompt at `services/api/src/llm/prompts/catalog.ts`, (d) at least 3 eval prompts that exercise it, (e) entry in this section. All five together or not at all.
- A2UI components must be pure functions of `{node, state, dispatch}`. No side effects, no refs to anything outside the spec.
- App-shell components and A2UI components never share files. They live in disjoint packages.

---

## 7. Client state (non-server)

**Decision.** React Context + hooks for cross-screen state. No Redux, no Zustand, no Jotai at M1.

- Session: `state/session/`.
- Theme: `state/theme/`.
- Toast queue: `state/toast/`.
- Generation streaming buffer: feature-local in `features/chat/state/`.

**Rejected.** Global stores; prop drilling for session/theme/toast; storing LLM streaming chunks at the app root (lives with the chat feature).

**Rule.** Cross-screen state goes in `state/<domain>/`. Feature-local state stays inside the feature. Don't promote feature state to global until two features need it.

---

## 8. Observability

**Decision.** Structured logging on both client and server. Sentry for crashes, Langfuse for LLM traces, OpenTelemetry for HTTP spans.

- Client logger: `apps/mobile/src/logger/index.ts` — wraps `console.*` with structured fields, ships to Sentry on `error`/`fatal`.
- Server logger: Pino (`services/api/src/lib/logger.ts`) — JSON to stdout, OTel-correlated.
- Every LLM call is wrapped with Langfuse `trace`/`generation` and tagged with `user_id_hash`, `project_id`, `phase: generate|edit|memory`.
- Trace IDs propagate from client → server via `traceparent` header.

**PII rules (mandatory).**
- Never log raw email, full message content, or generated app source IP.
- Always log via `safeMessage(error)` — strips stack-internal paths and known PII patterns.
- The user-prompt text sent to Anthropic is **not logged at the application layer** — Langfuse stores it (intentional, for eval), but our app DB does not duplicate.

**Rejected.** `console.log` in production code; logging full prompts to stdout; logging tokens/JWTs anywhere.

**Rule.**
- No `console.*` in `apps/mobile/src/` or `services/api/src/` outside the logger module. ESLint enforces.
- Every server error logged via `logger.error('msg', {safeMessage, traceId})`.
- LLM calls without a Langfuse trace wrapper are forbidden.

---

## 9. Analytics & events

**Decision.** Server-side event emission only at M1. Client posts intents to `POST /events`; server stores them in the `events` table and forwards selected events to PostHog.

- Event schema: `packages/a2ui-schema/events.ts` — every event has `type`, `user_id`, `payload`.
- Funnel events at M1: `app_install`, `auth_signup`, `prompt_submitted`, `generation_started`, `generation_succeeded`, `generation_failed`, `app_opened`, `app_edited`, `project_deleted`.
- Generation success rate is computed as `succeeded / (succeeded + failed)` over a rolling 7-day window. This is the M1 acceptance metric (≥85%).

**Rejected.** Direct client → PostHog (adds an SDK and a network dependency we can drop); event tracking via free-text strings.

**Rule.**
- Adding an event requires updating `events.ts`, the server forwarder, and one consumer (PostHog dashboard or eval harness).
- Events must not contain PII. Use `user_id` (UUID), never email.

---

## 10. Feature flags & experiments

**Decision.** Server-driven feature flags via a `feature_flags` table read at session-start and refreshed every 60 s.

- Flag access in client: `useFlag('flag_name')` hook.
- Flag access in server: `flags.get(userId, name)`.
- All new generation-pipeline changes that affect output ship behind a flag, default OFF, with a paired metric in §9.
- Flag rollout sequence: internal team → 10% → 50% → 100%. Each step requires the prior step's metrics to hold for 24h.

**Rejected.** Client-side hardcoded flags; LaunchDarkly / GrowthBook at M1 (overhead not justified); flag fan-out in route handlers (gate at the service boundary).

**Rule.** Generation-pipeline changes ship behind a flag. UI-only changes do not require a flag.

---

## 11. Internationalization

**Decision.** **English only at M1.** No i18n framework wired in. Strings live as plain literals in components.

- This is a deliberate scope cut for M1 — see the program spec.
- M2 will introduce `lingui` and a string catalog. Components written at M1 must be **structurally** ready: every user-facing string is a single literal, never concatenated, so a future codemod can wrap them.

**Rejected.** Lingui at M1 (premature when the app is en-only); inlining strings into JSX expressions that mix variables and copy.

**Rule.**
- All user-facing copy is a single string literal in one place — no `'Hello, ' + name`.
- No nested ternaries that produce different copy variants. Use early returns.

---

## 12. Accessibility

**Decision.** Mandatory at M1. Failing accessibility is a release blocker, not a follow-up.

- **App-shell** components must declare `accessibilityLabel` and `accessibilityRole` on every interactive element.
- **A2UI components** auto-generate accessibility props from the spec — this is the renderer's responsibility, not the LLM's. The LLM does not output accessibility props; it outputs the semantic component (`Button`, `TextInput`) and the renderer wires the platform a11y props from the type.
- Theme: light + dark, both must pass WCAG AA contrast (4.5:1 body, 3:1 large text).
- Hit targets ≥ 44×44 pt.
- Reduced-motion respected: animations have a static fallback when `accessibilityReduceMotion` is set.

**Rejected.** Accessibility props in the LLM output (it'll get them wrong; the renderer knows the right ones); skipping a11y on dev-internal screens (the "internal" / "public" line drifts).

**Rule.**
- Every interactive shell component takes a required `accessibilityLabel` prop.
- Every A2UI Button/TextInput/Toggle/Counter renderer adds `accessibilityRole` automatically.
- New components require a snapshot test of their a11y props.

---

## 13. Native & platform code

**Decision.** iOS-only at M1. Single codebase; platform-specific files allowed where iOS-only behavior diverges from web/Android (relevant in M2).

- Custom native modules at M1: `expo-secure-store`, `react-native-mmkv`, `@sentry/react-native`. All available as Expo prebuild targets — no manual native code edits required.
- iOS bundle ID: TBD at bootstrap (recommended: `com.<org>.appcreator`).
- Minimum iOS version: 16.0 (covers ~95% of devices, lets us drop legacy code paths).

**Rejected.** Bare RN workflow at M1; targeting iOS 14/15 (drags in branching for marginal user share).

**Rule.**
- Any new native module requires (a) a §14 sanctioned-deps entry, (b) confirmation of Expo config-plugin availability (no manual `Podfile` edits), (c) a successful EAS dev-client build before merge.
- Platform branching uses `Platform.OS === 'ios'` checks; do not author `.android.tsx` / `.web.tsx` files at M1 (no sibling platform exists yet).

---

## 14. Third-party dependencies (sanctioned by category)

**Mobile (`apps/mobile/`):**
- React Native: `react`, `react-native`, `expo`, `expo-secure-store`, `expo-haptics`.
- Navigation: `@react-navigation/native`, `@react-navigation/native-stack`, `react-native-safe-area-context`, `react-native-screens`.
- State: `@tanstack/react-query`, `react-native-mmkv`.
- Networking/streaming: `eventsource-parser`.
- UI: nothing except RN core + our renderer. **No** UI kits (no NativeBase, no Tamagui, no Gluestack at M1).
- Telemetry: `@sentry/react-native`.

**Backend (`services/api/`):**
- HTTP: `fastify`, `@fastify/cors`, `@fastify/helmet`, `@fastify/jwt`.
- LLM: `@anthropic-ai/sdk`, `langfuse`.
- DB: `drizzle-orm`, `drizzle-kit`, `pg`, `pgvector`.
- Auth: `@supabase/supabase-js` (or chosen provider's SDK).
- Telemetry: `@opentelemetry/sdk-node`, `pino`, `pino-pretty` (dev only).

**Shared (`packages/`):**
- `zod` (schema), `nanoid` (IDs).

**Rejected.** Any package not listed above without an ADR justifying the addition (per §17 red flags).

**Rule.**
- Adding a runtime dep requires an ADR entry at minimum: what it does, what it replaces, why a smaller alternative or hand-rolled code won't do.
- Dev-only deps (eslint plugins, type definitions) don't require an ADR but go through normal review.

---

## 15. Testing

**Decision.** Three tiers.

| Tier | Tool | Scope |
|---|---|---|
| Unit | Jest | Pure functions, hooks, the A2UI renderer (snapshot per component type). Server services. |
| Integration | Jest + supertest | API routes hitting a test Postgres (Docker). |
| Eval | Custom harness in `services/api/eval/` | 30-prompt set; runs end-to-end generation and scores success. |

- Co-location: tests live next to the file they test, named `<file>.test.ts(x)`.
- Detox (E2E) deferred to M2 — too heavy for the POC payoff.
- Eval harness is the M1 gate: 30 prompts, ≥80% pass for POC, ≥85% for launch (per program spec).

**Rejected.** Mocha, Vitest (project-wide consistency wins; Jest works for both apps and services); separate `__tests__/` folder convention; Detox at M1.

**Rule.**
- Every step in `plan.json` produces at least one test before implementation (TDD).
- Renderer changes always ship with a snapshot test per affected component type.
- Eval harness runs in CI on every PR that touches `services/api/src/llm/` or `packages/a2ui-schema/`.

---

## 16. Build, release, env

**Decision.**
- **Mobile**: EAS Build profiles `development` (dev-client), `preview` (internal sharing), `production` (TestFlight / App Store). EAS Submit for App Store Connect upload.
- **Backend**: single Docker image, pushed to a container registry, deployed to chosen host (Fly.io / Render / Cloud Run — pick at bootstrap).
- **Environments**: `development` (local), `staging` (TestFlight internal + staging Postgres), `production` (App Store + production Postgres). No "test" env.
- **Secrets**: Mobile via EAS Secrets, backend via host env, **never** in repo. `.env.example` lists keys without values.

**Release sequence to TestFlight:**
1. Bump version in `app.config.ts` (semver) and `buildNumber` (monotonic int).
2. `eas build --platform ios --profile production`.
3. `eas submit --platform ios --latest` → uploads to App Store Connect.
4. App Store Connect processes the binary (~15 min) → available to internal testers automatically (no Apple review for internal group).

**Rejected.** Local Xcode archive uploads (developer-keychain hell, not reproducible); Fastlane (EAS does the same job for our scale); promoting builds across environments (rebuild per env to keep secrets clean).

**Rule.**
- No code change ships to TestFlight without a passing CI run (lint, typecheck, unit, eval).
- `buildNumber` is monotonic and never reused, even for failed uploads.
- Secrets are added via `eas secret:create` or the host's secret manager — never committed.

---

## 17. Known debt

These are the open architectural questions / acknowledged compromises at this revision. Each entry is a future ADR or a follow-up `architecture-discover refresh` trigger.

| ID | Area | Debt | Trigger to address |
|---|---|---|---|
| D1 | §3 | Auth provider not chosen (Supabase vs. self-hosted vs. Clerk). | Bootstrap decision. |
| D2 | §0 | DB host not chosen (Supabase vs. Neon vs. Fly Postgres). | Bootstrap decision. |
| D3 | §6 | A2UI catalog locked at 10 components — coverage validated only after eval harness runs. | First eval run that fails for catalog reasons. |
| D4 | §13 | iOS-only — Android and web join in M2. | Start of M2 planning. |
| D5 | §11 | English-only — Lingui not wired. Codemod debt accumulates with every screen. | M2 planning, before first non-English market. |
| D6 | §4 | SSE chosen over WebSocket for streaming — works for one-way only. Edit-by-chat uses request/response, not streaming. | First feature requiring bidirectional streaming. |
| D7 | §16 | No CD pipeline at M1 — manual `eas build` triggered by engineer. | Second engineer joins, or M2. |
| D8 | §15 | Eval harness scoring is partly manual (some prompts need human judgement). | Eval prompt count > 60. |

**Red flags** (do these and an architect must reject the PR):
- Adding a UI kit dependency (NativeBase, Tamagui, Gluestack).
- Calling Anthropic SDK from a route handler instead of `services/api/src/llm/`.
- Putting renderer code anywhere outside `packages/a2ui-renderer/`.
- Storing tokens in MMKV or AsyncStorage.
- Logging raw prompt text or generated app content via `logger.info`.
- Bypassing the catalog by emitting custom JSX from the LLM.

---

## Refresh protocol

This document is currently **inferred from the product spec**, not from code, because the project is pre-bootstrap. The first refresh must happen after the vertical-slice PR lands (chat → render → save → reopen). At that point, run `/architecture-discover refresh` and reconcile any drift.

Subsequent refreshes:
- After every M-level milestone.
- After any §17 debt item is resolved.
- On demand, when an architect plan repeatedly hits `out_of_spec` in the same area.
