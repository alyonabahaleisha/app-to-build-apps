/**
 * Test factories. Build valid rows + valid V0 Specs without forcing every
 * test to spell out the noise.
 *
 * Step 1 shipped the basic factories needed by schema tests:
 *   - userRow({...overrides})            — partial-shape User
 *   - projectRow({ownerId, ...overrides}) — partial-shape Project
 *   - validSpec()                         — minimal valid V0 Spec
 *   - vectorOf(dim, fill?)                — number[] of length `dim`
 *
 * Step 3 adds:
 *   - userJwt({sub, email, secret})       — HS256 token for /auth/sync tests
 *
 * ADR-0007 V0 cutover: A2UISpec → Spec from @app-creator/protocol.
 *   - validSpec() returns a minimal V0 Spec (Calculator, no collections, no-nav)
 *   - specWithHeading(text) returns a V0 Spec with a single Heading in screens[0]
 *   - specWithoutHeading() returns a V0 Spec with no Heading (Body node only)
 *   - specWithLongHeading() — heading text 120 chars; title truncates at 40 + '…'
 *   - specWithDeepNesting(n) — retained for structural tests
 *   - specWithUnresolved* — cross-ref failure specs (navigate to nonexistent screen)
 *   - specWithFork — convenience wrapper over specWithHeading
 */
import {randomUUID} from 'node:crypto'

import type {Spec} from '@app-creator/protocol'
import jwt from 'jsonwebtoken'

import type {NewMiniApp, NewUser} from '../src/db/schema.js'

let counter = 0

export function uniqueEmail(prefix = 'user'): string {
  counter += 1
  return `${prefix}+${Date.now()}-${counter}@example.com`
}

export function userRow(overrides: Partial<NewUser> = {}): NewUser {
  return {
    id: overrides.id ?? randomUUID(),
    email: overrides.email ?? uniqueEmail(),
    ...overrides,
  }
}

export function miniAppRow(input: {ownerId: string} & Partial<NewMiniApp>): NewMiniApp {
  return {
    id: input.id ?? randomUUID(),
    title: input.title ?? 'Test mini-app',
    currentVersionId: input.currentVersionId ?? null,
    parentMiniAppId: input.parentMiniAppId ?? null,
    stance: input.stance ?? 'productive',
    accentPalette: input.accentPalette ?? 'neutral',
    coverArtSeed: input.coverArtSeed ?? randomUUID(),
    archetype: input.archetype ?? 'unknown',
    syncMode: input.syncMode ?? 'cloud-private',
    ...input,
  }
}

/** @deprecated Use miniAppRow — kept for backcompat with old test files during migration. */
export function projectRow(input: {ownerId: string} & Partial<NewMiniApp>): NewMiniApp {
  return miniAppRow(input)
}

// ---------------------------------------------------------------------------
// V0 Spec factories — minimal valid V0 Spec shapes for service/route tests.
// ---------------------------------------------------------------------------

/**
 * Minimal valid V0 Spec — Calculator archetype, no collections, no-nav.
 * All service + route tests that just need "a valid spec" use this.
 */
export function validSpec(): Spec {
  return {
    version: 1,
    archetype: 'Calculator',
    stance: 'productive',
    palette: 'focus',
    coverIcon: 'list',
    navigation: 'none',
    initialScreenId: 'main',
    collections: [],
    initialState: {},
    screens: [
      {
        id: 'main',
        title: 'App',
        root: {
          id: 'root',
          type: 'Screen',
          safeArea: 'both',
          padding: 'space-md',
          children: [
            {id: 'h1', type: 'Heading', text: 'App'},
          ],
        },
      },
    ],
  }
}

/** Spec whose screens[0].root contains a Heading with the given text. */
export function specWithHeading(text: string): Spec {
  const title = text.slice(0, 40) || 'Screen'
  return {
    version: 1,
    archetype: 'Calculator',
    stance: 'productive',
    palette: 'focus',
    coverIcon: 'list',
    navigation: 'none',
    initialScreenId: 'main',
    collections: [],
    initialState: {},
    screens: [
      {
        id: 'main',
        title,
        root: {
          id: 'root',
          type: 'Screen',
          safeArea: 'both',
          padding: 'space-md',
          children: [
            {id: 'h1', type: 'Heading', text},
          ],
        },
      },
    ],
  }
}

/** Spec whose screens[0] contains no Heading — title falls back to prompt or "Untitled". */
export function specWithoutHeading(): Spec {
  return {
    version: 1,
    archetype: 'Calculator',
    stance: 'productive',
    palette: 'focus',
    coverIcon: 'list',
    navigation: 'none',
    initialScreenId: 'main',
    collections: [],
    initialState: {},
    screens: [
      {
        id: 'main',
        title: 'Main',
        root: {
          id: 'root',
          type: 'Screen',
          safeArea: 'both',
          padding: 'space-md',
          children: [
            {id: 'b1', type: 'Body', text: 'No heading here'},
          ],
        },
      },
    ],
  }
}

/**
 * Spec with a Heading whose text exceeds 40 chars.
 * V0 title derivation truncates at 40 chars + '…' (total 41).
 * T-0007-099 boundary.
 */
export function specWithLongHeading(): Spec {
  // specWithHeading takes care of capping the screen title at 40 chars;
  // the Heading text itself is 120 chars and that's what drives title derivation.
  return specWithHeading('A'.repeat(120))
}

/**
 * Spec nested `levels` deep in Section children arrays.
 * Used by any remaining depth-check tests.
 */
export function specWithDeepNesting(levels: number): Spec {
  // Build leaf → wrap in Sections level-1 times
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let node: any = {id: 'leaf', type: 'Heading', text: 'leaf'}
  for (let i = 1; i < levels; i++) {
    node = {id: `s${i}`, type: 'Section', padding: 'space-md', children: [node]}
  }
  return {
    version: 1,
    archetype: 'Calculator',
    stance: 'productive',
    palette: 'focus',
    coverIcon: 'list',
    navigation: 'none',
    initialScreenId: 'main',
    collections: [],
    initialState: {},
    screens: [
      {
        id: 'main',
        title: 'Main',
        root: {id: 'root', type: 'Screen', safeArea: 'both', padding: 'space-md', children: [node]},
      },
    ],
  } as unknown as Spec
}

/**
 * Spec with a Button navigating to a non-existent screen.
 * V0 navigate action uses `target` (screen id), not `screenId`.
 * SpecSchema.parse() passes; validateCrossRefs() returns errors for unknown target.
 */
export function specWithUnresolvedTargetId(): Spec {
  return {
    version: 1,
    archetype: 'Calculator',
    stance: 'productive',
    palette: 'focus',
    coverIcon: 'list',
    navigation: 'stack',
    initialScreenId: 'main',
    collections: [],
    initialState: {},
    screens: [
      {
        id: 'main',
        title: 'Main',
        root: {
          id: 'root',
          type: 'Screen',
          safeArea: 'both',
          padding: 'space-md',
          children: [
            {
              id: 'btn',
              type: 'Button',
              label: 'Go',
              variant: 'primary',
              action: {type: 'navigate', target: 'nonexistent'},
            },
          ],
        },
      },
    ],
  }
}

/** Alias — same cross-ref failure, different name retained for backward compat. */
export function specWithUnresolvedViewId(): Spec {
  return specWithUnresolvedTargetId()
}

/**
 * Spec for the forking flow. The parentId is stored on the project row, not in
 * spec_json — so this just returns a normal spec.
 */
export function specWithFork(_parentId: string): Spec {
  return specWithHeading('Forked App')
}

/** Build a deterministic dummy vector for embedding inserts. */
export function vectorOf(dim: number, fill = 0): number[] {
  return Array.from({length: dim}, () => fill)
}

export interface UserJwtInput {
  sub: string
  email: string
  /** HS256 secret. Required — the test must control which key is in effect. */
  secret: string
  /** Override `iat` (epoch seconds). Defaults to now. */
  iat?: number
  /** Override `exp` (epoch seconds). Defaults to now + 600. */
  exp?: number
}

/**
 * Mint a Supabase-shaped HS256 JWT for /auth/sync tests. The `sub` carries
 * the canonical user UUID; `email` is the convenience claim — both flow into
 * `verifyJwt` which fronts the auth middleware.
 *
 * Note: this is a TEST factory. Production tokens are minted by Supabase.
 */
export function userJwt(input: UserJwtInput): string {
  const now = Math.floor(Date.now() / 1000)
  return jwt.sign(
    {
      sub: input.sub,
      email: input.email,
      iat: input.iat ?? now,
      exp: input.exp ?? now + 600,
    },
    input.secret,
    {algorithm: 'HS256'},
  )
}
