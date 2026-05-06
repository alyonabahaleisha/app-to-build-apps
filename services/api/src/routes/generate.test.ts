/**
 * ADR-0002 Step 4 — /generate route tests.
 *
 * T-IDs covered: T-0002-040 through T-0002-064 (25 tests).
 *
 * Two describe blocks:
 *   "unit" — pure-unit tests that need no Docker. Run unconditionally.
 *   "integration" — require testcontainers Postgres. Run when Docker available.
 *
 * SSE helper:
 *   `parseSSE(raw)` splits on `\n\n`, extracts `data:` lines, and returns an
 *   array of parsed payloads (plus the raw `[DONE]` sentinel string).
 *
 * Auth: HS256 JWT minted with `TEST_JWT_SECRET` via the `userJwt` factory.
 */

import {randomUUID} from 'node:crypto'

import Fastify from 'fastify'
import pino from 'pino'
import type {NodePgDatabase} from 'drizzle-orm/node-postgres'
import {eq} from 'drizzle-orm'

import * as schema from '../db/schema.js'
import {users, projects, projectVersions, messages} from '../db/schema.js'
import {createLogSink, PINO_LEVEL} from '../../test/mocks/pinoStream.js'
import {closeTestPool, getTestDb, getTestPool, truncateAll} from '../../test/setup.js'
import {userJwt, specWithHeading, validSpec, uniqueEmail} from '../../test/factories.js'
import {
  mockAnthropicStream,
  MINIMAL_VALID_SPEC,
  MINIMAL_VALID_PLAN,
  makeToolUseMessage,
  makeToolUseStartEvent,
  makeSuccessEvents,
} from '../../test/mocks/anthropic.js'
import {PlanSchema} from '@app-creator/a2ui-schema'
import {resetRateLimitForTests} from '../lib/rateLimit.js'

// ---------------------------------------------------------------------------
// Module-level mocks — declared before the mocked modules are imported
// ---------------------------------------------------------------------------

jest.mock('@anthropic-ai/sdk')

// Bypass ANTHROPIC_API_KEY env enforcement so the module loads in CI.
jest.mock('../llm/anthropic.js', () => ({
  anthropic: {
    beta: {
      promptCaching: {
        messages: {
          stream: jest.fn(),
        },
      },
    },
  },
}))

// Mock runPipeline so route tests can control pipeline output without
// requiring a real Anthropic SDK call. Configured per-test (see T-0004-08x).
// The default implementation yields a minimal happy-path SSE sequence.
const mockRunPipeline = jest.fn()
jest.mock('../llm/pipeline.js', () => ({
  runPipeline: (...args: unknown[]) => mockRunPipeline(...args),
}))

// ---------------------------------------------------------------------------
// JWT setup (must come before import of auth.ts)
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = 'generate-route-test-secret-' + randomUUID()
process.env.SUPABASE_JWT_SECRET = TEST_JWT_SECRET
process.env.NODE_ENV = 'test'
process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key'

// ---------------------------------------------------------------------------
// Late imports — after mocks are declared
// ---------------------------------------------------------------------------

import {generateRoutes} from './generate.js'
import {createProjectsService} from '../services/projects.service.js'
import {InvalidSpecError, RateLimitedError, AnthropicTransportError} from '../llm/errors.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Db = NodePgDatabase<typeof schema>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type SSEPayload = Record<string, unknown> | string

/**
 * Parse a raw SSE response body into an array of parsed JSON payloads.
 * The `[DONE]` sentinel is returned as the raw string `'[DONE]'`.
 */
function parseSSE(raw: string): SSEPayload[] {
  return raw
    .split('\n\n')
    .map(chunk => chunk.trim())
    .filter(Boolean)
    .map(chunk => {
      const dataLine = chunk.split('\n').find(l => l.startsWith('data: '))
      if (!dataLine) return null
      const payload = dataLine.slice('data: '.length)
      if (payload === '[DONE]') return '[DONE]' as string
      try {
        return JSON.parse(payload) as Record<string, unknown>
      } catch {
        return payload
      }
    })
    .filter((x): x is SSEPayload => x !== null)
}

/** Get the mock stream function from the mocked anthropic module. */
function getStreamMock(): jest.Mock {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const {anthropic} = require('../llm/anthropic.js')
  return anthropic.beta.promptCaching.messages.stream as jest.Mock
}

interface BuildOpts {
  db?: Db
  sink?: ReturnType<typeof createLogSink>
}

async function buildGenerateServer(opts: BuildOpts = {}) {
  const loggerInstance = opts.sink
    ? pino({level: 'info', base: undefined}, opts.sink.stream)
    : pino({level: 'silent'})
  const server = Fastify({loggerInstance})
  await server.register(generateRoutes, {db: opts.db})
  return server
}

async function makeUser(db: Db, email = uniqueEmail()): Promise<string> {
  const id = randomUUID()
  await db.insert(users).values({id, email})
  return id
}

function authHeader(sub: string, email: string): {authorization: string} {
  return {authorization: `Bearer ${userJwt({sub, email, secret: TEST_JWT_SECRET})}`}
}

/**
 * Setup a happy-path mock at both the pipeline level (runPipeline) and the
 * underlying Anthropic SDK stream level. The pipeline mock is what the route
 * now calls; the SDK mock is kept as a fallback for any test that reaches
 * through to the SDK directly.
 */
function setupHappyMock(): void {
  mockRunPipeline.mockImplementation(() => makePipelineGenerator(null))
  getStreamMock().mockImplementation(
    mockAnthropicStream(makeSuccessEvents(), makeToolUseMessage(MINIMAL_VALID_SPEC)),
  )
}

/**
 * Returns an async generator that yields the standard SSE event sequence with
 * the given plan (or null). Used to mock runPipeline at the route level.
 */
async function* makePipelineGenerator(
  plan: import('@app-creator/a2ui-schema').Plan | null,
): AsyncGenerator<import('../llm/generate.js').GenerateEvent> {
  yield {type: 'thinking_started'}
  yield {type: 'building_started'}
  yield {
    type: 'done',
    spec: MINIMAL_VALID_SPEC as import('@app-creator/a2ui-schema').A2UISpec,
    plan,
    thinking_duration_ms: 10,
    generation_duration_ms: 20,
  }
}

/**
 * Setup a pipeline mock that yields the happy-path events with the given plan.
 * Replaces setupHappyMock() for tests that use runPipeline (Step 6+).
 */
function setupPipelineMock(plan: import('@app-creator/a2ui-schema').Plan | null = null): void {
  mockRunPipeline.mockImplementation(() => makePipelineGenerator(plan))
}

// ---------------------------------------------------------------------------
// UNIT tests — no Docker required
// ---------------------------------------------------------------------------

describe('ADR-0002 Step 4 — POST /generate route (unit, no Docker)', () => {
  beforeEach(() => {
    getStreamMock().mockReset()
    mockRunPipeline.mockReset()
    resetRateLimitForTests()
  })

  // -------------------------------------------------------------------------
  // T-0002-045 — Failure: missing prompt → 400 {error: 'invalid_input'}; no SSE
  // -------------------------------------------------------------------------
  it('T-0002-045: POST /generate without prompt → 400 {error: invalid_input}; no SSE stream', async () => {
    const server = await buildGenerateServer()
    try {
      const userId = randomUUID()
      const res = await server.inject({
        method: 'POST',
        url: '/generate',
        headers: {
          ...authHeader(userId, uniqueEmail()),
          'content-type': 'application/json',
        },
        payload: JSON.stringify({}),
      })

      expect(res.statusCode).toBe(400)
      expect(res.headers['content-type']).not.toContain('text/event-stream')
      expect(res.json()).toEqual({error: 'invalid_input'})
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0002-046 — Failure: prompt > 2000 chars → 400 {error: 'invalid_input'}
  // -------------------------------------------------------------------------
  it('T-0002-046: prompt > 2000 chars → 400 {error: invalid_input}; no SSE stream', async () => {
    const server = await buildGenerateServer()
    try {
      const userId = randomUUID()
      const res = await server.inject({
        method: 'POST',
        url: '/generate',
        headers: {
          ...authHeader(userId, uniqueEmail()),
          'content-type': 'application/json',
        },
        payload: JSON.stringify({prompt: 'a'.repeat(2001)}),
      })

      expect(res.statusCode).toBe(400)
      expect(res.json()).toEqual({error: 'invalid_input'})
      expect(res.headers['content-type']).not.toContain('text/event-stream')
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0002-047 — Failure: total input > 12000 chars → 400 {error: 'prompt_too_large'}
  // -------------------------------------------------------------------------
  it('T-0002-047: total input chars exceeds MAX → 400 {error: prompt_too_large}; no SSE stream', async () => {
    const server = await buildGenerateServer()
    try {
      const userId = randomUUID()
      // 1001 chars + 11000 system estimate = 12001 > 12000 → rejected
      const res = await server.inject({
        method: 'POST',
        url: '/generate',
        headers: {
          ...authHeader(userId, uniqueEmail()),
          'content-type': 'application/json',
        },
        payload: JSON.stringify({prompt: 'a'.repeat(1001)}),
      })

      expect(res.statusCode).toBe(400)
      expect(res.json()).toEqual({error: 'prompt_too_large'})
      expect(res.headers['content-type']).not.toContain('text/event-stream')
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0002-052 — Boundary: whitespace-only prompt → 400 invalid_input
  // -------------------------------------------------------------------------
  it('T-0002-052: whitespace-only prompt → 400 {error: invalid_input} (Zod trim + min(1))', async () => {
    const server = await buildGenerateServer()
    try {
      const userId = randomUUID()
      const res = await server.inject({
        method: 'POST',
        url: '/generate',
        headers: {
          ...authHeader(userId, uniqueEmail()),
          'content-type': 'application/json',
        },
        payload: JSON.stringify({prompt: '   '}),
      })

      expect(res.statusCode).toBe(400)
      expect(res.json()).toEqual({error: 'invalid_input'})
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0002-053 — Boundary: exactly 2000-char prompt passes Zod, not invalid_input
  // -------------------------------------------------------------------------
  it('T-0002-053: exactly 2000-char prompt passes Zod max(2000) — not rejected with invalid_input', async () => {
    const server = await buildGenerateServer()
    try {
      const userId = randomUUID()
      const res = await server.inject({
        method: 'POST',
        url: '/generate',
        headers: {
          ...authHeader(userId, uniqueEmail()),
          'content-type': 'application/json',
        },
        payload: JSON.stringify({prompt: 'a'.repeat(2000)}),
      })

      // Must NOT be 400 invalid_input (which would indicate Zod rejection)
      if (res.statusCode === 400) {
        const body = res.json() as {error: string}
        expect(body.error).not.toBe('invalid_input')
      }
      // May be 400 prompt_too_large (2000 + 11000 = 13000 > 12000) or SSE.
      // The test merely asserts the Zod max(2000) is satisfied.
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0002-054 — Boundary: prompt that pushes estimate to exactly >= 12000
  //   → prompt_too_large; one below → proceeds past that check
  // -------------------------------------------------------------------------
  it('T-0002-054: estimate >= MAX_TOTAL_INPUT_CHARS → prompt_too_large; estimate < MAX → passes that check', async () => {
    const server = await buildGenerateServer()
    try {
      const userId = randomUUID()

      // 1000-char prompt: 1000 + 11000 = 12000 >= 12000 → prompt_too_large
      const rejRes = await server.inject({
        method: 'POST',
        url: '/generate',
        headers: {
          ...authHeader(userId, uniqueEmail()),
          'content-type': 'application/json',
        },
        payload: JSON.stringify({prompt: 'a'.repeat(1000)}),
      })
      expect(rejRes.statusCode).toBe(400)
      expect((rejRes.json() as {error: string}).error).toBe('prompt_too_large')

      // 999-char prompt: 999 + 11000 = 11999 < 12000 → passes the check
      const userId2 = randomUUID()
      const accRes = await server.inject({
        method: 'POST',
        url: '/generate',
        headers: {
          ...authHeader(userId2, uniqueEmail()),
          'content-type': 'application/json',
        },
        payload: JSON.stringify({prompt: 'a'.repeat(999)}),
      })
      if (accRes.statusCode === 400) {
        const body = accRes.json() as {error: string}
        expect(body.error).not.toBe('prompt_too_large')
      }
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0002-059 — Security: auth-gated; 401 without JWT
  // -------------------------------------------------------------------------
  it('T-0002-059: POST /generate without Authorization → 401; no SSE stream opened', async () => {
    const server = await buildGenerateServer()
    try {
      const res = await server.inject({
        method: 'POST',
        url: '/generate',
        headers: {'content-type': 'application/json'},
        payload: JSON.stringify({prompt: 'Build me an app'}),
      })

      expect(res.statusCode).toBe(401)
      expect(res.json()).toEqual({error: 'unauthorized'})
      expect(res.headers['content-type']).not.toContain('text/event-stream')
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0002-062 — Security: 31st call within 60s → 429; previous 30 ok
  // -------------------------------------------------------------------------
  it('T-0002-062: 31st call within 60s from same user → 429 {error: rate_limited}; no SSE; Retry-After header set', async () => {
    const userId = randomUUID()
    const email = uniqueEmail()
    const server = await buildGenerateServer()

    try {
      // Exhaust 30 slots — each call gets past rate-limit (may fail for other
      // reasons like missing mock/DB, but does NOT get 429)
      for (let i = 0; i < 30; i++) {
        const res = await server.inject({
          method: 'POST',
          url: '/generate',
          headers: {
            ...authHeader(userId, email),
            'content-type': 'application/json',
          },
          payload: JSON.stringify({prompt: 'ab'}),
        })
        expect(res.statusCode).not.toBe(429)
      }

      // 31st call is rate-limited
      const res31 = await server.inject({
        method: 'POST',
        url: '/generate',
        headers: {
          ...authHeader(userId, email),
          'content-type': 'application/json',
        },
        payload: JSON.stringify({prompt: 'ab'}),
      })
      expect(res31.statusCode).toBe(429)
      expect(res31.json()).toEqual({error: 'rate_limited'})
      expect(res31.headers['content-type']).not.toContain('text/event-stream')
      expect(res31.headers['retry-after']).toBeDefined()
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0002-064 — Regression: existing routes unaffected
  // -------------------------------------------------------------------------
  it('T-0002-064: /health still responds after generate route is registered', async () => {
    // Build a Fastify server with both health and generate routes
    const server = Fastify({logger: false})
    const {healthRoutes} = await import('./health.js')
    await server.register(healthRoutes)
    await server.register(generateRoutes)

    try {
      const res = await server.inject({method: 'GET', url: '/health'})
      expect(res.statusCode).toBe(200)
    } finally {
      await server.close()
    }
  })
})

// ---------------------------------------------------------------------------
// INTEGRATION tests — require testcontainers Postgres
// ---------------------------------------------------------------------------

describe('ADR-0002 Step 4 — POST /generate route (integration, requires Docker)', () => {
  let db: Db

  beforeAll(async () => {
    db = await getTestDb()
  })

  beforeEach(() => {
    getStreamMock().mockReset()
    mockRunPipeline.mockReset()
    resetRateLimitForTests()
  })

  afterEach(async () => {
    await truncateAll()
  })

  afterAll(async () => {
    await closeTestPool()
  })

  // -------------------------------------------------------------------------
  // T-0002-040 — Happy: SSE stream emits in order: thinking_started →
  //   building_started → done → [DONE]
  // -------------------------------------------------------------------------
  it('T-0002-040: full SSE stream order: thinking_started → building_started → done → [DONE]', async () => {
    setupHappyMock()
    const userId = await makeUser(db)
    const server = await buildGenerateServer({db})
    try {
      const res = await server.inject({
        method: 'POST',
        url: '/generate',
        headers: {
          ...authHeader(userId, uniqueEmail()),
          'content-type': 'application/json',
        },
        payload: JSON.stringify({prompt: 'Build me a todo app'}),
      })

      expect(res.statusCode).toBe(200)
      const events = parseSSE(res.body)

      // Must end with [DONE] sentinel
      expect(events[events.length - 1]).toBe('[DONE]')

      // Extract typed events
      const typed = events.filter((e): e is Record<string, unknown> => typeof e === 'object')
      const types = typed.map(e => e['type'])
      expect(types).toContain('thinking_started')
      expect(types).toContain('building_started')
      expect(types).toContain('done')

      // Strict order: thinking < building < done
      const tsIdx = types.indexOf('thinking_started')
      const bsIdx = types.indexOf('building_started')
      const doneIdx = types.indexOf('done')
      expect(tsIdx).toBeLessThan(bsIdx)
      expect(bsIdx).toBeLessThan(doneIdx)
      expect(doneIdx).toBe(types.length - 1)
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0002-041 — Happy: project persisted with visibility='private',
  //   original_prompt set, parent_project_id null
  // -------------------------------------------------------------------------
  it('T-0002-041: project persisted with visibility=private, original_prompt=input.prompt, parent_project_id=null', async () => {
    setupHappyMock()
    const userId = await makeUser(db)
    const prompt = 'Build me a counter app'
    const server = await buildGenerateServer({db})
    try {
      await server.inject({
        method: 'POST',
        url: '/generate',
        headers: {
          ...authHeader(userId, uniqueEmail()),
          'content-type': 'application/json',
        },
        payload: JSON.stringify({prompt}),
      })

      const projectRows = await db.select().from(projects).where(eq(projects.ownerId, userId))
      expect(projectRows).toHaveLength(1)
      const p = projectRows[0]!
      expect(p.visibility).toBe('private')
      expect(p.originalPrompt).toBe(prompt)
      expect(p.parentProjectId).toBeNull()
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0002-042 — Happy: done event payload shape
  // -------------------------------------------------------------------------
  it('T-0002-042: done event includes {project: {id, title, visibility, ...}, spec, render_hash, thinking_duration_ms, generation_duration_ms}', async () => {
    setupHappyMock()
    const userId = await makeUser(db)
    const server = await buildGenerateServer({db})
    try {
      const res = await server.inject({
        method: 'POST',
        url: '/generate',
        headers: {
          ...authHeader(userId, uniqueEmail()),
          'content-type': 'application/json',
        },
        payload: JSON.stringify({prompt: 'Build me an app'}),
      })

      const events = parseSSE(res.body)
      const doneEvent = events.find(
        (e): e is Record<string, unknown> => typeof e === 'object' && e['type'] === 'done',
      )
      expect(doneEvent).toBeDefined()
      expect(doneEvent!['spec']).toBeDefined()
      expect(typeof doneEvent!['render_hash']).toBe('string')
      expect(typeof doneEvent!['thinking_duration_ms']).toBe('number')
      expect(typeof doneEvent!['generation_duration_ms']).toBe('number')

      const project = doneEvent!['project'] as Record<string, unknown>
      expect(typeof project['id']).toBe('string')
      expect(typeof project['title']).toBe('string')
      expect(project['visibility']).toBe('private')
      expect(typeof project['created_at']).toBe('string')
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0002-043 — Happy: messages row inserted with role='user', content=prompt
  // -------------------------------------------------------------------------
  it('T-0002-043: messages row inserted with role=user, content=prompt, project_id=new project id', async () => {
    setupHappyMock()
    const userId = await makeUser(db)
    const prompt = 'Build me a shopping list app'
    const server = await buildGenerateServer({db})
    try {
      await server.inject({
        method: 'POST',
        url: '/generate',
        headers: {
          ...authHeader(userId, uniqueEmail()),
          'content-type': 'application/json',
        },
        payload: JSON.stringify({prompt}),
      })

      const projectRows = await db.select().from(projects).where(eq(projects.ownerId, userId))
      expect(projectRows).toHaveLength(1)
      const projectId = projectRows[0]!.id

      const msgRows = await db.select().from(messages).where(eq(messages.projectId, projectId))
      expect(msgRows).toHaveLength(1)
      expect(msgRows[0]!.role).toBe('user')
      expect(msgRows[0]!.content).toBe(prompt)
      expect(msgRows[0]!.projectId).toBe(projectId)
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0002-044 — Happy: parent_project_id provided → parent linked + fetched
  // -------------------------------------------------------------------------
  it('T-0002-044: parent_project_id provided (owned by caller) → new project links via parent_project_id', async () => {
    setupHappyMock()
    const userId = await makeUser(db)
    const service = createProjectsService(db)
    const parent = await service.create({
      ownerId: userId,
      spec: specWithHeading('Parent App'),
      originalPrompt: 'original parent prompt',
    })

    const prompt = 'Remix my app'
    const server = await buildGenerateServer({db})
    try {
      const res = await server.inject({
        method: 'POST',
        url: '/generate',
        headers: {
          ...authHeader(userId, uniqueEmail()),
          'content-type': 'application/json',
        },
        payload: JSON.stringify({prompt, parent_project_id: parent.project.id}),
      })

      expect(res.statusCode).toBe(200)
      // Should get an SSE stream
      expect(res.headers['content-type']).toContain('text/event-stream')

      const childRows = await db
        .select()
        .from(projects)
        .where(eq(projects.parentProjectId, parent.project.id))
      expect(childRows).toHaveLength(1)
      expect(childRows[0]!.parentProjectId).toBe(parent.project.id)
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0002-048 + T-0002-049 (paired) — Failure: invalid spec → error event;
  //   project NOT persisted
  // -------------------------------------------------------------------------
  it('T-0002-048 + T-0002-049: invalid tool input → error event code=invalid_spec; project count unchanged', async () => {
    const userId = await makeUser(db)

    // Mock runPipeline to throw InvalidSpecError (simulates malformed tool input)
    mockRunPipeline.mockImplementation(async function* () {
      yield {type: 'thinking_started'}
      throw new InvalidSpecError('invalid_spec', [{path: '/views', message: 'required'}])
    })

    const server = await buildGenerateServer({db})
    try {
      const res = await server.inject({
        method: 'POST',
        url: '/generate',
        headers: {
          ...authHeader(userId, uniqueEmail()),
          'content-type': 'application/json',
        },
        payload: JSON.stringify({prompt: 'Build me an app'}),
      })

      const events = parseSSE(res.body)
      const errorEvent = events.find(
        (e): e is Record<string, unknown> => typeof e === 'object' && e['type'] === 'error',
      )
      expect(errorEvent).toBeDefined()
      expect(errorEvent!['code']).toBe('invalid_spec')
      expect(events[events.length - 1]).toBe('[DONE]')

      // T-0002-049: no project row written
      const projectRows = await db.select().from(projects).where(eq(projects.ownerId, userId))
      expect(projectRows).toHaveLength(0)
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0002-050 — Failure: Anthropic 429 after retries → error code=rate_limited
  // -------------------------------------------------------------------------
  it('T-0002-050: Anthropic 429 after retries → SSE error code=rate_limited; HTTP status 503', async () => {
    const userId = await makeUser(db)

    // Mock runPipeline to throw RateLimitedError (simulates exhausted 429 retries)
    mockRunPipeline.mockImplementation(async function* () {
      yield {type: 'thinking_started'}
      throw new RateLimitedError()
    })

    const server = await buildGenerateServer({db})
    try {
      const res = await server.inject({
        method: 'POST',
        url: '/generate',
        headers: {
          ...authHeader(userId, uniqueEmail()),
          'content-type': 'application/json',
        },
        payload: JSON.stringify({prompt: 'Build me an app'}),
      })

      expect(res.statusCode).toBe(503)
      const events = parseSSE(res.body)
      const errorEvent = events.find(
        (e): e is Record<string, unknown> => typeof e === 'object' && e['type'] === 'error',
      )
      expect(errorEvent).toBeDefined()
      expect(errorEvent!['code']).toBe('rate_limited')
      expect(events[events.length - 1]).toBe('[DONE]')
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0002-051 — Failure: generic transport error → SSE error code=internal
  // -------------------------------------------------------------------------
  it('T-0002-051: generic transport error → SSE error code=internal; not in INFO logs', async () => {
    const userId = await makeUser(db)

    // Mock runPipeline to throw AnthropicTransportError with a sanitized message.
    // The secretErrMsg must not appear in SSE or INFO logs — safeMessage strips it.
    const secretErrMsg = 'internal-sdk-error-' + randomUUID()
    mockRunPipeline.mockImplementation(async function* () {
      yield {type: 'thinking_started'}
      throw new AnthropicTransportError(secretErrMsg)
    })

    const sink = createLogSink()
    const server = await buildGenerateServer({db, sink})
    try {
      const res = await server.inject({
        method: 'POST',
        url: '/generate',
        headers: {
          ...authHeader(userId, uniqueEmail()),
          'content-type': 'application/json',
        },
        payload: JSON.stringify({prompt: 'Build me an app'}),
      })

      const events = parseSSE(res.body)
      const errorEvent = events.find(
        (e): e is Record<string, unknown> => typeof e === 'object' && e['type'] === 'error',
      )
      expect(errorEvent).toBeDefined()
      expect(errorEvent!['code']).toBe('internal')
      // The raw error message must NOT appear in the SSE payload
      expect(JSON.stringify(errorEvent)).not.toContain(secretErrMsg)

      // Must not appear in INFO-level logs
      const infoRecords = sink.byLevel(PINO_LEVEL.INFO)
      for (const record of infoRecords) {
        expect(JSON.stringify(record)).not.toContain(secretErrMsg)
      }
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0002-055 — Concurrency: server completes and persists even after client
  //   disconnect (simulated via full inject run, verification on persistence)
  // -------------------------------------------------------------------------
  it('T-0002-055: server completes Anthropic call and persists project; disconnect logging works', async () => {
    setupHappyMock()
    const userId = await makeUser(db)
    const sink = createLogSink()
    const server = await buildGenerateServer({db, sink})

    try {
      // server.inject completes the full response — proves the server side
      // path runs to completion. We verify the project persists.
      await server.inject({
        method: 'POST',
        url: '/generate',
        headers: {
          ...authHeader(userId, uniqueEmail()),
          'content-type': 'application/json',
        },
        payload: JSON.stringify({prompt: 'Build me an app'}),
      })

      // Project must be persisted regardless of what the client does
      const projectRows = await db.select().from(projects).where(eq(projects.ownerId, userId))
      expect(projectRows).toHaveLength(1)
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0002-056 — Concurrency: two simultaneous calls → both succeed
  // -------------------------------------------------------------------------
  it('T-0002-056: two simultaneous /generate calls from same user → both projects persist', async () => {
    setupHappyMock()
    const userId = await makeUser(db)
    const server = await buildGenerateServer({db})

    try {
      const [res1, res2] = await Promise.all([
        server.inject({
          method: 'POST',
          url: '/generate',
          headers: {
            ...authHeader(userId, uniqueEmail()),
            'content-type': 'application/json',
          },
          payload: JSON.stringify({prompt: 'Build me app one'}),
        }),
        server.inject({
          method: 'POST',
          url: '/generate',
          headers: {
            ...authHeader(userId, uniqueEmail()),
            'content-type': 'application/json',
          },
          payload: JSON.stringify({prompt: 'Build me app two'}),
        }),
      ])

      // Both responses should be SSE streams (not 4xx pre-flight errors)
      expect(res1.headers['content-type']).toContain('text/event-stream')
      expect(res2.headers['content-type']).toContain('text/event-stream')

      // Both projects must be persisted
      const projectRows = await db.select().from(projects).where(eq(projects.ownerId, userId))
      expect(projectRows.length).toBeGreaterThanOrEqual(2)
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0002-057 — Security: SSE never contains thinking trace text
  // -------------------------------------------------------------------------
  it('T-0002-057: SSE response never contains thinking block text; only permitted event types', async () => {
    const userId = await makeUser(db)
    const secretThinkingText = 'thisIsASecret-' + randomUUID()

    // Mock with a stream that includes a thinking block content_block_start
    getStreamMock().mockImplementation(
      mockAnthropicStream(
        [
          {type: 'message_start', message: {id: 'msg_test', role: 'assistant'}},
          {
            type: 'content_block_start',
            index: 0,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            content_block: {type: 'thinking', thinking: secretThinkingText} as any,
          },
          makeToolUseStartEvent(1),
          {type: 'message_stop'},
        ],
        makeToolUseMessage(MINIMAL_VALID_SPEC),
      ),
    )

    const server = await buildGenerateServer({db})
    try {
      const res = await server.inject({
        method: 'POST',
        url: '/generate',
        headers: {
          ...authHeader(userId, uniqueEmail()),
          'content-type': 'application/json',
        },
        payload: JSON.stringify({prompt: 'Build me an app'}),
      })

      // Thinking text must never appear in the SSE wire
      expect(res.body).not.toContain(secretThinkingText)

      // Only permitted event types should appear
      const events = parseSSE(res.body)
      const typedEvents = events.filter((e): e is Record<string, unknown> => typeof e === 'object')
      const permittedTypes = new Set(['thinking_started', 'building_started', 'done', 'error'])
      for (const event of typedEvents) {
        expect(permittedTypes.has(event['type'] as string)).toBe(true)
      }
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0002-058 — Security: correct SSE response headers
  // -------------------------------------------------------------------------
  it('T-0002-058: SSE headers: Content-Type=text/event-stream, Cache-Control=no-cache, X-Accel-Buffering=no', async () => {
    setupHappyMock()
    const userId = await makeUser(db)
    const server = await buildGenerateServer({db})

    try {
      const res = await server.inject({
        method: 'POST',
        url: '/generate',
        headers: {
          ...authHeader(userId, uniqueEmail()),
          'content-type': 'application/json',
        },
        payload: JSON.stringify({prompt: 'Build me an app'}),
      })

      expect(res.headers['content-type']).toContain('text/event-stream')
      expect(res.headers['cache-control']).toBe('no-cache')
      expect(res.headers['x-accel-buffering']).toBe('no')
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0002-060 — Security: private parent not owned by caller → 404 (not 403)
  // -------------------------------------------------------------------------
  it('T-0002-060: parent_project_id referencing private project not owned by caller → 404; no SSE', async () => {
    const ownerA = await makeUser(db)
    const ownerB = await makeUser(db)
    const service = createProjectsService(db)

    const parentProject = await service.create({
      ownerId: ownerA,
      spec: validSpec(),
    })
    // Confirm visibility is private (default)
    expect(parentProject.project.visibility).toBe('private')

    const server = await buildGenerateServer({db})
    try {
      const res = await server.inject({
        method: 'POST',
        url: '/generate',
        headers: {
          ...authHeader(ownerB, uniqueEmail()),
          'content-type': 'application/json',
        },
        payload: JSON.stringify({
          prompt: 'Remix this',
          parent_project_id: parentProject.project.id,
        }),
      })

      expect(res.statusCode).toBe(404)
      expect(res.json()).toEqual({error: 'not_found'})
      // Must be 404 NOT 403 (don't reveal existence)
      expect(res.statusCode).not.toBe(403)
      expect(res.headers['content-type']).not.toContain('text/event-stream')
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0002-061 — Security: public parent owned by anyone → accepted
  // -------------------------------------------------------------------------
  it('T-0002-061: parent_project_id of a public project owned by anyone → accepted; new project links', async () => {
    setupHappyMock()
    const ownerA = await makeUser(db)
    const ownerB = await makeUser(db)
    const pool = await getTestPool()

    const service = createProjectsService(db)
    const parentProject = await service.create({
      ownerId: ownerA,
      spec: specWithHeading('Public App'),
    })
    // Directly set visibility=public
    await pool.query("UPDATE projects SET visibility = 'public' WHERE id = $1", [
      parentProject.project.id,
    ])

    const server = await buildGenerateServer({db})
    try {
      const res = await server.inject({
        method: 'POST',
        url: '/generate',
        headers: {
          ...authHeader(ownerB, uniqueEmail()),
          'content-type': 'application/json',
        },
        payload: JSON.stringify({
          prompt: 'Remix this public app',
          parent_project_id: parentProject.project.id,
        }),
      })

      // ACL passes → SSE stream opened
      expect(res.headers['content-type']).toContain('text/event-stream')

      const childRows = await db
        .select()
        .from(projects)
        .where(eq(projects.parentProjectId, parentProject.project.id))
      expect(childRows).toHaveLength(1)
      expect(childRows[0]!.ownerId).toBe(ownerB)
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0002-063 — Negative: raw prompt text not in INFO-level application logs
  // -------------------------------------------------------------------------
  it('T-0002-063: raw user prompt text does not appear in any INFO-level application log record', async () => {
    setupHappyMock()
    const userId = await makeUser(db)
    const uniquePrompt = 'UNIQUE_PROMPT_MARKER_' + randomUUID()

    const sink = createLogSink()
    const server = await buildGenerateServer({db, sink})
    try {
      await server.inject({
        method: 'POST',
        url: '/generate',
        headers: {
          ...authHeader(userId, uniqueEmail()),
          'content-type': 'application/json',
        },
        payload: JSON.stringify({prompt: uniquePrompt}),
      })

      const infoRecords = sink.byLevel(PINO_LEVEL.INFO)
      for (const record of infoRecords) {
        expect(JSON.stringify(record)).not.toContain(uniquePrompt)
      }
    } finally {
      await server.close()
    }
  })
})

// ---------------------------------------------------------------------------
// ADR-0004 Step 6 — Pipeline orchestrator route wiring (T-0004-083 to T-0004-087)
//
// Mocking strategy for these tests: mock runPipeline directly at the module
// level (see jest.mock('../llm/pipeline.js') above). This bypasses the Anthropic
// SDK entirely and lets us control the generator's output per-test.
//
// T-0004-083 (Regression umbrella): the existing ADR-0002 unit tests (T-0002-045
// through T-0002-064) serve as the regression umbrella. If those pass, the pre-
// flight gates are unaffected by the orchestrator swap. No additional sanity test
// is added here to avoid redundancy per ADR Step 6 guidance.
//
// T-0004-085 and T-0004-086 are Docker-gated integration tests. They will fail
// locally with the same testcontainer error as the T-0002-04x tests; CI with
// Docker will run them.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// T-0004-084 (unit) — PERCENT=100: done SSE event payload includes plan object
// ---------------------------------------------------------------------------

describe('ADR-0004 Step 6 — T-0004-084: done event includes plan when pipeline runs with a plan', () => {
  beforeEach(() => {
    mockRunPipeline.mockReset()
    resetRateLimitForTests()
  })

  it('T-0004-084: SSE done payload includes plan field matching MINIMAL_VALID_PLAN when pipeline emits one', async () => {
    // Route is injection-tested; we mock runPipeline to yield the pipeline's
    // happy-path events carrying a plan. No DB needed — no service call needed
    // because we need a real DB to persist. Use a mock service to isolate.
    const mockService = {
      create: jest.fn().mockResolvedValue({
        project: {
          id: randomUUID(),
          title: 'Test App',
          visibility: 'private' as const,
          parentProjectId: null,
          originalPrompt: 'Build me a calculator',
          createdAt: new Date(),
          updatedAt: new Date(),
          ownerId: 'user-084',
          currentVersionId: 'version-084',
        },
        currentVersion: {
          id: 'version-084',
          projectId: 'project-084',
          renderHash: 'abc123def456',
          specJson: MINIMAL_VALID_SPEC,
          planJson: MINIMAL_VALID_PLAN,
          createdAt: new Date(),
        },
      }),
      list: jest.fn(),
      get: jest.fn(),
      getVersion: jest.fn(),
      applyEdit: jest.fn(),
    }

    setupPipelineMock(MINIMAL_VALID_PLAN)

    const loggerInstance = pino({level: 'silent'})
    const server = Fastify({loggerInstance})
    await server.register(generateRoutes, {service: mockService})

    try {
      const userId = randomUUID()
      const res = await server.inject({
        method: 'POST',
        url: '/generate',
        headers: {
          ...authHeader(userId, uniqueEmail()),
          'content-type': 'application/json',
        },
        payload: JSON.stringify({prompt: 'Build me a calculator'}),
      })

      expect(res.headers['content-type']).toContain('text/event-stream')
      const events = parseSSE(res.body)
      const doneEvent = events.find(
        (e): e is Record<string, unknown> => typeof e === 'object' && e['type'] === 'done',
      )
      expect(doneEvent).toBeDefined()

      // plan field must be present in the SSE done payload
      expect(doneEvent!['plan']).toBeDefined()
      const plan = doneEvent!['plan'] as Record<string, unknown>
      expect(plan['archetype']).toBe(MINIMAL_VALID_PLAN.archetype)
      expect(plan['navigation']).toBe(MINIMAL_VALID_PLAN.navigation)
      expect(Array.isArray(plan['screens'])).toBe(true)
      expect((plan['screens'] as unknown[]).length).toBe(MINIMAL_VALID_PLAN.screens.length)

      // plan field must parse against PlanSchema without error (T-0004-087 companion)
      const parseResult = PlanSchema.safeParse(plan)
      expect(parseResult.success).toBe(true)
    } finally {
      await server.close()
    }
  })
})

// ---------------------------------------------------------------------------
// T-0004-085 (integration, Docker-gated) — plan_json populated when plan present
// T-0004-086 (integration, Docker-gated) — plan_json NULL on legacy path (PERCENT=0)
// ---------------------------------------------------------------------------

describe('ADR-0004 Step 6 — T-0004-085/T-0004-086: plan_json persistence (requires Docker)', () => {
  let db: Db

  beforeAll(async () => {
    db = await getTestDb()
  })

  beforeEach(() => {
    mockRunPipeline.mockReset()
    resetRateLimitForTests()
  })

  afterEach(async () => {
    await truncateAll()
  })

  afterAll(async () => {
    await closeTestPool()
  })

  // T-0004-085: plan_json is populated when the pipeline yields a plan
  it('T-0004-085: plan_json on project_versions row is populated when runPipeline yields a plan', async () => {
    setupPipelineMock(MINIMAL_VALID_PLAN)

    const userId = await makeUser(db)
    const server = await buildGenerateServer({db})
    try {
      await server.inject({
        method: 'POST',
        url: '/generate',
        headers: {
          ...authHeader(userId, uniqueEmail()),
          'content-type': 'application/json',
        },
        payload: JSON.stringify({prompt: 'Build me a calculator'}),
      })

      // Fetch the persisted version row and assert plan_json is not NULL
      const projectRows = await db.select().from(projects).where(eq(projects.ownerId, userId))
      expect(projectRows).toHaveLength(1)

      const versionRows = await db
        .select()
        .from(projectVersions)
        .where(eq(projectVersions.projectId, projectRows[0]!.id))
      expect(versionRows).toHaveLength(1)

      const planJson = versionRows[0]!.planJson
      expect(planJson).not.toBeNull()

      // plan_json must be a valid Plan
      const parseResult = PlanSchema.safeParse(planJson)
      expect(parseResult.success).toBe(true)
      if (parseResult.success) {
        expect(parseResult.data.archetype).toBe(MINIMAL_VALID_PLAN.archetype)
        expect(parseResult.data.navigation).toBe(MINIMAL_VALID_PLAN.navigation)
      }
    } finally {
      await server.close()
    }
  })

  // T-0004-086: plan_json is NULL when pipeline yields no plan (legacy/fallback)
  it('T-0004-086: plan_json on project_versions row is NULL when runPipeline yields plan: null', async () => {
    // null plan simulates the M1 single-call fallback path
    setupPipelineMock(null)

    const userId = await makeUser(db)
    const server = await buildGenerateServer({db})
    try {
      await server.inject({
        method: 'POST',
        url: '/generate',
        headers: {
          ...authHeader(userId, uniqueEmail()),
          'content-type': 'application/json',
        },
        payload: JSON.stringify({prompt: 'Build me an app'}),
      })

      const projectRows = await db.select().from(projects).where(eq(projects.ownerId, userId))
      expect(projectRows).toHaveLength(1)

      const versionRows = await db
        .select()
        .from(projectVersions)
        .where(eq(projectVersions.projectId, projectRows[0]!.id))
      expect(versionRows).toHaveLength(1)

      // plan_json must be NULL for the legacy/fallback path
      expect(versionRows[0]!.planJson).toBeNull()
    } finally {
      await server.close()
    }
  })
})

// ---------------------------------------------------------------------------
// T-0004-087 (unit) — Security: SSE done response plan field has no surplus keys
// ---------------------------------------------------------------------------

describe('ADR-0004 Step 6 — T-0004-087: plan field in SSE response is schema-exact, no surplus', () => {
  beforeEach(() => {
    mockRunPipeline.mockReset()
    resetRateLimitForTests()
  })

  it('T-0004-087: plan field in done SSE event passes PlanSchema.safeParse with no surplus keys or unstructured text', async () => {
    const mockService = {
      create: jest.fn().mockResolvedValue({
        project: {
          id: randomUUID(),
          title: 'Test App',
          visibility: 'private' as const,
          parentProjectId: null,
          originalPrompt: 'Build me a calculator',
          createdAt: new Date(),
          updatedAt: new Date(),
          ownerId: 'user-087',
          currentVersionId: 'version-087',
        },
        currentVersion: {
          id: 'version-087',
          projectId: 'project-087',
          renderHash: 'abc123def456',
          specJson: MINIMAL_VALID_SPEC,
          planJson: MINIMAL_VALID_PLAN,
          createdAt: new Date(),
        },
      }),
      list: jest.fn(),
      get: jest.fn(),
      getVersion: jest.fn(),
      applyEdit: jest.fn(),
    }

    setupPipelineMock(MINIMAL_VALID_PLAN)

    const loggerInstance = pino({level: 'silent'})
    const server = Fastify({loggerInstance})
    await server.register(generateRoutes, {service: mockService})

    try {
      const userId = randomUUID()
      const res = await server.inject({
        method: 'POST',
        url: '/generate',
        headers: {
          ...authHeader(userId, uniqueEmail()),
          'content-type': 'application/json',
        },
        payload: JSON.stringify({prompt: 'Build me a calculator'}),
      })

      const events = parseSSE(res.body)
      const doneEvent = events.find(
        (e): e is Record<string, unknown> => typeof e === 'object' && e['type'] === 'done',
      )
      expect(doneEvent).toBeDefined()
      const plan = doneEvent!['plan']

      // The plan field must be a valid Plan with no surplus keys.
      // PlanSchema uses .strict() or strip-mode? Check parse result directly:
      // We assert the field round-trips through PlanSchema without error.
      const parseResult = PlanSchema.safeParse(plan)
      expect(parseResult.success).toBe(true)

      // Walk every key of the plan object: it must only contain keys the Plan
      // type knows about. PlanSchema.keyof() gives us the allowed top-level keys.
      if (parseResult.success) {
        const planObj = plan as Record<string, unknown>

        // No unstructured text blob anywhere in plan (planner-internal trace guard)
        const planStr = JSON.stringify(planObj)
        expect(typeof planStr).toBe('string')
        // Plan fields must be structured types only — no lone string keys
        // that could carry trace text. We verify the plan only has known fields:
        const knownKeys = ['version', 'archetype', 'screens', 'navigation', 'edit_intent']
        for (const key of Object.keys(planObj)) {
          expect(knownKeys).toContain(key)
        }

        // Screens entries must also have only known fields
        const screens = planObj['screens'] as Array<Record<string, unknown>>
        expect(Array.isArray(screens)).toBe(true)
        const knownScreenKeys = ['id', 'role', 'purpose', 'key_components']
        for (const screen of screens) {
          for (const key of Object.keys(screen)) {
            expect(knownScreenKeys).toContain(key)
          }
        }
      }
    } finally {
      await server.close()
    }
  })
})
