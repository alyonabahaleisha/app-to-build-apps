// EVAL_MODE must be the first executable statement — T-0007-169.
process.env['EVAL_MODE'] = 'true'
process.env['NODE_ENV'] = process.env['NODE_ENV'] ?? 'test'

/**
 * Eval harness entry point — V0 (ADR-0007 Step 7).
 *
 * Modes:
 *   --mode=v0                        (default) — runs 100 archetype prompts, threshold ≥90% overall / ≥80% per archetype
 *   --mode=out-of-scope-detection    — runs 30 detection prompts, threshold ≥95%
 *   --mode=out-of-scope-false-positive — runs 30 false-positive prompts, threshold ≤5% false-positive rate
 *
 * Retired modes: legacy, planner, new, shadow — T-0007-173.
 *
 * Environment:
 *   ANTHROPIC_API_KEY — required for live mode.
 *   EVAL_MODE=true    — set above; short-circuits telemetry DB writes.
 *
 * Results are written to services/api/eval/results/{ISO-timestamp}-{mode}.json.
 * The results JSON does not contain raw prompts — only prompt_id (T-0007-171).
 *
 * Prompts are processed sequentially to avoid Anthropic rate-limit storms (T-0007-177).
 */

import {existsSync, mkdirSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'

import {validateCrossRefs} from '@app-creator/protocol'

import {generateAppSpec} from '../src/llm/generate.js'
import type {V0Archetype} from './prompts.js'
import {
  ARCHETYPE_PROMPTS,
  OUT_OF_SCOPE_DETECTION_PROMPTS,
  OUT_OF_SCOPE_FALSE_POSITIVE_PROMPTS,
} from './prompts.js'
import {scoreArchetype} from './scoreArchetype.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EvalMode = 'v0' | 'out-of-scope-detection' | 'out-of-scope-false-positive'

const VALID_MODES: EvalMode[] = ['v0', 'out-of-scope-detection', 'out-of-scope-false-positive']

type PerPromptResult = {
  prompt_id: string
  passed: boolean
  expected: string
  actual: string | null
  error?: string
}

type EvalResults = {
  mode: EvalMode
  timestamp: string
  summary: Record<string, number | string>
  per_prompt: PerPromptResult[]
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseMode(): EvalMode {
  const modeArg = process.argv.find(a => a.startsWith('--mode='))
  if (!modeArg) return 'v0'

  const value = modeArg.replace('--mode=', '')
  if ((VALID_MODES as string[]).includes(value)) {
    return value as EvalMode
  }

  const modes = VALID_MODES.join(', ')
  console.error(`FAIL: unknown mode '${value}'`)
  console.error(`Usage: tsx eval/run.ts [--mode=<mode>]`)
  console.error(`Valid modes: ${modes}`)
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Results writer — T-0007-170, T-0007-171, T-0007-172
// ---------------------------------------------------------------------------

const RESULTS_DIR = join(__dirname, 'results')

function writeResults(mode: EvalMode, results: EvalResults): void {
  if (!existsSync(RESULTS_DIR)) {
    mkdirSync(RESULTS_DIR, {recursive: true})
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = `${timestamp}-${mode}.json`
  const filepath = join(RESULTS_DIR, filename)
  writeFileSync(filepath, JSON.stringify(results, null, 2), 'utf-8')
  console.log(`Results written to ${filepath}`)
}

// ---------------------------------------------------------------------------
// Drain the generator — consume all events and collect the final event.
// ---------------------------------------------------------------------------

async function drainGenerator(gen: ReturnType<typeof generateAppSpec>) {
  let last = null
  for await (const event of gen) {
    last = event
  }
  return last
}

// ---------------------------------------------------------------------------
// Mode: v0 — T-0007-160, T-0007-161, T-0007-162
// ---------------------------------------------------------------------------

async function runV0Mode(): Promise<boolean> {
  const results: PerPromptResult[] = []

  console.log(`Running v0 mode — ${ARCHETYPE_PROMPTS.length} prompts...`)

  for (const entry of ARCHETYPE_PROMPTS) {
    let passed = false
    let actual: string | null = null
    let error: string | undefined

    try {
      const gen = generateAppSpec({userId: 'eval-user', prompt: entry.prompt})
      const finalEvent = await drainGenerator(gen)

      if (finalEvent && finalEvent.type === 'done') {
        // SpecSchema.parse + validateCrossRefs ran inside generateAppSpec.
        // Archetype match is the additional eval-level check.
        const spec = finalEvent.spec
        // Re-validate cross refs here in case the harness is run against a mocked pipeline.
        const crossRef = validateCrossRefs(spec)
        if (!crossRef.ok) {
          error = `cross_ref: ${crossRef.errors.map(e => e.code).join(', ')}`
          actual = null
        } else {
          actual = scoreArchetype(spec) as string
          passed = actual === entry.expected_archetype
        }
      } else {
        actual = finalEvent ? finalEvent.type : 'no_event'
        error = `expected 'done', got '${actual}'`
      }
    } catch (err: unknown) {
      error = err instanceof Error ? err.message : String(err)
    }

    results.push({
      prompt_id: entry.id,
      passed,
      expected: entry.expected_archetype,
      actual,
      ...(error ? {error} : {}),
    })
  }

  // Calculate pass rates
  const totalCount = results.length
  const totalPassed = results.filter(r => r.passed).length
  const overallRate = totalPassed / totalCount

  const archetypes: V0Archetype[] = ['ListCRUD', 'Tracker', 'Journal', 'Calculator']
  const perArchetype: Record<string, {passed: number; total: number; rate: number}> = {}

  for (const arch of archetypes) {
    const entries = ARCHETYPE_PROMPTS.filter(e => e.expected_archetype === arch)
    const archResults = results.filter(r => entries.some(e => e.id === r.prompt_id))
    const archPassed = archResults.filter(r => r.passed).length
    const archTotal = archResults.length
    perArchetype[arch] = {
      passed: archPassed,
      total: archTotal,
      rate: archTotal > 0 ? archPassed / archTotal : 0,
    }
  }

  const evalResults: EvalResults = {
    mode: 'v0',
    timestamp: new Date().toISOString(),
    summary: {
      total: totalCount,
      passed: totalPassed,
      overall_pass_rate: overallRate,
      threshold_overall: 0.9,
      threshold_per_archetype: 0.8,
      ...Object.fromEntries(
        archetypes.map(a => [
          `${a}_pass_rate`,
          perArchetype[a]?.rate ?? 0,
        ]),
      ),
    },
    per_prompt: results,
  }

  writeResults('v0', evalResults)

  // Threshold checks
  let passed = true

  if (overallRate < 0.9) {
    console.error(
      `FAIL: overall pass rate ${(overallRate * 100).toFixed(1)}% < 90% threshold (${totalPassed}/${totalCount})`,
    )
    passed = false
  } else {
    console.log(`PASS: overall pass rate ${(overallRate * 100).toFixed(1)}% (${totalPassed}/${totalCount})`)
  }

  for (const arch of archetypes) {
    const data = perArchetype[arch]
    if (!data) continue
    if (data.rate < 0.8) {
      console.error(
        `FAIL: ${arch} pass rate ${(data.rate * 100).toFixed(1)}% < 80% per-archetype threshold (${data.passed}/${data.total})`,
      )
      passed = false
    } else {
      console.log(`PASS: ${arch} ${(data.rate * 100).toFixed(1)}% (${data.passed}/${data.total})`)
    }
  }

  return passed
}

// ---------------------------------------------------------------------------
// Mode: out-of-scope-detection — T-0007-163, T-0007-164
// ---------------------------------------------------------------------------

async function runOutOfScopeDetectionMode(): Promise<boolean> {
  const results: PerPromptResult[] = []

  console.log(`Running out-of-scope-detection mode — ${OUT_OF_SCOPE_DETECTION_PROMPTS.length} prompts...`)

  for (const entry of OUT_OF_SCOPE_DETECTION_PROMPTS) {
    let passed = false
    let actual: string | null = null
    let error: string | undefined

    try {
      const gen = generateAppSpec({userId: 'eval-user', prompt: entry.prompt})
      const finalEvent = await drainGenerator(gen)

      if (finalEvent && finalEvent.type === 'out_of_scope') {
        actual = finalEvent.capability
        passed = actual === entry.expected_capability
      } else {
        actual = finalEvent ? finalEvent.type : 'no_event'
        error = `expected 'out_of_scope', got '${actual}'`
      }
    } catch (err: unknown) {
      error = err instanceof Error ? err.message : String(err)
    }

    results.push({
      prompt_id: entry.id,
      passed,
      expected: entry.expected_capability,
      actual,
      ...(error ? {error} : {}),
    })
  }

  const totalCount = results.length
  const totalDetected = results.filter(r => r.passed).length
  const detectionRate = totalDetected / totalCount

  const evalResults: EvalResults = {
    mode: 'out-of-scope-detection',
    timestamp: new Date().toISOString(),
    summary: {
      total: totalCount,
      detected: totalDetected,
      detection_rate: detectionRate,
      threshold: 0.95,
    },
    per_prompt: results,
  }

  writeResults('out-of-scope-detection', evalResults)

  if (detectionRate < 0.95) {
    console.error(
      `FAIL: detection rate ${(detectionRate * 100).toFixed(1)}% < 95% threshold (${totalDetected}/${totalCount})`,
    )
    return false
  }

  console.log(`PASS: detection rate ${(detectionRate * 100).toFixed(1)}% (${totalDetected}/${totalCount})`)
  return true
}

// ---------------------------------------------------------------------------
// Mode: out-of-scope-false-positive — T-0007-165, T-0007-166
// ---------------------------------------------------------------------------

async function runOutOfScopeFalsePositiveMode(): Promise<boolean> {
  const results: PerPromptResult[] = []

  console.log(
    `Running out-of-scope-false-positive mode — ${OUT_OF_SCOPE_FALSE_POSITIVE_PROMPTS.length} prompts...`,
  )

  for (const entry of OUT_OF_SCOPE_FALSE_POSITIVE_PROMPTS) {
    let passed = false
    let actual: string | null = null
    let error: string | undefined

    try {
      const gen = generateAppSpec({userId: 'eval-user', prompt: entry.prompt})
      const finalEvent = await drainGenerator(gen)

      if (finalEvent && finalEvent.type === 'done') {
        // 'done' means produce_app_spec fired — correct, not a false positive.
        actual = 'produce_app_spec'
        passed = true
      } else if (finalEvent && finalEvent.type === 'out_of_scope') {
        // out_of_scope fired for an in-scope prompt — false positive.
        actual = `out_of_scope:${finalEvent.capability}`
        passed = false
        error = `false positive: out_of_scope fired with capability '${finalEvent.capability}'`
      } else {
        actual = finalEvent ? finalEvent.type : 'no_event'
        error = `unexpected event type '${actual}'`
      }
    } catch (err: unknown) {
      error = err instanceof Error ? err.message : String(err)
    }

    results.push({
      prompt_id: entry.id,
      passed,
      expected: entry.expected_archetype,
      actual,
      ...(error ? {error} : {}),
    })
  }

  const totalCount = results.length
  const falsePositives = results.filter(r => !r.passed).length
  const fpRate = falsePositives / totalCount

  const evalResults: EvalResults = {
    mode: 'out-of-scope-false-positive',
    timestamp: new Date().toISOString(),
    summary: {
      total: totalCount,
      false_positives: falsePositives,
      false_positive_rate: fpRate,
      threshold: 0.05,
    },
    per_prompt: results,
  }

  writeResults('out-of-scope-false-positive', evalResults)

  if (fpRate > 0.05) {
    console.error(
      `FAIL: false-positive rate ${(fpRate * 100).toFixed(1)}% > 5% threshold (${falsePositives}/${totalCount})`,
    )
    return false
  }

  console.log(
    `PASS: false-positive rate ${(fpRate * 100).toFixed(1)}% (${falsePositives}/${totalCount} false positives)`,
  )
  return true
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const mode = parseMode()
  console.log(`Eval harness — mode: ${mode}`)

  let passed = false

  if (mode === 'v0') {
    passed = await runV0Mode()
  } else if (mode === 'out-of-scope-detection') {
    passed = await runOutOfScopeDetectionMode()
  } else if (mode === 'out-of-scope-false-positive') {
    passed = await runOutOfScopeFalsePositiveMode()
  }

  process.exit(passed ? 0 : 1)
}

// Only auto-run when executed directly (not when imported by tests — T-0007-169).
if (require.main === module) {
  main().catch(err => {
    console.error('Eval harness fatal error:', err)
    process.exit(1)
  })
}

export type {EvalMode, PerPromptResult, EvalResults}
export {VALID_MODES, parseMode, RESULTS_DIR}
