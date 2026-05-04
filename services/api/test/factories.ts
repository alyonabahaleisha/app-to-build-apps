/**
 * Test factories. Build valid rows + valid A2UI specs without forcing every
 * test to spell out the noise.
 *
 * Step 1 shipped the basic factories needed by schema tests:
 *   - userRow({...overrides})            — partial-shape User
 *   - projectRow({ownerId, ...overrides}) — partial-shape Project
 *   - validSpec()                         — minimal valid A2UISpec
 *   - vectorOf(dim, fill?)                — number[] of length `dim`
 *
 * Step 3 adds:
 *   - userJwt({sub, email, secret})       — HS256 token for /auth/sync tests
 *
 * Subsequent steps will add: project_versions, messages, facts factories.
 */
import {randomUUID} from 'node:crypto'

import type {A2UISpec} from '@app-creator/a2ui-schema'
import {A2UI_VERSION} from '@app-creator/a2ui-schema'
import jwt from 'jsonwebtoken'

import type {NewProject, NewUser} from '../src/db/schema.js'

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

export function projectRow(input: {ownerId: string} & Partial<NewProject>): NewProject {
  return {
    id: input.id ?? randomUUID(),
    title: input.title ?? 'Test project',
    currentVersionId: input.currentVersionId ?? null,
    parentProjectId: input.parentProjectId ?? null,
    ...input,
  }
}

/**
 * Minimal valid A2UISpec with a single Heading. Useful for project_versions
 * insert tests once Step 4 lands; included here so schema tests can exercise
 * jsonb columns with realistic shapes.
 */
export function validSpec(overrides?: Partial<A2UISpec>): A2UISpec {
  return {
    version: A2UI_VERSION,
    initialViewId: 'main',
    views: [
      {
        id: 'main',
        root: {type: 'Heading', text: 'Hello'},
      },
    ],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Spec variants for ADR-0001 Step 4. Title derivation, depth, action targets.
// ---------------------------------------------------------------------------

/** Spec whose first node in the first view is a Heading with the given text. */
export function specWithHeading(text: string): A2UISpec {
  return {
    version: A2UI_VERSION,
    initialViewId: 'main',
    views: [{id: 'main', root: {type: 'Heading', text}}],
  }
}

/** Spec whose first view contains no Heading anywhere — title falls back to "Untitled". */
export function specWithoutHeading(): A2UISpec {
  return {
    version: A2UI_VERSION,
    initialViewId: 'main',
    views: [
      {
        id: 'main',
        root: {
          type: 'Container',
          direction: 'column',
          children: [{type: 'Text', text: 'No heading here'}],
        },
      },
    ],
  }
}

/**
 * Spec with a Heading whose text exceeds 60 chars. Title derivation truncates
 * to 60 chars + an ellipsis; total length 61. T-0001-059 boundary.
 */
export function specWithLongHeading(): A2UISpec {
  return specWithHeading('A'.repeat(120))
}

/**
 * Spec nested `levels` deep. Root counts as level 1; depths beyond 8 trip
 * `max_depth_exceeded` (T-0001-131).
 */
export function specWithDeepNesting(levels: number): A2UISpec {
  type Node = A2UISpec['views'][number]['root']
  let node: Node = {type: 'Heading', text: 'leaf'}
  for (let i = 1; i < levels; i++) {
    node = {type: 'Container', direction: 'column', children: [node]}
  }
  return {
    version: A2UI_VERSION,
    initialViewId: 'main',
    views: [{id: 'main', root: node}],
  }
}

/** Spec with a Button.set targeting a non-existent id (T-0001-130). */
export function specWithUnresolvedTargetId(): A2UISpec {
  return {
    version: A2UI_VERSION,
    initialViewId: 'main',
    views: [
      {
        id: 'main',
        root: {
          type: 'Button',
          label: 'Go',
          action: {type: 'set', targetId: 'nonexistent', value: 'x'},
        },
      },
    ],
  }
}

/** Spec with a Form.submitAction navigate to an unknown viewId (T-0001-138). */
export function specWithUnresolvedViewId(): A2UISpec {
  return {
    version: A2UI_VERSION,
    initialViewId: 'main',
    views: [
      {
        id: 'main',
        root: {
          type: 'Form',
          formId: 'login',
          fields: [],
          submitAction: {type: 'navigate', viewId: 'unknown'},
        },
      },
    ],
  }
}

/**
 * Spec carrying a parent reference for the forking flow (T-0001-122). The
 * `parentId` value is opaque to the spec — it's stored on the project row,
 * not in spec_json. We return a normal spec; the caller passes parentId
 * separately to `projectsService.create({parentProjectId})`.
 */
export function specWithFork(_parentId: string): A2UISpec {
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
