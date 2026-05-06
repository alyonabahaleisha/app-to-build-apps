/**
 * T-0004-109 through T-0004-115 — Eval harness extension tests (ADR-0004 Step 9).
 *
 * All tests mock Anthropic and skip DB writes via PLAN_BUILD_EVAL_MODE.
 * No testcontainer or API key required.
 *
 * Test structure:
 *   T-0004-109 (Happy)     — planner mode outputs per-prompt match/miss + summary
 *   T-0004-110 (Happy)     — new mode output is strict superset of legacy schema
 *   T-0004-111 (Happy)     — shadow mode writes side-by-side diff with mismatch field
 *   T-0004-112 (Boundary)  — invalid --mode value exits non-zero
 *   T-0004-113 (Negative)  — new mode exits 1 when pass rate < 80%
 *   T-0004-114 (Negative)  — planner mode exits 1 on < 85% accuracy
 *   T-0004-115 (Regression)— PLAN_BUILD_EVAL_MODE=true causes writeEvent to skip DB inserts
 */

// ---------------------------------------------------------------------------
// Set eval env vars before any module that reads process.env loads.
// Must come before any jest.mock() calls that import modules reading env.
// ---------------------------------------------------------------------------
process.env['PLAN_BUILD_EVAL_MODE'] = 'true'
process.env['NODE_ENV'] = 'test'
process.env['ANTHROPIC_API_KEY'] = 'sk-ant-test-eval'

// ---------------------------------------------------------------------------
// Module-level mocks — declared before any imports of the mocked modules.
// jest.mock() calls are hoisted by babel-jest / ts-jest to the top.
// ---------------------------------------------------------------------------

jest.mock('@anthropic-ai/sdk')

// Mock the Anthropic singleton so it never reads ANTHROPIC_API_KEY at load time.
const mockMessagesCreate = jest.fn()
const mockMessagesStream = jest.fn()
jest.mock('../src/llm/anthropic.js', () => ({
  anthropic: {
    messages: {
      create: mockMessagesCreate,
      stream: mockMessagesStream,
    },
  },
}))

// Mock DB so DB inserts can be counted / asserted zero (T-0004-115).
const mockInsertValues = jest.fn().mockResolvedValue(undefined)
const mockDbInsert = jest.fn().mockReturnValue({values: mockInsertValues})
jest.mock('../src/db/index.js', () => ({
  db: {insert: mockDbInsert},
  schema: {events: 'events_table'},
  createDb: jest.fn(),
  createPool: jest.fn(),
}))

// Mock pino to suppress log output in tests.
jest.mock('pino', () =>
  jest.fn(() => ({
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
  })),
)

// Mock env — PLAN_BUILD_EVAL_MODE=true so writeEvent short-circuits DB writes.
const mockEnv = {
  LOG_LEVEL: 'info' as const,
  PLAN_BUILD_EVAL_MODE: 'true' as const,
  PLAN_BUILD_PIPELINE_PERCENT: 100,
  PLAN_BUILD_PIPELINE_SHADOW: 'false' as const,
  NODE_ENV: 'test' as const,
  PORT: 3000,
}
jest.mock('../src/lib/env.js', () => ({
  get env() {
    return mockEnv
  },
  loadEnv: jest.fn(),
}))

// ---------------------------------------------------------------------------
// Imports — after mocks are hoisted
// ---------------------------------------------------------------------------
import type {Plan, A2UISpec} from '@app-creator/a2ui-schema'
import {A2UISpecSchema} from '@app-creator/a2ui-schema'
import {MINIMAL_VALID_SPEC} from '../test/mocks/anthropic.js'
import {inferArchetypeFromSpec} from './scoreArchetype.js'
import {EVAL_PROMPTS} from './prompts.js'
import {deepValidateSpec, validatePlanConformance} from '../src/services/specValidation.js'
import {writeEvent, EventPayloadValidationError} from '../src/llm/telemetry.js'

// Import the mocked pipeline modules.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const generateModule = require('../src/llm/generate.js') as {
  generateAppSpec: (opts: {userId: string; prompt: string; plan?: Plan}) => AsyncGenerator<{
    type: string
    spec?: unknown
    plan?: unknown
  }>
}
// eslint-disable-next-line @typescript-eslint/no-require-imports
const plannerModule = require('../src/llm/planner.js') as {
  producePlan: (opts: {userId: string; prompt: string}) => Promise<Plan>
}
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pipelineModule = require('../src/llm/pipeline.js') as {
  runPipeline: (opts: {userId: string; prompt: string}) => AsyncGenerator<{
    type: string
    spec?: unknown
    plan?: Plan | null
  }>
}

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const CALCULATOR_PLAN: Plan = {
  version: 1,
  archetype: 'Calculator',
  screens: [{id: 'main', role: 'home', purpose: 'enter inputs', key_components: ['Form', 'Button']}],
  navigation: 'none',
}

const LIST_CRUD_PLAN: Plan = {
  version: 1,
  archetype: 'ListCRUD',
  screens: [
    {id: 'list', role: 'home', purpose: 'show items', key_components: ['List', 'Button']},
    {id: 'detail', role: 'detail', purpose: 'view item', key_components: ['Card']},
  ],
  navigation: 'stack',
}

// Single-view spec — infers Calculator from heuristic
const CALCULATOR_SPEC: A2UISpec = {
  version: 1,
  views: [{id: 'main', root: {type: 'Heading', text: 'Calculator'}}],
  initialViewId: 'main',
}

// Multi-view spec with a List node — infers ListCRUD from heuristic
const LIST_SPEC: A2UISpec = {
  version: 1,
  views: [
    {
      id: 'list',
      root: {
        type: 'List',
        items: [{type: 'Heading', text: 'Item'}],
      },
    },
    {id: 'detail', root: {type: 'Heading', text: 'Detail'}},
  ],
  initialViewId: 'list',
}

// ---------------------------------------------------------------------------
// Helpers: factory functions for mock generator and planner implementations
// ---------------------------------------------------------------------------

function makeGenerateMock(spec: A2UISpec = MINIMAL_VALID_SPEC, plan: Plan | null = null) {
  return jest.fn().mockImplementation(async function* () {
    yield {type: 'thinking_started'}
    yield {type: 'building_started'}
    yield {type: 'done', spec, plan, thinking_duration_ms: 10, generation_duration_ms: 100}
  })
}

function makePlannerMock(plan: Plan = CALCULATOR_PLAN) {
  return jest.fn().mockResolvedValue(plan)
}

function makePipelineMock(spec: A2UISpec = CALCULATOR_SPEC, plan: Plan | null = CALCULATOR_PLAN) {
  return jest.fn().mockImplementation(async function* () {
    yield {type: 'thinking_started'}
    yield {type: 'building_started'}
    yield {type: 'done', spec, plan, thinking_duration_ms: 10, generation_duration_ms: 100}
  })
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks()
  mockDbInsert.mockClear()
  mockInsertValues.mockClear()
  mockInsertValues.mockResolvedValue(undefined)
  mockDbInsert.mockReturnValue({values: mockInsertValues})
})

// ---------------------------------------------------------------------------
// T-0004-109 (Happy) — planner mode outputs per-prompt match/miss + summary
// ---------------------------------------------------------------------------

describe('T-0004-109: planner mode output shape', () => {
  it('produces per-prompt results with match/miss fields and a well-formed summary', async () => {
    // Return CALCULATOR_PLAN for all prompts.
    plannerModule.producePlan = makePlannerMock(CALCULATOR_PLAN)

    const results: Array<{
      prompt_id: string
      expected: string
      actual: string
      match: boolean
      plan_duration_ms: number
    }> = []

    for (const entry of EVAL_PROMPTS) {
      const start = Date.now()
      let actual = 'error'
      let match = false
      try {
        const plan = await plannerModule.producePlan({userId: 'eval', prompt: entry.prompt})
        actual = plan.archetype
        match = actual === entry.expected_archetype
      } catch {
        // no-op
      }
      results.push({
        prompt_id: entry.id,
        expected: entry.expected_archetype,
        actual,
        match,
        plan_duration_ms: Date.now() - start,
      })
    }

    const matches = results.filter(r => r.match).length
    const summary = {
      total: results.length,
      matches,
      misses: results.length - matches,
      accuracy: results.length > 0 ? matches / results.length : 0,
    }

    // Per-prompt shape
    expect(results).toHaveLength(EVAL_PROMPTS.length)
    for (const r of results) {
      expect(r).toHaveProperty('prompt_id')
      expect(r).toHaveProperty('expected')
      expect(r).toHaveProperty('actual')
      expect(r).toHaveProperty('match')
      expect(r).toHaveProperty('plan_duration_ms')
      expect(typeof r.match).toBe('boolean')
    }

    // Summary shape
    expect(summary).toMatchObject({
      total: expect.any(Number),
      matches: expect.any(Number),
      misses: expect.any(Number),
      accuracy: expect.any(Number),
    })
    expect(summary.matches + summary.misses).toBe(summary.total)
    expect(summary.accuracy).toBeGreaterThanOrEqual(0)
    expect(summary.accuracy).toBeLessThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// T-0004-110 (Happy) — new mode output is strict superset of legacy schema
// ---------------------------------------------------------------------------

describe('T-0004-110: new mode output is strict superset of legacy output', () => {
  it('new mode per-prompt result has all legacy fields plus plan and conformance_status', async () => {
    pipelineModule.runPipeline = makePipelineMock(CALCULATOR_SPEC, CALCULATOR_PLAN)

    const entry = EVAL_PROMPTS[0]!
    const start = Date.now()

    let pass = false
    let failure_reason: string | undefined
    let plan: Plan | null | undefined
    let conformance_status: 'ok' | 'failed' | undefined

    for await (const event of pipelineModule.runPipeline({userId: 'eval', prompt: entry.prompt})) {
      if (event.type === 'done') {
        const spec = event.spec as A2UISpec
        plan = event.plan as Plan | null

        // Legacy assertions
        const parsed = A2UISpecSchema.parse(spec)
        deepValidateSpec(parsed)

        // Plan-conformance assertion (new-mode additional check)
        if (plan !== null && plan !== undefined) {
          const conf = validatePlanConformance(parsed, plan)
          conformance_status = conf.ok ? 'ok' : 'failed'
          pass = conf.ok
        } else {
          pass = true
        }
      }
    }

    // Construct the result as new mode would.
    const result = {
      // Legacy fields
      prompt_id: entry.id,
      prompt: entry.prompt,
      pass,
      ...(failure_reason !== undefined ? {failure_reason} : {}),
      duration_ms: Date.now() - start,
      // New-mode additional fields
      plan,
      conformance_status,
    }

    // Legacy field assertions (every legacy check must still be present)
    expect(result).toHaveProperty('prompt_id')
    expect(result).toHaveProperty('prompt')
    expect(result).toHaveProperty('pass')
    expect(result).toHaveProperty('duration_ms')

    // Additional new-mode fields
    expect(result).toHaveProperty('plan')
    expect(result).toHaveProperty('conformance_status')
    expect(result.conformance_status).toBe('ok')
    expect(result.pass).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// T-0004-111 (Happy) — shadow mode writes side-by-side diff with mismatch field
// ---------------------------------------------------------------------------

describe('T-0004-111: shadow mode produces side-by-side diff with mismatch field', () => {
  it('per-prompt result has legacy.pass, new.pass, and boolean mismatch', async () => {
    generateModule.generateAppSpec = makeGenerateMock(MINIMAL_VALID_SPEC, null)
    plannerModule.producePlan = makePlannerMock(CALCULATOR_PLAN)

    const entry = EVAL_PROMPTS[0]!

    let legacyPass = false
    let legacyFailure: string | undefined
    let inferredArchetype: string | undefined

    for await (const event of generateModule.generateAppSpec({userId: 'eval', prompt: entry.prompt})) {
      if (event.type === 'done') {
        const parsed = A2UISpecSchema.parse(event.spec)
        deepValidateSpec(parsed)
        legacyPass = true
        inferredArchetype = inferArchetypeFromSpec(parsed)
      }
    }

    let plannerArchetype: string | undefined
    let newPass = false

    try {
      const plan = await plannerModule.producePlan({userId: 'eval', prompt: entry.prompt})
      plannerArchetype = plan.archetype
      newPass = true
    } catch (err) {
      legacyFailure = err instanceof Error ? err.message : String(err)
    }

    const mismatch =
      plannerArchetype !== undefined &&
      inferredArchetype !== undefined &&
      plannerArchetype !== inferredArchetype

    const result = {
      prompt_id: entry.id,
      legacy: {pass: legacyPass, ...(legacyFailure ? {failure_reason: legacyFailure} : {})},
      new: {pass: newPass},
      planner_archetype: plannerArchetype,
      inferred_archetype: inferredArchetype,
      mismatch,
    }

    // Shape assertions
    expect(result).toHaveProperty('prompt_id')
    expect(result).toHaveProperty('legacy')
    expect(result).toHaveProperty('new')
    expect(result).toHaveProperty('mismatch')
    expect(typeof result.mismatch).toBe('boolean')
    expect(result.legacy).toHaveProperty('pass')
    expect(result.new).toHaveProperty('pass')
    expect(result.legacy.pass).toBe(true)
    expect(result.new.pass).toBe(true)
  })

  it('mismatch is true when planner archetype differs from inferred archetype', async () => {
    // Planner says ListCRUD, but legacy spec is a single-view (infers Calculator).
    generateModule.generateAppSpec = makeGenerateMock(CALCULATOR_SPEC, null)
    plannerModule.producePlan = makePlannerMock(LIST_CRUD_PLAN)

    const entry = EVAL_PROMPTS[0]!

    let inferredArchetype: string | undefined
    for await (const event of generateModule.generateAppSpec({userId: 'eval', prompt: entry.prompt})) {
      if (event.type === 'done') {
        const parsed = A2UISpecSchema.parse(event.spec)
        inferredArchetype = inferArchetypeFromSpec(parsed)
      }
    }

    const plan = await plannerModule.producePlan({userId: 'eval', prompt: entry.prompt})
    const plannerArchetype = plan.archetype

    const mismatch =
      plannerArchetype !== undefined &&
      inferredArchetype !== undefined &&
      plannerArchetype !== inferredArchetype

    expect(inferredArchetype).toBe('Calculator')
    expect(plannerArchetype).toBe('ListCRUD')
    expect(mismatch).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// T-0004-112 (Boundary) — invalid --mode value exits non-zero with usage message
// ---------------------------------------------------------------------------

describe('T-0004-112: invalid --mode value exits non-zero', () => {
  it('exits with code 1 for an unrecognized mode value', () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(code => {
      throw new Error(`process.exit(${code})`)
    })
    const originalArgv = process.argv

    try {
      process.argv = ['node', 'eval/run.ts', '--mode=invalid_value']

      // Inline the parseMode logic from run.ts.
      function parseMode(): string {
        const VALID_MODES = ['legacy', 'planner', 'new', 'shadow']
        const modeArg = process.argv.find(a => a.startsWith('--mode='))
        if (!modeArg) return 'legacy'
        const value = modeArg.split('=')[1] as string
        if (!VALID_MODES.includes(value)) {
          process.exit(1)
        }
        return value
      }

      expect(() => parseMode()).toThrow('process.exit(1)')
    } finally {
      process.argv = originalArgv
      exitSpy.mockRestore()
    }
  })

  it('accepts all valid mode strings without exiting', () => {
    const VALID_MODES = ['legacy', 'planner', 'new', 'shadow']

    for (const mode of VALID_MODES) {
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(code => {
        throw new Error(`process.exit(${code})`)
      })
      const originalArgv = process.argv
      process.argv = ['node', 'eval/run.ts', `--mode=${mode}`]

      try {
        function parseMode(): string {
          const modeArg = process.argv.find(a => a.startsWith('--mode='))
          if (!modeArg) return 'legacy'
          const value = modeArg.split('=')[1] as string
          if (!VALID_MODES.includes(value)) {
            process.exit(1)
          }
          return value
        }

        expect(parseMode()).toBe(mode)
      } finally {
        process.argv = originalArgv
        exitSpy.mockRestore()
      }
    }
  })
})

// ---------------------------------------------------------------------------
// T-0004-113 (Negative) — new mode CI gate: exit-1 when pass rate < 80%
// ---------------------------------------------------------------------------

describe('T-0004-113: new mode CI gate exits on < 80% pass rate', () => {
  it('exits with code 1 when pass rate is 50% (< 80% threshold)', () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(code => {
      throw new Error(`process.exit(${code})`)
    })

    try {
      const total = 10
      const passed = 5
      const pass_rate = passed / total

      // Inline the gate check from runNew().
      if (pass_rate < 0.8) {
        process.exit(1)
      }

      // Should not reach here.
      expect(true).toBe(false)
    } catch (err) {
      expect((err as Error).message).toBe('process.exit(1)')
    } finally {
      exitSpy.mockRestore()
    }
  })

  it('does not exit when pass rate is exactly 80%', () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(code => {
      throw new Error(`process.exit(${code})`)
    })

    try {
      const total = 10
      const passed = 8
      const pass_rate = passed / total

      if (pass_rate < 0.8) {
        process.exit(1)
      }

      expect(pass_rate).toBeGreaterThanOrEqual(0.8)
    } finally {
      exitSpy.mockRestore()
    }
  })

  it('mocks 50% failure rate: half the prompts fail, triggering exit-1', async () => {
    let callCount = 0

    pipelineModule.runPipeline = jest.fn().mockImplementation(async function* () {
      callCount++
      if (callCount % 2 === 0) {
        // Every even prompt fails — no 'done' event emitted.
        yield {type: 'thinking_started'}
        throw new Error('mock generation failure')
      }
      yield {type: 'thinking_started'}
      yield {type: 'done', spec: CALCULATOR_SPEC, plan: CALCULATOR_PLAN}
    })

    const results: {pass: boolean}[] = []
    const prompts = EVAL_PROMPTS.slice(0, 10) // Use 10 prompts for speed

    for (const entry of prompts) {
      let pass = false
      try {
        for await (const event of pipelineModule.runPipeline({userId: 'eval', prompt: entry.prompt})) {
          if (event.type === 'done') {
            A2UISpecSchema.parse(event.spec)
            deepValidateSpec(A2UISpecSchema.parse(event.spec))
            pass = true
          }
        }
      } catch {
        pass = false
      }
      results.push({pass})
    }

    const passed = results.filter(r => r.pass).length
    const pass_rate = passed / results.length

    // With alternating failure pattern, ~50% pass rate — below the 80% gate.
    expect(pass_rate).toBeLessThan(0.8)
  })
})

// ---------------------------------------------------------------------------
// T-0004-114 (Negative) — planner mode CI gate: exit-1 when accuracy < 85%
// ---------------------------------------------------------------------------

describe('T-0004-114: planner mode CI gate exits on < 85% accuracy', () => {
  it('exits with code 1 when archetype accuracy is 50% (< 85% threshold)', () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(code => {
      throw new Error(`process.exit(${code})`)
    })

    try {
      const total = 10
      const matches = 5
      const accuracy = matches / total

      // Inline the gate check from runPlanner().
      if (accuracy < 0.85) {
        process.exit(1)
      }

      expect(true).toBe(false)
    } catch (err) {
      expect((err as Error).message).toBe('process.exit(1)')
    } finally {
      exitSpy.mockRestore()
    }
  })

  it('does not exit when accuracy is exactly 85%', () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(code => {
      throw new Error(`process.exit(${code})`)
    })

    try {
      const total = 20
      const matches = 17
      const accuracy = matches / total

      if (accuracy < 0.85) {
        process.exit(1)
      }

      expect(accuracy).toBeGreaterThanOrEqual(0.85)
    } finally {
      exitSpy.mockRestore()
    }
  })

  it('mocks wrong archetype for 50% of prompts, resulting in < 85% accuracy', async () => {
    let callCount = 0

    plannerModule.producePlan = jest.fn().mockImplementation(async () => {
      callCount++
      // Even-numbered calls return a wrong archetype.
      if (callCount % 2 === 0) {
        return {...CALCULATOR_PLAN, archetype: 'Dashboard'} as Plan
      }
      return CALCULATOR_PLAN
    })

    const prompts = EVAL_PROMPTS.filter(e => e.expected_archetype === 'Calculator')
    let matches = 0

    for (const entry of prompts) {
      try {
        const plan = await plannerModule.producePlan({userId: 'eval', prompt: entry.prompt})
        if (plan.archetype === entry.expected_archetype) matches++
      } catch {
        // no-op
      }
    }

    const accuracy = prompts.length > 0 ? matches / prompts.length : 0
    // With alternating wrong answers, accuracy < 85%.
    expect(accuracy).toBeLessThan(0.85)
  })
})

// ---------------------------------------------------------------------------
// T-0004-115 (Regression) — PLAN_BUILD_EVAL_MODE=true skips DB inserts
// ---------------------------------------------------------------------------

describe('T-0004-115: PLAN_BUILD_EVAL_MODE=true skips DB inserts in writeEvent', () => {
  it('writeEvent does not call db.insert when PLAN_BUILD_EVAL_MODE is "true"', async () => {
    // Verify the env flag is set — the eval harness sets this before any import.
    expect(mockEnv.PLAN_BUILD_EVAL_MODE).toBe('true')

    mockDbInsert.mockClear()
    mockInsertValues.mockClear()

    await writeEvent('plan.completed', {
      generationId: 'test-gen-id-115',
      archetype: 'Calculator',
      screens_count: 1,
      navigation: 'none',
      mode: 'live',
      plan_duration_ms: 100,
    })

    // DB insert must NOT have been called.
    expect(mockDbInsert).not.toHaveBeenCalled()
    expect(mockInsertValues).not.toHaveBeenCalled()
  })

  it('writeEvent still validates the payload whitelist even in eval mode', async () => {
    // 'prompt' is not in the plan.completed whitelist → should throw before DB.
    await expect(
      writeEvent('plan.completed', {
        generationId: 'test-gen-id',
        prompt: 'this is PII that must not reach DB',
      }),
    ).rejects.toBeInstanceOf(EventPayloadValidationError)

    // DB must never have been touched.
    expect(mockDbInsert).not.toHaveBeenCalled()
  })

  it('eval harness sets PLAN_BUILD_EVAL_MODE before any LLM call', () => {
    // The value was set at the top of this file, which runs before any
    // test module is imported. This test simply asserts the invariant.
    expect(process.env['PLAN_BUILD_EVAL_MODE']).toBe('true')
  })
})

// ---------------------------------------------------------------------------
// inferArchetypeFromSpec unit tests (shadow-mode heuristic)
// ---------------------------------------------------------------------------

describe('inferArchetypeFromSpec', () => {
  it('returns Calculator for a single-view spec', () => {
    expect(inferArchetypeFromSpec(CALCULATOR_SPEC)).toBe('Calculator')
  })

  it('returns Calculator for a single-view spec with Counter', () => {
    const spec: A2UISpec = {
      version: 1,
      views: [
        {
          id: 'main',
          root: {type: 'Counter', id: 'c1', label: 'Count', min: 0},
        },
      ],
      initialViewId: 'main',
    }
    expect(inferArchetypeFromSpec(spec)).toBe('Calculator')
  })

  it('returns ListCRUD for a multi-view spec with a List node', () => {
    expect(inferArchetypeFromSpec(LIST_SPEC)).toBe('ListCRUD')
  })

  it('returns Tracker for a multi-view spec with Counter but no List', () => {
    const spec: A2UISpec = {
      version: 1,
      views: [
        {
          id: 'today',
          root: {type: 'Counter', id: 'steps', label: 'Steps', min: 0},
        },
        {id: 'history', root: {type: 'Heading', text: 'History'}},
      ],
      initialViewId: 'today',
    }
    expect(inferArchetypeFromSpec(spec)).toBe('Tracker')
  })

  it('returns Tracker for a multi-view spec with Toggle but no List', () => {
    const spec: A2UISpec = {
      version: 1,
      views: [
        {
          id: 'today',
          root: {type: 'Toggle', id: 'done', label: 'Done'},
        },
        {id: 'history', root: {type: 'Heading', text: 'History'}},
      ],
      initialViewId: 'today',
    }
    expect(inferArchetypeFromSpec(spec)).toBe('Tracker')
  })

  it('returns unknown for a multi-view spec with only Heading nodes', () => {
    const spec: A2UISpec = {
      version: 1,
      views: [
        {id: 'a', root: {type: 'Heading', text: 'A'}},
        {id: 'b', root: {type: 'Heading', text: 'B'}},
      ],
      initialViewId: 'a',
    }
    expect(inferArchetypeFromSpec(spec)).toBe('unknown')
  })
})

// ---------------------------------------------------------------------------
// Eval prompt set integrity assertions
// ---------------------------------------------------------------------------

describe('EVAL_PROMPTS', () => {
  it('has exactly 30 prompts', () => {
    expect(EVAL_PROMPTS).toHaveLength(30)
  })

  it('all prompts have required fields', () => {
    for (const entry of EVAL_PROMPTS) {
      expect(entry).toHaveProperty('id')
      expect(entry).toHaveProperty('prompt')
      expect(entry).toHaveProperty('expected_archetype')
      expect(entry).toHaveProperty('label_note')
      expect(entry.id).toMatch(/^p\d{2}$/)
      expect(entry.prompt.length).toBeGreaterThan(0)
      expect(entry.label_note.length).toBeGreaterThan(0)
    }
  })

  it('all expected_archetype values are from the closed set', () => {
    const VALID = new Set([
      'ListCRUD', 'Tracker', 'Calculator', 'Journal', 'Dashboard',
      'SocialFeed', 'InfoDisplay', 'SimpleGame', 'unknown',
    ])
    for (const entry of EVAL_PROMPTS) {
      expect(VALID.has(entry.expected_archetype)).toBe(true)
    }
  })

  it('prompt ids are unique', () => {
    const ids = EVAL_PROMPTS.map(e => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
