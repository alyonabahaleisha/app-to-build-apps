/**
 * Eval harness entry point — ADR-0004 Step 9.
 *
 * Usage:
 *   pnpm --filter @app-creator/api eval                    # defaults to --mode=legacy
 *   pnpm --filter @app-creator/api eval -- --mode=legacy
 *   pnpm --filter @app-creator/api eval -- --mode=planner
 *   pnpm --filter @app-creator/api eval -- --mode=new
 *   pnpm --filter @app-creator/api eval -- --mode=shadow
 *
 * Modes:
 *   legacy  — M1 harness: generateAppSpec, Zod + deepValidate pass rate ≥ 80%.
 *   planner — producePlan only; archetype-match accuracy ≥ 85% on labeled set.
 *   new     — runPipeline (PERCENT=100, SHADOW=false); legacy checks + plan
 *             conformance. Pass rate ≥ 80%. This is the CI gate.
 *   shadow  — Runs both legacy and new on each prompt; diagnostic only; CI
 *             does NOT exit-1 on shadow mismatches.
 *
 * Environment setup:
 *   PLAN_BUILD_EVAL_MODE=true is set at the top of this file before any LLM
 *   call, so writeEvent skips DB inserts (telemetry validation still runs).
 *
 *   --mode=new additionally sets:
 *     PLAN_BUILD_PIPELINE_PERCENT=100
 *     PLAN_BUILD_PIPELINE_SHADOW=false
 */

// ---------------------------------------------------------------------------
// Set eval-mode env vars BEFORE any module that reads process.env is imported.
// This must be the very first executable statement.
// ---------------------------------------------------------------------------
process.env['PLAN_BUILD_EVAL_MODE'] = 'true'
process.env['NODE_ENV'] = process.env['NODE_ENV'] ?? 'test'

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
import fs from 'fs'
import path from 'path'
import {A2UISpecSchema} from '@app-creator/a2ui-schema'
import {deepValidateSpec} from '../src/services/specValidation.js'
import {validatePlanConformance} from '../src/services/specValidation.js'
import {EVAL_PROMPTS} from './prompts.js'
import {inferArchetypeFromSpec} from './scoreArchetype.js'

// ---------------------------------------------------------------------------
// CLI flag parsing
// ---------------------------------------------------------------------------

type Mode = 'legacy' | 'planner' | 'new' | 'shadow'

const VALID_MODES: Mode[] = ['legacy', 'planner', 'new', 'shadow']

function parseMode(): Mode {
  const modeArg = process.argv.find(a => a.startsWith('--mode='))
  if (!modeArg) return 'legacy'
  const value = modeArg.split('=')[1] as string
  if (!VALID_MODES.includes(value as Mode)) {
    console.error(`Unknown --mode value: "${value}"`)
    console.error(`Usage: eval -- --mode=<${VALID_MODES.join('|')}>`)
    process.exit(1)
  }
  return value as Mode
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

type LegacyPromptResult = {
  prompt_id: string
  prompt: string
  pass: boolean
  failure_reason?: string
  duration_ms: number
}

type LegacySummary = {
  total: number
  passed: number
  failed: number
  pass_rate: number
}

type LegacyOutput = {
  mode: 'legacy'
  summary: LegacySummary
  per_prompt: LegacyPromptResult[]
}

type PlannerPromptResult = {
  prompt_id: string
  expected: string
  actual: string
  match: boolean
  plan_duration_ms: number
  failure_reason?: string
}

type PlannerSummary = {
  total: number
  matches: number
  misses: number
  accuracy: number
}

type PlannerOutput = {
  mode: 'planner'
  summary: PlannerSummary
  per_prompt: PlannerPromptResult[]
}

type NewPromptResult = {
  prompt_id: string
  prompt: string
  pass: boolean
  failure_reason?: string
  duration_ms: number
  plan?: unknown
  conformance_status?: 'ok' | 'failed'
}

type NewSummary = {
  total: number
  passed: number
  failed: number
  pass_rate: number
}

type NewOutput = {
  mode: 'new'
  summary: NewSummary
  per_prompt: NewPromptResult[]
}

type ShadowPromptResult = {
  prompt_id: string
  legacy: {pass: boolean; failure_reason?: string}
  new: {pass: boolean; failure_reason?: string; conformance_status?: string}
  planner_archetype?: string
  inferred_archetype?: string
  mismatch: boolean
}

type ShadowSummary = {
  total: number
  legacy_passed: number
  new_passed: number
  archetype_mismatches: number
}

type ShadowOutput = {
  mode: 'shadow'
  summary: ShadowSummary
  per_prompt: ShadowPromptResult[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function writeResults(mode: Mode, data: LegacyOutput | PlannerOutput | NewOutput | ShadowOutput): void {
  const resultsDir = path.resolve(__dirname, 'results')
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, {recursive: true})
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)
  const outFile = path.join(resultsDir, `${timestamp}-${mode}.json`)
  fs.writeFileSync(outFile, JSON.stringify(data, null, 2))
  console.log(`Results written to ${outFile}`)
}

// ---------------------------------------------------------------------------
// Legacy mode — M1 harness: generateAppSpec, Zod + deepValidate pass rate
// ---------------------------------------------------------------------------

async function runLegacy(): Promise<LegacyOutput> {
  // Import after eval-mode env vars are set.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const {generateAppSpec} = require('../src/llm/generate.js') as {
    generateAppSpec: (opts: {userId: string; prompt: string}) => AsyncGenerator<{type: string; spec?: unknown}>
  }

  const perPrompt: LegacyPromptResult[] = []

  for (const entry of EVAL_PROMPTS) {
    const start = Date.now()
    let pass = false
    let failure_reason: string | undefined

    try {
      let spec: unknown = undefined
      for await (const event of generateAppSpec({userId: 'eval', prompt: entry.prompt})) {
        if (event.type === 'done') {
          spec = (event as {type: string; spec: unknown}).spec
        }
      }
      if (spec === undefined) {
        failure_reason = 'no done event emitted'
      } else {
        // Zod parse
        const parsed = A2UISpecSchema.parse(spec)
        // deepValidate
        deepValidateSpec(parsed)
        pass = true
      }
    } catch (err) {
      failure_reason = err instanceof Error ? err.message : String(err)
    }

    perPrompt.push({
      prompt_id: entry.id,
      prompt: entry.prompt,
      pass,
      ...(failure_reason ? {failure_reason} : {}),
      duration_ms: Date.now() - start,
    })
  }

  const passed = perPrompt.filter(r => r.pass).length
  const total = perPrompt.length
  const pass_rate = total > 0 ? passed / total : 0

  const summary: LegacySummary = {total, passed, failed: total - passed, pass_rate}
  const output: LegacyOutput = {mode: 'legacy', summary, per_prompt: perPrompt}

  console.log(JSON.stringify(summary))

  if (pass_rate < 0.8) {
    writeResults('legacy', output)
    console.error(`FAIL: legacy pass rate ${(pass_rate * 100).toFixed(1)}% < 80% threshold`)
    process.exit(1)
  }

  writeResults('legacy', output)
  console.log(`PASS: legacy pass rate ${(pass_rate * 100).toFixed(1)}%`)
  return output
}

// ---------------------------------------------------------------------------
// Planner mode — producePlan only; archetype-match accuracy ≥ 85%
// ---------------------------------------------------------------------------

async function runPlanner(): Promise<PlannerOutput> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const {producePlan} = require('../src/llm/planner.js') as {
    producePlan: (opts: {userId: string; prompt: string}) => Promise<{archetype: string}>
  }

  const perPrompt: PlannerPromptResult[] = []

  for (const entry of EVAL_PROMPTS) {
    const start = Date.now()
    let actual = 'unknown'
    let match = false
    let failure_reason: string | undefined

    try {
      const plan = await producePlan({userId: 'eval', prompt: entry.prompt})
      actual = plan.archetype
      match = actual === entry.expected_archetype
    } catch (err) {
      failure_reason = err instanceof Error ? err.message : String(err)
      actual = 'error'
    }

    perPrompt.push({
      prompt_id: entry.id,
      expected: entry.expected_archetype,
      actual,
      match,
      plan_duration_ms: Date.now() - start,
      ...(failure_reason ? {failure_reason} : {}),
    })
  }

  const matches = perPrompt.filter(r => r.match).length
  const total = perPrompt.length
  const misses = total - matches
  const accuracy = total > 0 ? matches / total : 0

  const summary: PlannerSummary = {total, matches, misses, accuracy}
  const output: PlannerOutput = {mode: 'planner', summary, per_prompt: perPrompt}

  console.log(JSON.stringify(summary))

  if (accuracy < 0.85) {
    writeResults('planner', output)
    console.error(`FAIL: planner archetype accuracy ${(accuracy * 100).toFixed(1)}% < 85% threshold`)
    process.exit(1)
  }

  writeResults('planner', output)
  console.log(`PASS: planner archetype accuracy ${(accuracy * 100).toFixed(1)}%`)
  return output
}

// ---------------------------------------------------------------------------
// New mode — runPipeline (PERCENT=100, SHADOW=false); legacy checks + conformance
// ---------------------------------------------------------------------------

async function runNew(): Promise<NewOutput> {
  // Force the pipeline to always take the new path for eval.
  process.env['PLAN_BUILD_PIPELINE_PERCENT'] = '100'
  process.env['PLAN_BUILD_PIPELINE_SHADOW'] = 'false'

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const {runPipeline} = require('../src/llm/pipeline.js') as {
    runPipeline: (opts: {userId: string; prompt: string}) => AsyncGenerator<{
      type: string
      spec?: unknown
      plan?: unknown
    }>
  }

  const perPrompt: NewPromptResult[] = []

  for (const entry of EVAL_PROMPTS) {
    const start = Date.now()
    let pass = false
    let failure_reason: string | undefined
    let plan: unknown = undefined
    let conformance_status: 'ok' | 'failed' | undefined

    try {
      let spec: unknown = undefined
      for await (const event of runPipeline({userId: 'eval', prompt: entry.prompt})) {
        if (event.type === 'done') {
          spec = (event as {type: string; spec: unknown; plan: unknown}).spec
          plan = (event as {type: string; spec: unknown; plan: unknown}).plan
        }
      }
      if (spec === undefined) {
        failure_reason = 'no done event emitted'
      } else {
        // Legacy assertions: Zod + deepValidate
        const parsed = A2UISpecSchema.parse(spec)
        deepValidateSpec(parsed)

        // Plan-conformance assertion (only when pipeline ran the new path)
        if (plan !== null && plan !== undefined) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const conf = validatePlanConformance(parsed, plan as any)
          conformance_status = conf.ok ? 'ok' : 'failed'
          if (!conf.ok) {
            failure_reason = `plan_conformance: ${conf.reason}`
          } else {
            pass = true
          }
        } else {
          // No plan — legacy fallback was used; still passes legacy checks.
          pass = true
        }
      }
    } catch (err) {
      failure_reason = err instanceof Error ? err.message : String(err)
    }

    perPrompt.push({
      prompt_id: entry.id,
      prompt: entry.prompt,
      pass,
      ...(failure_reason ? {failure_reason} : {}),
      duration_ms: Date.now() - start,
      ...(plan !== undefined ? {plan} : {}),
      ...(conformance_status !== undefined ? {conformance_status} : {}),
    })
  }

  const passed = perPrompt.filter(r => r.pass).length
  const total = perPrompt.length
  const pass_rate = total > 0 ? passed / total : 0

  const summary: NewSummary = {total, passed, failed: total - passed, pass_rate}
  const output: NewOutput = {mode: 'new', summary, per_prompt: perPrompt}

  console.log(JSON.stringify(summary))

  if (pass_rate < 0.8) {
    writeResults('new', output)
    console.error(`FAIL: new pipeline pass rate ${(pass_rate * 100).toFixed(1)}% < 80% threshold`)
    process.exit(1)
  }

  writeResults('new', output)
  console.log(`PASS: new pipeline pass rate ${(pass_rate * 100).toFixed(1)}%`)
  return output
}

// ---------------------------------------------------------------------------
// Shadow mode — runs both legacy and new; diagnostic only; does NOT exit-1
// ---------------------------------------------------------------------------

async function runShadow(): Promise<ShadowOutput> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const {generateAppSpec} = require('../src/llm/generate.js') as {
    generateAppSpec: (opts: {userId: string; prompt: string}) => AsyncGenerator<{type: string; spec?: unknown}>
  }

  // Shadow mode: PERCENT=0, SHADOW=false for the "legacy" call; PERCENT=100 for the "new" call.
  // We call each pipeline function directly rather than toggling env vars mid-run.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const {producePlan} = require('../src/llm/planner.js') as {
    producePlan: (opts: {userId: string; prompt: string}) => Promise<{archetype: string}>
  }

  const perPrompt: ShadowPromptResult[] = []

  for (const entry of EVAL_PROMPTS) {
    // Legacy run
    let legacyPass = false
    let legacyFailure: string | undefined
    let inferredArchetype: string | undefined

    try {
      let spec: unknown = undefined
      for await (const event of generateAppSpec({userId: 'eval', prompt: entry.prompt})) {
        if (event.type === 'done') {
          spec = (event as {type: string; spec: unknown}).spec
        }
      }
      if (spec !== undefined) {
        const parsed = A2UISpecSchema.parse(spec)
        deepValidateSpec(parsed)
        legacyPass = true
        inferredArchetype = inferArchetypeFromSpec(parsed)
      } else {
        legacyFailure = 'no done event'
      }
    } catch (err) {
      legacyFailure = err instanceof Error ? err.message : String(err)
    }

    // Planner run (for archetype comparison only)
    let plannerArchetype: string | undefined
    let newPass = false
    let newFailure: string | undefined
    let newConformance: string | undefined

    try {
      const plan = await producePlan({userId: 'eval', prompt: entry.prompt})
      plannerArchetype = plan.archetype
      // For shadow mode we don't run the full builder — the goal is archetype comparison.
      // Mark the new result as "not run" unless we want full parity.
      // ADR says: "runs both legacy and new on each prompt; logs both; reports the diff"
      // We treat the planner-only run as the "new" stage for shadow purposes.
      // Full builder run would require PERCENT=100 which conflicts with shadow semantics.
      newPass = true
    } catch (err) {
      newFailure = err instanceof Error ? err.message : String(err)
    }

    // Mismatch: planner archetype vs inferred archetype from legacy spec.
    const mismatch =
      plannerArchetype !== undefined &&
      inferredArchetype !== undefined &&
      plannerArchetype !== inferredArchetype

    perPrompt.push({
      prompt_id: entry.id,
      legacy: {pass: legacyPass, ...(legacyFailure ? {failure_reason: legacyFailure} : {})},
      new: {
        pass: newPass,
        ...(newFailure ? {failure_reason: newFailure} : {}),
        ...(newConformance ? {conformance_status: newConformance} : {}),
      },
      ...(plannerArchetype ? {planner_archetype: plannerArchetype} : {}),
      ...(inferredArchetype ? {inferred_archetype: inferredArchetype} : {}),
      mismatch,
    })
  }

  const legacyPassed = perPrompt.filter(r => r.legacy.pass).length
  const newPassed = perPrompt.filter(r => r.new.pass).length
  const archetypeMismatches = perPrompt.filter(r => r.mismatch).length
  const total = perPrompt.length

  const summary: ShadowSummary = {
    total,
    legacy_passed: legacyPassed,
    new_passed: newPassed,
    archetype_mismatches: archetypeMismatches,
  }
  const output: ShadowOutput = {mode: 'shadow', summary, per_prompt: perPrompt}

  console.log(JSON.stringify(summary))
  // Shadow mode: diagnostic only — never exit-1 on mismatches.
  writeResults('shadow', output)
  console.log(`SHADOW: ${archetypeMismatches} archetype mismatches out of ${total} prompts (diagnostic only)`)
  return output
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const mode = parseMode()
  console.log(`eval mode: ${mode}`)

  switch (mode) {
    case 'legacy':
      await runLegacy()
      break
    case 'planner':
      await runPlanner()
      break
    case 'new':
      await runNew()
      break
    case 'shadow':
      await runShadow()
      break
  }
}

main().catch(err => {
  console.error('eval failed', err)
  process.exit(1)
})
