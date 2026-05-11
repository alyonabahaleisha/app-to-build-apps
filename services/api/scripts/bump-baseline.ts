/**
 * bump-baseline.ts — ADR-0010 Step 3.
 *
 * Manual baseline-bump tool. Reads the most recent v0 eval results and
 * writes a new baseline.json.
 *
 * Usage:
 *   pnpm --filter @app-creator/api eval:bump-baseline
 *   tsx scripts/bump-baseline.ts
 *
 * Gated to PRs that have human grading approval recorded in the PR body.
 * Does NOT independently validate PROMPT_VERSION monotonicity — that is
 * enforced by check-prompt-version-bumped (Step 5), which is the single
 * source of truth for the monotonicity invariant.
 *
 * Path is hardcoded to services/api/eval/baseline.json.
 * There is no --path argument — bump-baseline writes exactly one file.
 */

import {existsSync, statSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'

import {
  findLatestV0Results,
  readBaseline,
  readPromptVersion,
  readResults,
  extractArchetypeRates,
} from './check-eval-regression.js'

// ---------------------------------------------------------------------------
// Path constants (relative to this script's location in scripts/)
// ---------------------------------------------------------------------------

const SCRIPT_DIR = __dirname
const EVAL_DIR = join(SCRIPT_DIR, '..', 'eval')
const RESULTS_DIR = join(EVAL_DIR, 'results')
const BASELINE_PATH = join(EVAL_DIR, 'baseline.json')

// ---------------------------------------------------------------------------
// Baseline writer
// ---------------------------------------------------------------------------

type BaselineOut = {
  prompt_version: string
  captured_at: string
  captured_by: string
  overall_pass_rate: number
  per_archetype_pass_rate: Record<string, number>
  thresholds: {
    overall_drop_max_pp: number
    per_archetype_drop_max_pp: number
  }
}

// Thresholds are constants of the gate — bump-baseline does NOT modify them.
const FIXED_THRESHOLDS = {
  overall_drop_max_pp: 2,
  per_archetype_drop_max_pp: 3,
} as const

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function main(): Promise<number> {
  // 1. Read current PROMPT_VERSION
  let currentVersion: string
  try {
    currentVersion = readPromptVersion()
  } catch (err) {
    console.error(`bump-baseline: could not read PROMPT_VERSION — ${(err as Error).message}`)
    return 1
  }

  // 2. Find most recent v0 results
  const resultsPath = findLatestV0Results(RESULTS_DIR)
  if (!resultsPath) {
    console.error('bump-baseline: no v0 results files found in eval/results/')
    return 1
  }

  // 3. Read results
  let results: ReturnType<typeof readResults>
  try {
    results = readResults(resultsPath)
  } catch (err) {
    console.error(`bump-baseline: ${(err as Error).message}`)
    return 1
  }

  // 4. Refuse to write if no results file is newer than the existing baseline.
  //    "Newer than" is defined by mtime — not content comparison.
  if (existsSync(BASELINE_PATH)) {
    const baselineMtime = statSync(BASELINE_PATH).mtimeMs
    const resultsMtime = statSync(resultsPath).mtimeMs
    if (resultsMtime <= baselineMtime) {
      console.error(
        `bump-baseline: most recent results file is not newer than the existing baseline — ` +
          `run the eval harness first, then bump`,
      )
      return 1
    }
  }

  // 5. Read existing baseline for diff display (best-effort; may not exist on first run)
  let oldBaseline: ReturnType<typeof readBaseline> | null = null
  if (existsSync(BASELINE_PATH)) {
    try {
      oldBaseline = readBaseline(BASELINE_PATH)
    } catch {
      // Swallow — we're about to overwrite it anyway
    }
  }

  // 6. Build new baseline
  const archetypeRates = extractArchetypeRates(results.summary)
  const newBaseline: BaselineOut = {
    prompt_version: currentVersion,
    captured_at: new Date().toISOString(),
    captured_by: process.env['USER'] ?? 'unknown',
    overall_pass_rate: results.summary.overall_pass_rate,
    per_archetype_pass_rate: archetypeRates,
    thresholds: FIXED_THRESHOLDS,
  }

  // 7. Write
  writeFileSync(BASELINE_PATH, JSON.stringify(newBaseline, null, 2) + '\n', 'utf-8')

  // 8. Print diff
  console.warn('bump-baseline: baseline updated')
  console.warn(`  prompt_version: ${oldBaseline?.prompt_version ?? '(none)'} → ${newBaseline.prompt_version}`)
  console.warn(
    `  overall_pass_rate: ${oldBaseline ? (oldBaseline.overall_pass_rate * 100).toFixed(1) + '%' : '(none)'} → ${(newBaseline.overall_pass_rate * 100).toFixed(1)}%`,
  )
  for (const [arch, rate] of Object.entries(newBaseline.per_archetype_pass_rate)) {
    const old = oldBaseline?.per_archetype_pass_rate[arch]
    const oldStr = old !== undefined ? (old * 100).toFixed(1) + '%' : '(none)'
    console.warn(`  ${arch}: ${oldStr} → ${(rate * 100).toFixed(1)}%`)
  }
  console.warn(`  captured_by: ${newBaseline.captured_by}`)
  console.warn(`  written to: ${BASELINE_PATH}`)

  return 0
}

// Only auto-run when executed directly
if (require.main === module) {
  main().then(code => process.exit(code)).catch(err => {
    console.error('bump-baseline fatal error:', err)
    process.exit(1)
  })
}
