# App Creator

Chat-driven app builder for iOS. Describe an app idea in plain English, an LLM (Claude via Anthropic's tool use) emits a structured **A2UI spec**, and the mobile app renders it from a fixed catalog of 10 components — interactive, stateful, theme-aware. Then describe a tweak and watch it apply.

> **Status (2026-05-03):** Generation pipeline + full renderer working end-to-end on iOS Simulator. Edit-by-chat (ADR-0004) and Library/marketplace (ADR-0006) in flight. M1 milestone, internal testers only.

---

## Table of Contents

1. [What is this](#what-is-this)
2. [Prerequisites](#prerequisites)
3. [One-time external setup](#one-time-external-setup)
4. [Clone + install](#clone--install)
5. [Configuration (env files)](#configuration-env-files)
6. [Database setup (Supabase + migrations)](#database-setup-supabase--migrations)
7. [Run the backend](#run-the-backend)
8. [Build the iOS dev-client](#build-the-ios-dev-client)
9. [Run the mobile app](#run-the-mobile-app)
10. [Sign in (or skip auth in dev)](#sign-in-or-skip-auth-in-dev)
11. [End-to-end smoke test](#end-to-end-smoke-test)
12. [Project structure](#project-structure)
13. [Common commands](#common-commands)
14. [Architecture & docs](#architecture--docs)
15. [Troubleshooting](#troubleshooting)

---

## What is this

A monorepo with three runtime workspaces and two shared packages:

| Workspace | Role |
|---|---|
| `apps/mobile/` | Expo / React Native iOS app — the App Creator itself (chat, library, AppRunner) |
| `services/api/` | Fastify backend — owns auth, DB, Anthropic orchestration, marketplace endpoints |
| `packages/a2ui-schema/` | Zod schema for generated apps (the contract — locked at 10 components) |
| `packages/a2ui-renderer/` | Pure React Native renderer for A2UI specs (consumed by `apps/mobile`) |

Three things hold the system together:

1. **The A2UI schema is the contract.** Server validates LLM output, mobile validates before render, the LLM is forced to emit it via `tool_choice`. Adding a component touches schema + renderer + system prompt + evals together.
2. **Two component layers, never mixed.** `apps/mobile/src/components/` builds the App Creator's own UI. `packages/a2ui-renderer/src/components/` renders generated apps from spec nodes.
3. **One LLM entry point.** All Anthropic calls go through `services/api/src/llm/`. Routes never call the SDK directly. Every call is wrapped in a Langfuse trace and uses `tool_choice` to force structured output.

Read [`ARCHITECTURE.md`](ARCHITECTURE.md) for the binding spec and [`CLAUDE.md`](CLAUDE.md) for code-level patterns.

---

## Prerequisites

| Tool | Version | Why | How |
|---|---|---|---|
| **Node.js** | 20+ (`.nvmrc` pins) | Runtime | `brew install nvm && nvm install` from repo root |
| **pnpm** | 9.x | Workspace package manager | `corepack enable && corepack prepare pnpm@9.12.0 --activate` |
| **Xcode** | 15+ | iOS Simulator + native deps | Mac App Store |
| **Xcode Command Line Tools** | Latest | `xcrun simctl`, `idb` | `xcode-select --install` |
| **Watchman** | Latest | Metro file watcher | `brew install watchman` |
| **Apple Developer account** | Active ($99/yr) | TestFlight + signing dev-client | [developer.apple.com](https://developer.apple.com/) |
| **Expo account** | Free tier | EAS dev-client builds | [expo.dev](https://expo.dev/) |
| **EAS CLI** | Latest | Build + submit | `npm install -g eas-cli` |
| **idb-companion** | 1.1.8+ | Required by some MCP integrations + simulator automation | `brew tap facebook/fb && brew install idb-companion && pip install fb-idb` |
| **Postgres client** *(optional)* | 14+ | Inspect DB locally | `brew install libpq && brew link --force libpq` |

Optional but recommended:

- **Anthropic Console access** — for monitoring LLM spend and prompt-cache hit rate ([console.anthropic.com](https://console.anthropic.com/))
- **Langfuse account (free)** — for tracing every LLM call with input/output, latency, cost ([cloud.langfuse.com](https://cloud.langfuse.com))
- **Sentry project** — for production error tracking (mobile-side)

> **Heads-up: Expo Go does NOT work for this project.** The mobile app uses native deps (`react-native-mmkv`, `@sentry/react-native`, `expo-secure-store`, `@gorhom/bottom-sheet`, `expo-haptics`) that aren't bundled into Expo Go. You **must** produce a custom dev-client build via EAS — see [Build the iOS dev-client](#build-the-ios-dev-client).

---

## One-time external setup

Before cloning the repo, set up these external services. You'll plug their keys into `.env` files in the next section.

### 1. Supabase project (database + auth)

1. Create a free project at [app.supabase.com](https://app.supabase.com/).
2. In **Settings → API**, copy:
   - **Project URL** (`https://<ref>.supabase.co`)
   - **`anon` public key** (mobile-side)
   - **`service_role` secret key** (backend-side — never expose in mobile bundle)
3. In **Settings → API → JWT Settings**, copy the **JWT Secret** (used by the backend to verify Supabase-issued JWTs).
4. In **Settings → Database**, copy the **Connection string** (URI format, with password). This is your `DATABASE_URL`.
5. In **Authentication → URL Configuration**, add the deep-link redirect:
   - **Site URL:** `appcreator://auth`
   - **Additional redirect URLs:** `appcreator://auth?token=*`
6. In **Authentication → Email Templates**, customize the magic-link email if you want (optional).
7. Enable the `pgvector` extension via **Database → Extensions** (we use it for the future memory layer; not required for M1 but the migrations expect it). If unavailable on the free tier, run `CREATE EXTENSION IF NOT EXISTS vector;` manually via the SQL editor.

### 2. Anthropic API key

1. Create an account at [console.anthropic.com](https://console.anthropic.com/).
2. Generate an API key (Settings → API Keys).
3. Set a workspace spend limit ($30/day per engineer is the cap our spec uses).

### 3. Expo / EAS project

1. Sign up at [expo.dev](https://expo.dev/) and run `eas login` from your terminal once.
2. From the repo (after cloning + installing), run `eas init` inside `apps/mobile/` to create a project and capture the `EAS_PROJECT_ID` for your `.env`.
3. Configure your Apple credentials: `eas credentials` and follow the iOS-distribution prompts.

### 4. Langfuse *(optional, for LLM tracing)*

1. Sign up at [cloud.langfuse.com](https://cloud.langfuse.com).
2. Create a project and copy the public + secret keys.

### 5. Sentry *(optional, for mobile error tracking)*

1. Create a React Native project at [sentry.io](https://sentry.io).
2. Copy the DSN.

---

## Clone + install

```bash
git clone https://github.com/alyonabahaleisha/app-to-build-apps.git
cd app-to-build-apps

# Use the pinned Node version
nvm use

# Enable pnpm via Corepack (one-time)
corepack enable
corepack prepare pnpm@9.12.0 --activate

# Install workspace dependencies
pnpm install
```

Verify the install:

```bash
pnpm typecheck   # All 4 workspaces — should be clean
pnpm lint        # ESLint over the repo
pnpm test        # Jest in every package, in parallel
```

Expected counts (as of 2026-05-03): renderer 211 tests, mobile 7 AppRunner suites + others, API tests pending Docker (testcontainers).

---

## Configuration (env files)

Each workspace has its own `.env.example`. Copy and fill in:

```bash
cp services/api/.env.example services/api/.env
cp apps/mobile/.env.example apps/mobile/.env
```

`.env` files are gitignored — never commit real keys.

### `services/api/.env`

```env
PORT=3000
NODE_ENV=development
LOG_LEVEL=info

# Anthropic — from console.anthropic.com
ANTHROPIC_API_KEY=sk-ant-api03-...

# Supabase — from app.supabase.com → Settings → API
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
SUPABASE_JWT_SECRET=<JWT secret from Supabase>

# Database — from Supabase → Settings → Database (URI connection string)
DATABASE_URL=postgresql://postgres:<pw>@<host>:5432/postgres

# Optional — Langfuse
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_HOST=https://cloud.langfuse.com
```

### `apps/mobile/.env`

```env
# Backend API — for simulator, use localhost; for device on same Wi-Fi, use your Mac's LAN IP
EXPO_PUBLIC_API_URL=http://localhost:3000
EXPO_PUBLIC_SENTRY_DSN=

# Supabase — from same dashboard, but only the ANON key (never service_role)
EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...

# Build-time
IOS_BUNDLE_ID=com.appcreator.mvp
EAS_PROJECT_ID=<from `eas init` output>
```

> **Mobile env-var rule:** keys prefixed `EXPO_PUBLIC_` are bundled into the JS and reach the device. Anything else is build-time only. Never put `SUPABASE_SERVICE_ROLE_KEY` or `ANTHROPIC_API_KEY` here.

---

## Database setup (Supabase + migrations)

Once `DATABASE_URL` is set in `services/api/.env`:

```bash
# Apply all migrations (creates 7 tables + indexes, seeds @example user)
pnpm --filter @app-creator/api db:migrate
```

Migrations are versioned in `services/api/migrations/` and applied in order:

| File | What it does |
|---|---|
| `0001_init.sql` | Initial schema — `users`, `projects`, `project_versions`, `messages`, `events`, `facts`, `embeddings` |
| `0002_fk_constraints.sql` | Adds foreign-key relationships |
| `0003_marketplace_columns.sql` | Adds `users.handle`, `projects.visibility`, `projects.published_at`, `projects.original_prompt`, partial library index |
| `0004_seed_example_user.sql` | Seeds the `@example` system user (handle reserved for hand-authored seed apps) |

Verify the schema:

```bash
pnpm --filter @app-creator/api db:studio   # Drizzle Studio — visual schema browser
```

Or via psql:
```bash
psql "$DATABASE_URL" -c "\dt"   # List tables
```

If you change the schema in `services/api/src/db/schema.ts`, generate a new migration:

```bash
pnpm --filter @app-creator/api db:generate   # drizzle-kit generate
# Review the generated SQL, commit both the schema diff and the migration file
```

**Never edit a committed migration.** Always add a new one.

---

## Run the backend

```bash
pnpm --filter @app-creator/api dev
```

The Fastify server starts on `http://localhost:3000` (or your `PORT`). With `tsx watch`, it auto-reloads on file changes.

Verify:

```bash
curl http://127.0.0.1:3000/health
# {"status":"ok","timestamp":"2026-05-03T..."}
```

You should see structured Pino logs in the terminal:
```
[INFO] dev_bypass_user_ready (devUserId: deadbeef-0000-0000-0000-000000000000)
[INFO] Server listening at http://127.0.0.1:3000
[INFO] api listening (port: 3000)
```

The `dev_bypass_user_ready` line means the dev-only auth bypass is wired up — see [Sign in](#sign-in-or-skip-auth-in-dev).

---

## Build the iOS dev-client

You only need to do this **once** per major dependency change. After the dev-client is installed on the simulator/device, the JS bundle reloads from Metro on every edit.

```bash
cd apps/mobile
eas build --profile development --platform ios
```

Wait for the build to complete on EAS (link printed in terminal). Once done:

**On the simulator:**
```bash
# Download the .tar.gz from the EAS link, extract, drag the .app into the Simulator window
# OR use the `eas build:run` shortcut:
eas build:run --platform ios --latest
```

**On a physical iPhone:**
- Tap the install link from the EAS email on the device.
- Trust the developer profile in Settings → General → VPN & Device Management.

---

## Run the mobile app

With the API running and a dev-client installed:

```bash
pnpm --filter @app-creator/mobile start
# OR equivalently:
cd apps/mobile && pnpm start
```

Metro starts on port 8081. The dev-client app on the device will auto-detect Metro on the same network. If not:

- **Simulator:** open the dev-client app, it should connect automatically. If it shows a connection screen, tap "Enter URL manually" and use `http://localhost:8081`.
- **Physical device on same Wi-Fi:** Metro prints a LAN URL like `http://10.0.0.34:8081`. Use that. Make sure your `EXPO_PUBLIC_API_URL` also points at the LAN IP, not `localhost`.

To explicitly target the simulator:

```bash
pnpm --filter @app-creator/mobile ios
```

---

## Sign in (or skip auth in dev)

Two paths:

### Path A — Magic link (real auth)

1. On the SignIn screen, type your email.
2. Tap **Send magic link**.
3. Check your inbox. Tap the link — it opens via the `appcreator://auth?token=...` deep-link scheme.
4. The simulator catches the deep link, the SessionProvider stores the token in `expo-secure-store`, and you land on Home.

> **iOS Simulator + magic links:** the email link opens in your default browser, which then redirects to the `appcreator://` scheme. This requires the dev-client to already be installed in the simulator.

### Path B — Dev bypass (no email round-trip)

The backend has a dev-only bypass for local testing. When `NODE_ENV !== 'production'`, the bearer token `dev-bypass` resolves to a synthetic dev user (`deadbeef-0000-0000-0000-000000000000`).

On the SignIn screen, tap **Continue without signing in**. The mobile app sets the in-memory session to use the `dev-bypass` token. All authenticated endpoints work; data persists in the DB under the dev user's ID.

This is wired up in `services/api/src/lib/auth.ts` (server) and `apps/mobile/src/state/session/SessionProvider.tsx` (mobile). It is **inert in production** — the bypass branch never fires when `NODE_ENV='production'`.

---

## End-to-end smoke test

Once signed in:

1. **Home** screen shows your apps (empty for a fresh dev user).
2. Tap **✨ Create new app**.
3. **Chat** screen opens with prompt suggestions ("A daily water intake tracker" etc.) — type your own or tap a suggestion.
4. Tap **Send**. Watch the loading bubble: *"Building your app…"* with a spinner. The server is calling Anthropic with `tool_choice: produce_app_spec`.
5. After ~10–15s, **AppRunner** opens. The generated app renders — Container, Heading, Text, Buttons, Counters, etc. Title is auto-derived (with emoji if the model included one).
6. Tap buttons → see toast actions fire. Tap `+`/`−` on Counters → state increments. Tap **⚙️ Settings** (if the spec has multi-view) → navigate between views.
7. Top bar **Publish** → bottom sheet with handle picker (pre-filled from your email's local-part) → confirm → "Published to Library" toast.

If you got that far, the chat → generate → render → publish loop is fully working.

---

## Project structure

```
app-to-build-apps/
├── apps/
│   └── mobile/                    # Expo RN 0.76, iOS-only at M1
│       ├── src/
│       │   ├── screens/           # SignIn, Home, Chat, AppRunner
│       │   ├── components/        # App-shell components (Button, Card, Toast, ...)
│       │   ├── state/             # SessionProvider, queries (TanStack Query)
│       │   ├── theme/             # Tokens (spacing, palette, typography)
│       │   ├── lib/               # apiFetch, deepLink, logger
│       │   └── Navigation.tsx     # React Navigation root
│       ├── app.config.ts          # Expo config (build-time)
│       └── eas.json               # EAS profiles (development, preview, production)
│
├── services/
│   └── api/                       # Fastify + Drizzle + Postgres
│       ├── src/
│       │   ├── routes/            # auth, projects, marketplace, generate
│       │   ├── services/          # Domain logic (projects, marketplace)
│       │   ├── llm/               # Anthropic SDK wrapper, prompts, eval harness
│       │   ├── db/                # Drizzle schema + migration runner
│       │   └── lib/               # auth (requireAuth), env, logger, rateLimit
│       ├── migrations/            # Versioned SQL — never edit, always add new
│       └── eval/                  # 30-prompt eval harness (runs in CI)
│
├── packages/
│   ├── a2ui-schema/               # Zod schemas — the LLM output contract
│   │   └── src/index.ts           # 10 component types, 5 action types, version=1
│   └── a2ui-renderer/             # Pure RN renderer
│       └── src/
│           ├── render.tsx         # Top-level dispatcher
│           ├── components/        # Container, Heading, Text, Image, Button,
│           │                      #   Counter, TextInput, Toggle, List, Form
│           ├── state/             # useA2UIState hook + reducer
│           ├── theme/             # RendererThemeProvider (renderer-internal)
│           └── logger/            # RendererLoggerProvider (no-op default)
│
├── docs/
│   ├── adrs/                      # Architecture Decision Records (binding)
│   ├── product/                   # Product specs (Robert)
│   ├── ux/                        # UX specs (Sable)
│   └── pipeline/                  # Pipeline state + per-step QA reports
│
├── ARCHITECTURE.md                # Binding spec — read before non-trivial work
├── CLAUDE.md                      # Tactical patterns (companion to ARCHITECTURE.md)
└── README.md                      # This file
```

---

## Common commands

All from the repo root unless noted.

### Workspace-wide

```bash
pnpm install              # Install all deps
pnpm typecheck            # tsc --noEmit in every package, parallel
pnpm lint                 # ESLint everywhere
pnpm lint:fix             # Auto-fix
pnpm test                 # Jest in every package
pnpm format               # Prettier --write
pnpm format:check
```

### Backend (API)

```bash
pnpm --filter @app-creator/api dev          # tsx watch — auto-reload
pnpm --filter @app-creator/api build        # tsc -p tsconfig.build.json
pnpm --filter @app-creator/api test
pnpm --filter @app-creator/api eval         # 30-prompt eval (M1 acceptance gate)
pnpm --filter @app-creator/api db:generate  # drizzle-kit generate (review SQL before commit!)
pnpm --filter @app-creator/api db:migrate
pnpm --filter @app-creator/api db:studio    # Drizzle Studio
```

### Mobile

```bash
pnpm --filter @app-creator/mobile start          # Expo Metro (dev-client mode)
pnpm --filter @app-creator/mobile ios            # Build + run on simulator
pnpm --filter @app-creator/mobile typecheck
pnpm --filter @app-creator/mobile test
```

### Renderer / schema

```bash
pnpm --filter @app-creator/a2ui-schema test
pnpm --filter @app-creator/a2ui-renderer test
pnpm --filter @app-creator/a2ui-renderer test --coverage
```

### Single test file

```bash
pnpm --filter @app-creator/api test -- src/llm/generate.test.ts
pnpm --filter @app-creator/a2ui-renderer test -- Counter
```

### Update a snapshot

```bash
pnpm --filter @app-creator/a2ui-renderer test -- -u Counter
# Per CLAUDE.md §8 — write a code-review note explaining why
```

---

## Architecture & docs

| Doc | What's in it |
|---|---|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | The binding spec. Stack, layering, navigation, auth, storage tiers, observability, accessibility. Read this before non-trivial changes. |
| [`CLAUDE.md`](CLAUDE.md) | Tactical patterns. Code-style snippets, RN conventions, query patterns, LLM call shape. Companion to ARCHITECTURE.md. |
| [`docs/adrs/`](docs/adrs/) | Architecture Decision Records. Each ADR is a sliced piece of work with steps, tests, and acceptance criteria. ADR-0001..0003 are shipped, ADR-0004 (Edit-by-Chat) is the current frontier. |
| [`docs/product/`](docs/product/) | Robert's product specs. The umbrella `app-creation-poc.md` is canonical; child specs add detail per slice. |
| [`docs/ux/`](docs/ux/) | Sable's UX specs. Per-component visual treatment, motion, copy, accessibility. |
| [`docs/pipeline/`](docs/pipeline/) | The agent-pipeline state file + per-step QA reports from Roz. |

### Reading order for a new contributor

1. `README.md` (this file) — get the project running.
2. `ARCHITECTURE.md` — understand the rules.
3. `docs/product/app-creation-poc.md` — understand the product.
4. `CLAUDE.md` — internalize the code patterns.
5. `docs/adrs/ADR-0001-foundation.md` — the foundation.
6. `docs/adrs/ADR-0002-generation-publish.md` — the generation pipeline.
7. `docs/adrs/ADR-0003-renderer.md` — the renderer.
8. Whatever ADR is currently in flight.

---

## Troubleshooting

### Backend won't start

- **`Cannot connect to database`**: check `DATABASE_URL` is correct, the Supabase project is awake (free tier suspends after inactivity), and your network can reach Supabase. Try `psql "$DATABASE_URL" -c "SELECT 1"`.
- **`SUPABASE_JWT_SECRET is required`**: pull it from Supabase Settings → API → JWT Settings (not the same as the `service_role` key).
- **Port 3000 already in use**: change `PORT` in `services/api/.env`, or kill the process: `lsof -ti :3000 | xargs kill`.

### Mobile app stuck on "Connecting to Metro"

- **Simulator:** the dev-client may have stale bundle URL. In the dev menu (Cmd+D), tap "Configure Bundler" → enter `localhost:8081`.
- **Physical device:** `EXPO_PUBLIC_API_URL` must use your Mac's LAN IP (`ipconfig getifaddr en0`), not `localhost`. Same for Metro — start it with `--host lan`.

### Anthropic returns 400 "Thinking may not be enabled when tool_choice forces tool use"

This was a known issue resolved in our codebase — extended thinking and forced `tool_choice` are mutually exclusive at the Anthropic API. If you see this in fresh code, you've re-introduced extended thinking somewhere. We disabled it in `services/api/src/llm/generate.ts` per ADR-0002 §D rationale.

### Generation works but AppRunner shows "[Unimplemented: Container]"

You're running pre-ADR-0003 code. The renderer skeleton only handled `Heading` + `Text` until the full catalog landed. Pull latest, rebuild the dev-client, and reload Metro.

### `expo-haptics` throws on simulators

Expected on simulators without haptic hardware. The renderer wraps every `Haptics.impactAsync()` call in try/catch — should never propagate. If it does, you've removed a guard somewhere.

### Snapshot tests fail with no visible changes

React Native's internals can produce cosmetically different but semantically equivalent JSON across minor version bumps. Inspect the diff before regenerating with `--updateSnapshot`. Per CLAUDE.md §8, snapshot updates require an explicit reviewer note.

### iOS dev-client build fails on EAS

- **`buildNumber must be unique`**: bump `ios.buildNumber` in `apps/mobile/app.config.ts` and re-submit. App Store Connect rejects re-uploaded binaries with the same build number.
- **Provisioning profile issues**: run `eas credentials` and refresh.

### "Worker process has failed to exit gracefully" warning in tests

Cosmetic — RTL test cleanup leaves async timers in some cases. Doesn't fail the test run.

---

## Security notes

- **Never commit `.env` files.** Real keys belong only on your machine, in CI secret stores, or in EAS Secrets (mobile build-time).
- **Tokens are stored in `expo-secure-store` only**, never MMKV or AsyncStorage. Per ARCHITECTURE.md §3.
- **The mobile app talks to OUR API, not directly to Anthropic.** The Anthropic API key never leaves the backend.
- **The dev-bypass auth path is gated on `NODE_ENV !== 'production'`.** Inert in production builds.
- **PII rules:** never log raw email, full prompt content, or generated app source IP. Use `safeMessage(error)` for outside-origin errors. Per ARCHITECTURE.md §8.

---

## License

Proprietary — internal project. Not for redistribution.

---

## Working with this repo

- **Architectural decisions** go in `docs/adrs/`. Discuss before implementing.
- **Tactical patterns** evolve `CLAUDE.md`. Update when conventions change.
- **Per-slice work** flows through the pipeline: Robert (PM) → Sable (UX) → Cal (architect) → Colby (implementation) → Roz (QA) → Ellis (commit). See `docs/pipeline/pipeline-state.md` for current state.

If you're a human contributor (not an AI agent), the same flow applies — write specs first, get them reviewed, then implement against the test plan.
