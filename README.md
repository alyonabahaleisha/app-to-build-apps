# App Creator MVP

Chat-driven app builder. Users describe an idea, an LLM produces a structured A2UI spec, and the mobile app renders it from a fixed component catalog.

> Status: pre-bootstrap. Skeleton only. No feature code yet.

## Layout

```
apps/
  mobile/             # Expo React Native app (iOS at M1)
services/
  api/                # Fastify backend + LLM orchestration
packages/
  a2ui-schema/        # Shared Zod schemas + TS types
  a2ui-renderer/      # RN renderer for A2UI specs
ARCHITECTURE.md       # Binding spec — read before implementing
CLAUDE.md             # Tactical patterns
```

## Prerequisites

- Node 20+ (`.nvmrc`)
- pnpm 9+ (`corepack enable && corepack prepare pnpm@9.12.0 --activate`)
- Xcode 15+ for iOS builds
- An [Apple Developer](https://developer.apple.com/) account ($99/yr) for TestFlight
- An [Expo](https://expo.dev/) account (free for our scale)
- A [Supabase](https://supabase.com/) project (Postgres + pgvector + Auth)
- An [Anthropic](https://console.anthropic.com/) API key

## Quick start

```bash
# Install dependencies
pnpm install

# Verify scaffolding
pnpm typecheck
pnpm lint
pnpm test

# Run the backend (after configuring services/api/.env)
pnpm --filter @app-creator/api dev

# Run the mobile app on a dev-client (requires one EAS build first; see app-creator/.claude/skills/expo-eas)
pnpm --filter @app-creator/mobile start
```

## Configuration

Each workspace has its own `.env.example` showing required keys. Copy to `.env` (or `.env.local`) and fill in.

Mobile-side public keys (bundled into the JS) must be prefixed `EXPO_PUBLIC_`. Anything else is build-time only and does not reach the device.

## Working with this repo

- **Architectural rules** live in [`ARCHITECTURE.md`](ARCHITECTURE.md). Read it before non-trivial changes — it's the binding contract.
- **Tactical patterns** live in [`CLAUDE.md`](CLAUDE.md). Code-style and snippet-level guidance.
- **Workflow**: tickets are routed through `/run-ticket` (see `.claude/commands/run-ticket.md`). The bootstrap PR (this commit) is the only one that does not go through the workflow.
