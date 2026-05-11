/**
 * check-eval-regression.ts — ADR-0010 Step 3.
 *
 * CI gate: compare the most recent v0 eval results against the committed
 * baseline. Exits 1 (blocked) if either the overall pass rate dropped >2pp
 * or any single archetype dropped >3pp. Override requires the exact uppercase
 * token `INTENTIONAL_EVAL_REGRESSION:` in the PR body with a non-empty rationale.
 *
 * BYPASS VECTOR (documented per ADR-0010 R2 FINDING-5):
 *   The missing-baseline exit-0 path is intentional ONLY for the narrow case
 *   where baseline.json has never been committed (first eval run of the repo).
 *   It is NOT a graceful-degradation path for a deleted baseline — deletion is
 *   an accepted bypass vector, defended by code review (any PR deleting
 *   baseline.json shows up as a deletion diff). An empty, zero-byte, whitespace-
 *   only, or otherwise malformed baseline.json exits 1 (loud failure), not 0.
 *
 * Usage:
 *   tsx scripts/check-eval-regression.ts [--pr-body-file=<path>]
 *
 * Environment:
 *   GITHUB_PR_BODY — PR body text (alternative to --pr-body-file).
 */

import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs'
import {join} from 'node:path'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Baseline = {
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

type V0Results = {
  mode: string
  timestamp: string
  prompt_version?: string
  summary: {
    overall_pass_rate: number
    [key: string]: number | string
  }
}

// ---------------------------------------------------------------------------
// Path constants (relative to this script's location in scripts/)
// ---------------------------------------------------------------------------

const SCRIPT_DIR = __dirname
const EVAL_DIR = join(SCRIPT_DIR, '..', 'eval')
const RESULTS_DIR = join(EVAL_DIR, 'results')
const BASELINE_PATH = join(EVAL_DIR, 'baseline.json')
const SYSTEM_TS_PATH = join(SCRIPT_DIR, '..', 'src', 'llm', 'prompts', 'system.ts')

// ---------------------------------------------------------------------------
// PROMPT_VERSION reader — regex extraction, never require/import.
// Anchored to the export const form so comment occurrences are excluded.
// ---------------------------------------------------------------------------

export function readPromptVersion(): string {
  const src = readFileSync(SYSTEM_TS_PATH, 'utf-8')
  // Anchor to "export const PROMPT_VERSION = '<value>'" — multiline mode.
  // This is intentionally strict: only the exported const counts,
  // not occurrences inside comments.
  const m = src.match(/^export const PROMPT_VERSION = '([^']+)'/m)
  if (!m || !m[1]) {
    throw new Error(`PROMPT_VERSION not found in ${SYSTEM_TS_PATH}`)
  }
  return m[1]
}

// ---------------------------------------------------------------------------
// Find most recent v0 results file by mtime
// ---------------------------------------------------------------------------

export function findLatestV0Results(resultsDir: string): string | null {
  if (!existsSync(resultsDir)) return null

  const files = readdirSync(resultsDir).filter(f => f.endsWith('-v0.json'))
  if (files.length === 0) return null

  // Sort by mtime descending, return the most recent
  const sorted = files
    .map(f => ({file: f, mtime: statSync(join(resultsDir, f)).mtimeMs}))
    .sort((a, b) => b.mtime - a.mtime)

  return sorted[0] ? join(resultsDir, sorted[0].file) : null
}

// ---------------------------------------------------------------------------
// PR body reader — --pr-body-file= arg or GITHUB_PR_BODY env
// ---------------------------------------------------------------------------

export function readPrBody(args: string[]): string {
  const fileArg = args.find(a => a.startsWith('--pr-body-file='))
  if (fileArg) {
    const filePath = fileArg.slice('--pr-body-file='.length)
    if (existsSync(filePath)) {
      return readFileSync(filePath, 'utf-8')
    }
    return ''
  }
  return process.env['GITHUB_PR_BODY'] ?? ''
}

// ---------------------------------------------------------------------------
// Override grammar — case-sensitive exact-string match.
//
// The key MUST be the literal byte sequence `INTENTIONAL_EVAL_REGRESSION:`.
// Lowercase, mixed-case, or misspelled variants do NOT trigger the override.
// Rationale: audit-trail guarantee — reviewers grep PR bodies for this exact
// token to find every override.
//
// Rules:
//   - Line-by-line scan for the exact string `INTENTIONAL_EVAL_REGRESSION:`
//   - Extract substring after colon to end of line, then .trim()
//   - Accept iff trimmed rationale is non-empty
//   - Any-match wins (at least one valid line → override accepted)
//   - All matched rationale lines are logged (not just the first)
// ---------------------------------------------------------------------------

const OVERRIDE_TOKEN = 'INTENTIONAL_EVAL_REGRESSION:'

export type OverrideResult =
  | {accepted: true; rationales: string[]}
  | {accepted: false; reason: string}

export function parseOverride(prBody: string): OverrideResult {
  const lines = prBody.split('\n')
  const matchedRationales: string[] = []

  for (const line of lines) {
    const idx = line.indexOf(OVERRIDE_TOKEN)
    if (idx === -1) continue

    // Exact string found. Extract rationale (everything after the colon on this line).
    const afterColon = line.slice(idx + OVERRIDE_TOKEN.length)
    const rationale = afterColon.trim()

    if (rationale.length > 0) {
      matchedRationales.push(rationale)
    }
  }

  if (matchedRationales.length > 0) {
    return {accepted: true, rationales: matchedRationales}
  }

  // Check if the token appears but with empty/whitespace-only rationale
  const tokenPresent = lines.some(line => line.includes(OVERRIDE_TOKEN))
  if (tokenPresent) {
    return {
      accepted: false,
      reason: 'INTENTIONAL_EVAL_REGRESSION: found but rationale is empty or whitespace-only',
    }
  }

  return {accepted: false, reason: 'no INTENTIONAL_EVAL_REGRESSION: line found'}
}

// ---------------------------------------------------------------------------
// Baseline reader — explicit failure on empty/malformed
// ---------------------------------------------------------------------------

export function readBaseline(baselinePath: string): Baseline {
  const raw = readFileSync(baselinePath, 'utf-8')

  // Empty or whitespace-only baseline is treated as malformed (not missing).
  if (raw.trim().length === 0) {
    throw new Error(
      `baseline.json at ${baselinePath} is empty or whitespace-only — malformed, not missing`,
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`baseline.json at ${baselinePath} is malformed JSON`)
  }

  // Minimal schema validation
  const b = parsed as Partial<Baseline>
  if (
    typeof b.prompt_version !== 'string' ||
    typeof b.overall_pass_rate !== 'number' ||
    typeof b.per_archetype_pass_rate !== 'object' ||
    b.per_archetype_pass_rate === null ||
    typeof b.thresholds !== 'object' ||
    b.thresholds === null ||
    typeof b.thresholds.overall_drop_max_pp !== 'number' ||
    typeof b.thresholds.per_archetype_drop_max_pp !== 'number'
  ) {
    throw new Error(`baseline.json at ${baselinePath} is missing required keys or has wrong types`)
  }

  return b as Baseline
}

// ---------------------------------------------------------------------------
// Results reader — explicit failure on malformed
// ---------------------------------------------------------------------------

export function readResults(resultsPath: string): V0Results {
  const raw = readFileSync(resultsPath, 'utf-8')

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`results file at ${resultsPath} is malformed JSON`)
  }

  const r = parsed as Partial<V0Results>
  if (
    typeof r.mode !== 'string' ||
    typeof r.summary !== 'object' ||
    r.summary === null ||
    typeof r.summary.overall_pass_rate !== 'number'
  ) {
    throw new Error(`results file at ${resultsPath} is missing required keys`)
  }

  return r as V0Results
}

// ---------------------------------------------------------------------------
// Per-archetype pass rate extraction from results summary
// ---------------------------------------------------------------------------

export function extractArchetypeRates(
  summary: V0Results['summary'],
): Record<string, number> {
  const archetypes = ['ListCRUD', 'Tracker', 'Journal', 'Calculator']
  const result: Record<string, number> = {}
  for (const arch of archetypes) {
    const key = `${arch}_pass_rate`
    const val = summary[key]
    if (typeof val === 'number') {
      result[arch] = val
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function main(args: string[] = process.argv.slice(2)): Promise<number> {
  // 1. Check baseline exists (missing → exit 0, narrow first-run case)
  if (!existsSync(BASELINE_PATH)) {
    console.warn('no baseline; skipping regression gate (first-run narrow case)')
    return 0
  }

  // 2. Read baseline — empty/malformed → exit 1 (loud failure)
  let baseline: Baseline
  try {
    baseline = readBaseline(BASELINE_PATH)
  } catch (err) {
    console.error(`regression gate: ${(err as Error).message}`)
    return 1
  }

  // 3. Read current PROMPT_VERSION
  let currentVersion: string
  try {
    currentVersion = readPromptVersion()
  } catch (err) {
    console.error(`regression gate: could not read PROMPT_VERSION — ${(err as Error).message}`)
    return 1
  }

  // 4. Baseline version mismatch → exit 0 (baseline is stale; skip)
  if (baseline.prompt_version !== currentVersion) {
    console.warn(
      `baseline prompt_version ${baseline.prompt_version} ≠ current ${currentVersion}; ` +
        `baseline must be re-bumped — skipping regression gate`,
    )
    return 0
  }

  // 5. Find most recent v0 results file
  const resultsPath = findLatestV0Results(RESULTS_DIR)
  if (!resultsPath) {
    console.error('regression gate: no v0 results files found in eval/results/')
    return 1
  }

  // 6. Read results — malformed → exit 1
  let results: V0Results
  try {
    results = readResults(resultsPath)
  } catch (err) {
    console.error(`regression gate: ${(err as Error).message}`)
    return 1
  }

  // 7. Results version mismatch → exit 1 (results from wrong prompt version)
  if (results.prompt_version !== currentVersion) {
    console.error(
      `regression gate: results prompt_version ${results.prompt_version ?? 'undefined'} ≠ ` +
        `current ${currentVersion}; results are from a stale prompt version — ` +
        `re-run the eval against the current prompt before merging`,
    )
    return 1
  }

  // 8. Compute deltas
  // Round to 4 decimal places to eliminate floating-point noise in threshold
  // comparisons. Pass rates are fractions of N prompts (N≤100), so 0.0001pp
  // precision is more than sufficient. This is the T-0010-152 FP guard.
  const roundDelta = (d: number): number => Math.round(d * 10000) / 10000
  const overallDeltaPp = roundDelta(
    (results.summary.overall_pass_rate - baseline.overall_pass_rate) * 100,
  )
  const archetypeRates = extractArchetypeRates(results.summary)
  const archetypeDeltas: Record<string, number> = {}
  for (const [arch, rate] of Object.entries(archetypeRates)) {
    const baseRate = baseline.per_archetype_pass_rate[arch]
    if (typeof baseRate === 'number') {
      archetypeDeltas[arch] = roundDelta((rate - baseRate) * 100)
    }
  }

  // 9. Evaluate thresholds
  const overallLimit = baseline.thresholds.overall_drop_max_pp
  const archetypeLimit = baseline.thresholds.per_archetype_drop_max_pp

  const failures: string[] = []

  // Boundary: strictly less than -(limit), i.e. -3.0 is acceptable, -3.01 is not.
  // The roundDelta above ensures 0.92 - 0.92 = 0.0, not -0.0000000000000027.
  if (overallDeltaPp < -overallLimit) {
    failures.push(
      `regression: overall dropped ${(-overallDeltaPp).toFixed(2)}pp (limit: ${overallLimit}pp)`,
    )
  }

  for (const [arch, delta] of Object.entries(archetypeDeltas)) {
    if (delta < -archetypeLimit) {
      failures.push(
        `regression: ${arch} dropped ${(-delta).toFixed(2)}pp (limit: ${archetypeLimit}pp)`,
      )
    }
  }

  if (failures.length === 0) {
    console.warn(
      `regression gate: PASS — overall delta: ${overallDeltaPp >= 0 ? '+' : ''}${overallDeltaPp.toFixed(2)}pp`,
    )
    for (const [arch, delta] of Object.entries(archetypeDeltas)) {
      console.warn(`  ${arch}: ${delta >= 0 ? '+' : ''}${delta.toFixed(2)}pp`)
    }
    return 0
  }

  // 10. Check for override
  const prBody = readPrBody(args)
  const override = parseOverride(prBody)

  if (override.accepted) {
    console.warn('regression gate: OVERRIDE accepted — rationale(s):')
    for (const r of override.rationales) {
      console.warn(`  - ${r}`)
    }
    console.warn('failures that were overridden:')
    for (const f of failures) {
      console.warn(`  ${f}`)
    }
    return 0
  }

  // 11. Gate blocks
  for (const f of failures) {
    console.error(f)
  }
  console.error(
    `regression gate: BLOCKED — add \`INTENTIONAL_EVAL_REGRESSION: <rationale>\` to the PR body to override`,
  )
  return 1
}

// Only auto-run when executed directly
if (require.main === module) {
  main().then(code => process.exit(code)).catch(err => {
    console.error('regression gate fatal error:', err)
    process.exit(1)
  })
}
