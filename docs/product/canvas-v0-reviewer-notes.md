# Canvas V0 — Reviewer Notes

Companion to `canvas-v0.md`. Captures decisions, scope fences, and model notes
that reviewers ask about most frequently.

## Auth model

Sign in with Apple, no third-party auth providers, account deletion supported.
Apple Relay email aliases are stored verbatim and never surfaced in API
responses. The JWT issued post-SIWA is HS256, identical in shape to the
magic-link path it replaces.

## Component catalog

The A2UI catalog is a fixed set of 10 component types (see `ARCHITECTURE.md §6`).
Adding a new type requires touching schema + renderer + system prompt + evals
in a single PR — intentional friction to keep the catalog stable at V0.

## Out-of-scope at V0

- Other auth providers (Google, GitHub, email/password): V0.5+.
- Two-factor authentication: V0.5+.
- Android: M2+.
- Real-time collaboration: post-V0.
