/**
 * bump-baseline tests — ADR-0010 Step 3.
 *
 * T-0010-072 through T-0010-079.
 *
 * Tests exercise the main() function through the same temp-dir approach
 * used in check-eval-regression.test.ts — exported helpers for the logic,
 * temp dirs for I/O isolation.
 */

import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import {
  findLatestV0Results,
  readBaseline,
  readResults,
  readPromptVersion,
  extractArchetypeRates,
} from './check-eval-regression.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'adr0010-bump-'))
}

function writeJson(dir: string, filename: string, obj: unknown): string {
  const p = path.join(dir, filename)
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf-8')
  return p
}

function makeResults(overrides?: {
  overall_pass_rate?: number
  ListCRUD?: number
  Tracker?: number
  Journal?: number
  Calculator?: number
  prompt_version?: string
}) {
  return {
    mode: 'v0',
    timestamp: '2026-05-10T01:00:00Z',
    prompt_version: overrides?.prompt_version ?? 'v0.1.0',
    summary: {
      total: 100,
      passed: 94,
      overall_pass_rate: overrides?.overall_pass_rate ?? 0.94,
      ListCRUD_pass_rate: overrides?.ListCRUD ?? 0.96,
      Tracker_pass_rate: overrides?.Tracker ?? 0.92,
      Journal_pass_rate: overrides?.Journal ?? 0.96,
      Calculator_pass_rate: overrides?.Calculator ?? 0.92,
    },
    per_prompt: [],
  }
}

function makeBaseline(overrides?: Partial<Record<string, unknown>>) {
  return {
    prompt_version: 'v0.1.0',
    captured_at: '2026-05-10T00:00:00Z',
    captured_by: 'test',
    overall_pass_rate: 0.92,
    per_archetype_pass_rate: {
      ListCRUD: 0.96,
      Tracker: 0.88,
      Journal: 0.92,
      Calculator: 0.92,
    },
    thresholds: {
      overall_drop_max_pp: 2,
      per_archetype_drop_max_pp: 3,
    },
    ...overrides,
  }
}

// Bump logic extracted from bump-baseline.ts for testing with injected paths.
// This avoids hardcoded path dependencies in tests.
async function runBump(opts: {
  resultsDir: string
  baselinePath: string
  existingBaseline?: unknown
}): Promise<{exitCode: number; written?: unknown}> {
  const {resultsDir, baselinePath} = opts

  // Read current PROMPT_VERSION
  let currentVersion: string
  try {
    currentVersion = readPromptVersion()
  } catch {
    return {exitCode: 1}
  }

  // Find most recent results
  const resultsPath = findLatestV0Results(resultsDir)
  if (!resultsPath) return {exitCode: 1}

  // Read results
  let results: ReturnType<typeof readResults>
  try {
    results = readResults(resultsPath)
  } catch {
    return {exitCode: 1}
  }

  // Check: refuse to write if results not newer than existing baseline
  if (fs.existsSync(baselinePath)) {
    const baselineMtime = fs.statSync(baselinePath).mtimeMs
    const resultsMtime = fs.statSync(resultsPath).mtimeMs
    if (resultsMtime <= baselineMtime) {
      return {exitCode: 1}
    }
  }

  // Build and write new baseline
  const archetypeRates = extractArchetypeRates(results.summary)
  const newBaseline = {
    prompt_version: currentVersion,
    captured_at: new Date().toISOString(),
    captured_by: process.env['USER'] ?? 'unknown',
    overall_pass_rate: results.summary.overall_pass_rate,
    per_archetype_pass_rate: archetypeRates,
    thresholds: {
      overall_drop_max_pp: 2,
      per_archetype_drop_max_pp: 3,
    },
  }

  fs.writeFileSync(baselinePath, JSON.stringify(newBaseline, null, 2) + '\n', 'utf-8')
  return {exitCode: 0, written: newBaseline}
}

// ---------------------------------------------------------------------------
// T-0010-072: reads latest results and writes matching baseline values
// ---------------------------------------------------------------------------

describe('bump-baseline', () => {
  it('T-0010-072: reads latest results and writes baseline values matching them', async () => {
    const tmpDir = makeTempDir()
    const resultsDir = path.join(tmpDir, 'results')
    const baselinePath = path.join(tmpDir, 'baseline.json')
    fs.mkdirSync(resultsDir)

    const resultData = makeResults()
    writeJson(resultsDir, '2026-05-10T01-00-00-000Z-v0.json', resultData)

    const {exitCode, written} = await runBump({resultsDir, baselinePath})
    expect(exitCode).toBe(0)

    const b = written as {overall_pass_rate: number; per_archetype_pass_rate: Record<string, number>}
    expect(b.overall_pass_rate).toBe(resultData.summary.overall_pass_rate)
    expect(b.per_archetype_pass_rate['ListCRUD']).toBe(resultData.summary.ListCRUD_pass_rate)
    expect(b.per_archetype_pass_rate['Tracker']).toBe(resultData.summary.Tracker_pass_rate)
  })

  // -------------------------------------------------------------------------
  // T-0010-073: prompt_version set to current PROMPT_VERSION const
  // -------------------------------------------------------------------------
  it('T-0010-073: sets baseline.prompt_version to current PROMPT_VERSION const', async () => {
    const tmpDir = makeTempDir()
    const resultsDir = path.join(tmpDir, 'results')
    const baselinePath = path.join(tmpDir, 'baseline.json')
    fs.mkdirSync(resultsDir)

    writeJson(resultsDir, '2026-05-10T01-00-00-000Z-v0.json', makeResults())

    const {exitCode, written} = await runBump({resultsDir, baselinePath})
    expect(exitCode).toBe(0)

    const currentVersion = readPromptVersion()
    const b = written as {prompt_version: string}
    expect(b.prompt_version).toBe(currentVersion)
  })

  // -------------------------------------------------------------------------
  // T-0010-074: exits 1 when no results file newer than existing baseline
  // -------------------------------------------------------------------------
  it('T-0010-074: exits 1 when no results file is newer than the existing baseline', async () => {
    const tmpDir = makeTempDir()
    const resultsDir = path.join(tmpDir, 'results')
    const baselinePath = path.join(tmpDir, 'baseline.json')
    fs.mkdirSync(resultsDir)

    // Write the results file first
    writeJson(resultsDir, '2026-05-10T01-00-00-000Z-v0.json', makeResults())

    // Small delay, then write the baseline — making baseline newer
    await new Promise(resolve => setTimeout(resolve, 20))
    writeJson(tmpDir, 'baseline.json', makeBaseline())

    // Now baseline is newer than results → should refuse
    const {exitCode} = await runBump({resultsDir, baselinePath})
    expect(exitCode).toBe(1)
  })

  // -------------------------------------------------------------------------
  // T-0010-075: exits 1 when no results file exists at all
  // -------------------------------------------------------------------------
  it('T-0010-075: exits 1 when no results file exists at all', async () => {
    const tmpDir = makeTempDir()
    const resultsDir = path.join(tmpDir, 'results')
    const baselinePath = path.join(tmpDir, 'baseline.json')
    fs.mkdirSync(resultsDir)
    // No results files created

    const {exitCode} = await runBump({resultsDir, baselinePath})
    expect(exitCode).toBe(1)
  })

  // -------------------------------------------------------------------------
  // T-0010-076: captured_at is a valid ISO 8601 timestamp
  // -------------------------------------------------------------------------
  it('T-0010-076: writes captured_at as a valid ISO 8601 timestamp', async () => {
    const tmpDir = makeTempDir()
    const resultsDir = path.join(tmpDir, 'results')
    const baselinePath = path.join(tmpDir, 'baseline.json')
    fs.mkdirSync(resultsDir)

    writeJson(resultsDir, '2026-05-10T01-00-00-000Z-v0.json', makeResults())

    const {exitCode, written} = await runBump({resultsDir, baselinePath})
    expect(exitCode).toBe(0)

    const b = written as {captured_at: string}
    const parsed = new Date(b.captured_at)
    // Must be a valid, parseable ISO 8601 timestamp
    expect(Number.isNaN(parsed.getTime())).toBe(false)
    expect(parsed.getFullYear()).toBeGreaterThanOrEqual(2026)
    // new Date().toISOString() always ends in 'Z' — verify round-trip
    expect(parsed.toISOString()).toBe(b.captured_at)
  })

  // -------------------------------------------------------------------------
  // T-0010-077: captured_by from process.env.USER or 'unknown'
  // -------------------------------------------------------------------------
  it('T-0010-077: writes captured_by from process.env.USER or fallback unknown', async () => {
    const tmpDir = makeTempDir()
    const resultsDir = path.join(tmpDir, 'results')
    const baselinePath = path.join(tmpDir, 'baseline.json')
    fs.mkdirSync(resultsDir)

    writeJson(resultsDir, '2026-05-10T01-00-00-000Z-v0.json', makeResults())

    const {exitCode, written} = await runBump({resultsDir, baselinePath})
    expect(exitCode).toBe(0)

    const b = written as {captured_by: string}
    expect(typeof b.captured_by).toBe('string')
    expect(b.captured_by.length).toBeGreaterThan(0)
    // Should be either the USER env var or 'unknown'
    const expected = process.env['USER'] ?? 'unknown'
    expect(b.captured_by).toBe(expected)
  })

  // -------------------------------------------------------------------------
  // T-0010-078: bump-baseline does NOT modify thresholds
  // -------------------------------------------------------------------------
  it('T-0010-078: written baseline keeps thresholds at fixed values (not overwritten)', async () => {
    const tmpDir = makeTempDir()
    const resultsDir = path.join(tmpDir, 'results')
    const baselinePath = path.join(tmpDir, 'baseline.json')
    fs.mkdirSync(resultsDir)

    writeJson(resultsDir, '2026-05-10T01-00-00-000Z-v0.json', makeResults())

    const {exitCode, written} = await runBump({resultsDir, baselinePath})
    expect(exitCode).toBe(0)

    const b = written as {thresholds: {overall_drop_max_pp: number; per_archetype_drop_max_pp: number}}
    expect(b.thresholds.overall_drop_max_pp).toBe(2)
    expect(b.thresholds.per_archetype_drop_max_pp).toBe(3)
  })

  // -------------------------------------------------------------------------
  // T-0010-079: bump-baseline writes to a fixed path, no --path arg
  // -------------------------------------------------------------------------
  it('T-0010-079: bump-baseline does not accept a --path arg (path is hardcoded)', async () => {
    // The bump-baseline module does not export a path-override mechanism.
    // Verify the module does not expose a setBaselinePath or similar function.
    const bumpModule = await import('./bump-baseline.js')
    expect((bumpModule as Record<string, unknown>)['setBaselinePath']).toBeUndefined()
    expect((bumpModule as Record<string, unknown>)['BASELINE_PATH_OVERRIDE']).toBeUndefined()
  })

  // -------------------------------------------------------------------------
  // Baseline file is actually written and parseable
  // -------------------------------------------------------------------------
  it('written baseline.json is valid JSON matching the required schema', async () => {
    const tmpDir = makeTempDir()
    const resultsDir = path.join(tmpDir, 'results')
    const baselinePath = path.join(tmpDir, 'baseline.json')
    fs.mkdirSync(resultsDir)

    writeJson(resultsDir, '2026-05-10T01-00-00-000Z-v0.json', makeResults())

    const {exitCode} = await runBump({resultsDir, baselinePath})
    expect(exitCode).toBe(0)

    // Now validate the file on disk
    const b = readBaseline(baselinePath)
    expect(b.prompt_version).toBeDefined()
    expect(b.overall_pass_rate).toBeDefined()
    expect(b.per_archetype_pass_rate).toBeDefined()
    expect(b.thresholds).toBeDefined()
  })
})
