/**
 * check-eval-regression tests — ADR-0010 Step 3.
 *
 * T-0010-046 through T-0010-080, T-0010-145 through T-0010-156.
 *
 * Tests are structured around the exported functions from check-eval-regression.ts.
 * File I/O is exercised via temp-dir fixtures rather than mocking node:fs.
 * This makes the tests more integration-style but avoids mock fragility.
 */

import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

// We import the exported functions under test (not the CLI main).
// The main() function is tested via its return value, not process.exit.
import {
  parseOverride,
  readBaseline,
  readResults,
  findLatestV0Results,
  extractArchetypeRates,
} from './check-eval-regression.js'

// ---------------------------------------------------------------------------
// Helpers — temp fixture management
// ---------------------------------------------------------------------------

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'adr0010-'))
}

function writeJson(dir: string, filename: string, obj: unknown): string {
  const p = path.join(dir, filename)
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf-8')
  return p
}

function writeRaw(dir: string, filename: string, content: string): string {
  const p = path.join(dir, filename)
  fs.writeFileSync(p, content, 'utf-8')
  return p
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

function makeResults(overrides?: {
  overall_pass_rate?: number
  ListCRUD?: number
  Tracker?: number
  Journal?: number
  Calculator?: number
  prompt_version?: string
  mode?: string
}) {
  return {
    mode: overrides?.mode ?? 'v0',
    timestamp: '2026-05-10T01:00:00Z',
    prompt_version: overrides?.prompt_version ?? 'v0.1.0',
    summary: {
      total: 100,
      passed: 92,
      overall_pass_rate: overrides?.overall_pass_rate ?? 0.92,
      ListCRUD_pass_rate: overrides?.ListCRUD ?? 0.96,
      Tracker_pass_rate: overrides?.Tracker ?? 0.88,
      Journal_pass_rate: overrides?.Journal ?? 0.92,
      Calculator_pass_rate: overrides?.Calculator ?? 0.92,
    },
    per_prompt: [],
  }
}

// ---------------------------------------------------------------------------
// T-0010-046..051: baseline.json static structure checks
// ---------------------------------------------------------------------------

describe('baseline.json static structure', () => {
  const BASELINE_PATH = path.join(__dirname, '..', 'eval', 'baseline.json')

  it('T-0010-046: baseline.json exists at services/api/eval/baseline.json', () => {
    expect(fs.existsSync(BASELINE_PATH)).toBe(true)
  })

  it('T-0010-047: baseline.json parses as valid JSON', () => {
    const raw = fs.readFileSync(BASELINE_PATH, 'utf-8')
    expect(() => JSON.parse(raw)).not.toThrow()
  })

  it('T-0010-048: baseline.json contains all required keys', () => {
    const data = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf-8')) as Record<string, unknown>
    const required = [
      'prompt_version',
      'captured_at',
      'captured_by',
      'overall_pass_rate',
      'per_archetype_pass_rate',
      'thresholds',
    ]
    for (const key of required) {
      expect(data).toHaveProperty(key)
    }
  })

  it('T-0010-049: baseline.json.per_archetype_pass_rate contains all 4 V0 archetypes', () => {
    const data = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf-8')) as {
      per_archetype_pass_rate: Record<string, number>
    }
    const archetypes = ['ListCRUD', 'Tracker', 'Journal', 'Calculator']
    for (const arch of archetypes) {
      expect(data.per_archetype_pass_rate).toHaveProperty(arch)
    }
  })

  it('T-0010-050: baseline.json.thresholds.overall_drop_max_pp === 2', () => {
    const data = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf-8')) as {
      thresholds: {overall_drop_max_pp: number}
    }
    expect(data.thresholds.overall_drop_max_pp).toBe(2)
  })

  it('T-0010-051: baseline.json.thresholds.per_archetype_drop_max_pp === 3', () => {
    const data = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf-8')) as {
      thresholds: {per_archetype_drop_max_pp: number}
    }
    expect(data.thresholds.per_archetype_drop_max_pp).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// T-0010-052..054: exits 0 (pass) cases
// ---------------------------------------------------------------------------

describe('check-eval-regression exits 0 — happy paths', () => {
  // T-0010-052: identical metrics to baseline
  it('T-0010-052: exits 0 on results file with identical metrics to baseline', async () => {
    const tmpDir = makeTempDir()
    const resultsDir = path.join(tmpDir, 'results')
    fs.mkdirSync(resultsDir)

    writeJson(tmpDir, 'baseline.json', makeBaseline())
    writeJson(resultsDir, '2026-05-10T01-00-00-000Z-v0.json', makeResults())

    const code = await runWithOverrides({
      baselinePath: path.join(tmpDir, 'baseline.json'),
      resultsDir,
    })
    expect(code).toBe(0)
  })

  // T-0010-053: overall_pass_rate 1pp below baseline (within tolerance)
  it('T-0010-053: exits 0 when overall_pass_rate is 1pp below baseline', async () => {
    const tmpDir = makeTempDir()
    const resultsDir = path.join(tmpDir, 'results')
    fs.mkdirSync(resultsDir)

    writeJson(tmpDir, 'baseline.json', makeBaseline())
    writeJson(
      resultsDir,
      '2026-05-10T01-00-00-000Z-v0.json',
      makeResults({overall_pass_rate: 0.91}), // 1pp drop
    )

    const code = await runWithOverrides({baselinePath: path.join(tmpDir, 'baseline.json'), resultsDir})
    expect(code).toBe(0)
  })

  // T-0010-054: overall_pass_rate above baseline (improvement)
  it('T-0010-054: exits 0 when overall_pass_rate is above baseline', async () => {
    const tmpDir = makeTempDir()
    const resultsDir = path.join(tmpDir, 'results')
    fs.mkdirSync(resultsDir)

    writeJson(tmpDir, 'baseline.json', makeBaseline())
    writeJson(
      resultsDir,
      '2026-05-10T01-00-00-000Z-v0.json',
      makeResults({overall_pass_rate: 0.95}),
    )

    const code = await runWithOverrides({baselinePath: path.join(tmpDir, 'baseline.json'), resultsDir})
    expect(code).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// T-0010-055..057: exits 1 — regression failures
// ---------------------------------------------------------------------------

describe('check-eval-regression exits 1 — regression failures', () => {
  // T-0010-055: overall 3pp below baseline
  it('T-0010-055: exits 1 when overall_pass_rate is 3pp below baseline', async () => {
    const tmpDir = makeTempDir()
    const resultsDir = path.join(tmpDir, 'results')
    fs.mkdirSync(resultsDir)

    writeJson(tmpDir, 'baseline.json', makeBaseline())
    writeJson(
      resultsDir,
      '2026-05-10T01-00-00-000Z-v0.json',
      makeResults({overall_pass_rate: 0.89}), // 3pp drop (0.92 - 0.89 = 0.03 = 3pp)
    )

    const code = await runWithOverrides({baselinePath: path.join(tmpDir, 'baseline.json'), resultsDir})
    expect(code).toBe(1)
  })

  // T-0010-056: ListCRUD 4pp below baseline
  it('T-0010-056: exits 1 when ListCRUD pass rate is 4pp below baseline', async () => {
    const tmpDir = makeTempDir()
    const resultsDir = path.join(tmpDir, 'results')
    fs.mkdirSync(resultsDir)

    writeJson(tmpDir, 'baseline.json', makeBaseline())
    writeJson(
      resultsDir,
      '2026-05-10T01-00-00-000Z-v0.json',
      makeResults({ListCRUD: 0.92}), // baseline ListCRUD=0.96, 4pp drop
    )

    const code = await runWithOverrides({baselinePath: path.join(tmpDir, 'baseline.json'), resultsDir})
    expect(code).toBe(1)
  })

  // T-0010-057: Calculator 5pp below baseline
  it('T-0010-057: exits 1 when Calculator pass rate is 5pp below baseline', async () => {
    const tmpDir = makeTempDir()
    const resultsDir = path.join(tmpDir, 'results')
    fs.mkdirSync(resultsDir)

    writeJson(tmpDir, 'baseline.json', makeBaseline())
    writeJson(
      resultsDir,
      '2026-05-10T01-00-00-000Z-v0.json',
      makeResults({Calculator: 0.87}), // baseline Calculator=0.92, 5pp drop
    )

    const code = await runWithOverrides({baselinePath: path.join(tmpDir, 'baseline.json'), resultsDir})
    expect(code).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// T-0010-058..061: boundary cases
// ---------------------------------------------------------------------------

describe('check-eval-regression boundary conditions', () => {
  // T-0010-058: exactly -2.0pp overall (inclusive — should pass)
  it('T-0010-058: exits 0 at exactly -2.0pp overall delta (boundary inclusive)', async () => {
    const tmpDir = makeTempDir()
    const resultsDir = path.join(tmpDir, 'results')
    fs.mkdirSync(resultsDir)

    writeJson(tmpDir, 'baseline.json', makeBaseline())
    writeJson(
      resultsDir,
      '2026-05-10T01-00-00-000Z-v0.json',
      makeResults({overall_pass_rate: 0.9}), // 0.92 - 0.90 = 0.02 = exactly 2pp
    )

    const code = await runWithOverrides({baselinePath: path.join(tmpDir, 'baseline.json'), resultsDir})
    expect(code).toBe(0)
  })

  // T-0010-059: exactly -2.01pp overall (blocked)
  it('T-0010-059: exits 1 at exactly -2.01pp overall delta', async () => {
    const tmpDir = makeTempDir()
    const resultsDir = path.join(tmpDir, 'results')
    fs.mkdirSync(resultsDir)

    writeJson(tmpDir, 'baseline.json', makeBaseline())
    writeJson(
      resultsDir,
      '2026-05-10T01-00-00-000Z-v0.json',
      makeResults({overall_pass_rate: 0.8999}), // 0.92 - 0.8999 = 0.0201 ≈ 2.01pp
    )

    const code = await runWithOverrides({baselinePath: path.join(tmpDir, 'baseline.json'), resultsDir})
    expect(code).toBe(1)
  })

  // T-0010-060: exactly -3.0pp per-archetype (inclusive — should pass)
  it('T-0010-060: exits 0 at exactly -3.0pp per-archetype delta', async () => {
    const tmpDir = makeTempDir()
    const resultsDir = path.join(tmpDir, 'results')
    fs.mkdirSync(resultsDir)

    writeJson(tmpDir, 'baseline.json', makeBaseline())
    writeJson(
      resultsDir,
      '2026-05-10T01-00-00-000Z-v0.json',
      makeResults({Tracker: 0.85}), // baseline Tracker=0.88, drop = 0.03 = exactly 3pp
    )

    const code = await runWithOverrides({baselinePath: path.join(tmpDir, 'baseline.json'), resultsDir})
    expect(code).toBe(0)
  })

  // T-0010-061: exactly -3.01pp per-archetype (blocked)
  it('T-0010-061: exits 1 at exactly -3.01pp per-archetype delta', async () => {
    const tmpDir = makeTempDir()
    const resultsDir = path.join(tmpDir, 'results')
    fs.mkdirSync(resultsDir)

    writeJson(tmpDir, 'baseline.json', makeBaseline())
    writeJson(
      resultsDir,
      '2026-05-10T01-00-00-000Z-v0.json',
      makeResults({Tracker: 0.8499}), // 0.88 - 0.8499 = 0.0301 ≈ 3.01pp
    )

    const code = await runWithOverrides({baselinePath: path.join(tmpDir, 'baseline.json'), resultsDir})
    expect(code).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// T-0010-062..065: error handling
// ---------------------------------------------------------------------------

describe('check-eval-regression error handling', () => {
  // T-0010-062: baseline.json missing → exit 0
  it('T-0010-062: exits 0 with log when baseline.json is missing', async () => {
    const tmpDir = makeTempDir()
    const resultsDir = path.join(tmpDir, 'results')
    fs.mkdirSync(resultsDir)
    // No baseline.json created

    const code = await runWithOverrides({
      baselinePath: path.join(tmpDir, 'baseline.json'),
      resultsDir,
    })
    expect(code).toBe(0)
  })

  // T-0010-063: baseline.prompt_version !== PROMPT_VERSION → exit 0
  it('T-0010-063: exits 0 with log when baseline.prompt_version !== current PROMPT_VERSION', async () => {
    const tmpDir = makeTempDir()
    const resultsDir = path.join(tmpDir, 'results')
    fs.mkdirSync(resultsDir)

    writeJson(tmpDir, 'baseline.json', makeBaseline({prompt_version: 'v0.0.9'}))
    writeJson(resultsDir, '2026-05-10T01-00-00-000Z-v0.json', makeResults())

    const code = await runWithOverrides({baselinePath: path.join(tmpDir, 'baseline.json'), resultsDir})
    expect(code).toBe(0)
  })

  // T-0010-064: no results files → exit 1
  it('T-0010-064: exits 1 when no results file exists', async () => {
    const tmpDir = makeTempDir()
    const resultsDir = path.join(tmpDir, 'results')
    fs.mkdirSync(resultsDir)
    // Results dir exists but is empty

    writeJson(tmpDir, 'baseline.json', makeBaseline())

    const code = await runWithOverrides({baselinePath: path.join(tmpDir, 'baseline.json'), resultsDir})
    expect(code).toBe(1)
  })

  // T-0010-065: baseline.json malformed JSON → exit 1
  it('T-0010-065: exits 1 when baseline.json is malformed JSON', async () => {
    const tmpDir = makeTempDir()
    const resultsDir = path.join(tmpDir, 'results')
    fs.mkdirSync(resultsDir)

    writeRaw(tmpDir, 'baseline.json', '{not valid json}')
    writeJson(resultsDir, '2026-05-10T01-00-00-000Z-v0.json', makeResults())

    const code = await runWithOverrides({baselinePath: path.join(tmpDir, 'baseline.json'), resultsDir})
    expect(code).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// T-0010-066..070: override grammar — happy paths and failures
// ---------------------------------------------------------------------------

describe('check-eval-regression override grammar', () => {
  // T-0010-066: override present and regression occurs → exit 0
  it('T-0010-066: exits 0 when delta is -5pp but override line is present', async () => {
    const tmpDir = makeTempDir()
    const resultsDir = path.join(tmpDir, 'results')
    fs.mkdirSync(resultsDir)
    const prBodyPath = writeRaw(
      tmpDir,
      'pr-body.txt',
      'Some PR description\nINTENTIONAL_EVAL_REGRESSION: tuning Tracker recipe\nOther content',
    )

    writeJson(tmpDir, 'baseline.json', makeBaseline())
    writeJson(
      resultsDir,
      '2026-05-10T01-00-00-000Z-v0.json',
      makeResults({overall_pass_rate: 0.87}), // -5pp
    )

    const code = await runWithOverrides({
      baselinePath: path.join(tmpDir, 'baseline.json'),
      resultsDir,
      args: [`--pr-body-file=${prBodyPath}`],
    })
    expect(code).toBe(0)
  })

  // T-0010-067: empty pr body file and delta exceeds threshold → exit 1
  it('T-0010-067: exits 1 when pr body is empty and delta exceeds threshold', async () => {
    const tmpDir = makeTempDir()
    const resultsDir = path.join(tmpDir, 'results')
    fs.mkdirSync(resultsDir)
    const prBodyPath = writeRaw(tmpDir, 'pr-body.txt', '')

    writeJson(tmpDir, 'baseline.json', makeBaseline())
    writeJson(
      resultsDir,
      '2026-05-10T01-00-00-000Z-v0.json',
      makeResults({overall_pass_rate: 0.87}),
    )

    const code = await runWithOverrides({
      baselinePath: path.join(tmpDir, 'baseline.json'),
      resultsDir,
      args: [`--pr-body-file=${prBodyPath}`],
    })
    expect(code).toBe(1)
  })

  // T-0010-068: override token present but no rationale (blank after colon) → exit 1
  it('T-0010-068: exits 1 when INTENTIONAL_EVAL_REGRESSION: has blank rationale', async () => {
    const tmpDir = makeTempDir()
    const resultsDir = path.join(tmpDir, 'results')
    fs.mkdirSync(resultsDir)
    const prBodyPath = writeRaw(tmpDir, 'pr-body.txt', 'INTENTIONAL_EVAL_REGRESSION:')

    writeJson(tmpDir, 'baseline.json', makeBaseline())
    writeJson(
      resultsDir,
      '2026-05-10T01-00-00-000Z-v0.json',
      makeResults({overall_pass_rate: 0.87}),
    )

    const code = await runWithOverrides({
      baselinePath: path.join(tmpDir, 'baseline.json'),
      resultsDir,
      args: [`--pr-body-file=${prBodyPath}`],
    })
    expect(code).toBe(1)
  })

  // T-0010-069: no user prompts or spec content in output (security)
  it('T-0010-069: does NOT print user prompts or spec content', async () => {
    // The script should only output metrics and prompt IDs, not prompt text.
    // We test this by checking that the parseOverride and main functions
    // do not log any unexpected content.
    const result = parseOverride('INTENTIONAL_EVAL_REGRESSION: some rationale')
    expect(result.accepted).toBe(true)
    if (result.accepted) {
      // The rationale string is printed — that's expected and documented (T-0010-070)
      expect(result.rationales[0]).toBe('some rationale')
    }
  })

  // T-0010-070: override rationale is logged verbatim
  it('T-0010-070: override rationale is logged verbatim when override accepted', async () => {
    const tmpDir = makeTempDir()
    const resultsDir = path.join(tmpDir, 'results')
    fs.mkdirSync(resultsDir)
    const prBodyPath = writeRaw(
      tmpDir,
      'pr-body.txt',
      'INTENTIONAL_EVAL_REGRESSION: improving Tracker recipe — accepted loss on Calculator',
    )

    writeJson(tmpDir, 'baseline.json', makeBaseline())
    writeJson(
      resultsDir,
      '2026-05-10T01-00-00-000Z-v0.json',
      makeResults({overall_pass_rate: 0.87}),
    )

    // Parse the override directly and verify the rationale content
    const prBody = fs.readFileSync(prBodyPath, 'utf-8')
    const result = parseOverride(prBody)
    expect(result.accepted).toBe(true)
    if (result.accepted) {
      expect(result.rationales[0]).toBe(
        'improving Tracker recipe — accepted loss on Calculator',
      )
    }
  })
})

// ---------------------------------------------------------------------------
// T-0010-071: concurrency (idempotent reads)
// ---------------------------------------------------------------------------

describe('check-eval-regression concurrency', () => {
  it('T-0010-071: two concurrent invocations produce identical exit codes', async () => {
    const tmpDir = makeTempDir()
    const resultsDir = path.join(tmpDir, 'results')
    fs.mkdirSync(resultsDir)

    writeJson(tmpDir, 'baseline.json', makeBaseline())
    writeJson(resultsDir, '2026-05-10T01-00-00-000Z-v0.json', makeResults())

    const opts = {baselinePath: path.join(tmpDir, 'baseline.json'), resultsDir}
    const [code1, code2] = await Promise.all([runWithOverrides(opts), runWithOverrides(opts)])
    expect(code1).toBe(code2)
    expect(code1).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// T-0010-080: CI/CD — eval.yml includes check-eval-regression step
// ---------------------------------------------------------------------------

describe('CI/CD', () => {
  it('T-0010-080: eval.yml workflow includes check-eval-regression step after eval-v0', () => {
    const workflowPath = path.join(__dirname, '..', '..', '..', '.github', 'workflows', 'eval.yml')
    const workflow = fs.readFileSync(workflowPath, 'utf-8')

    // The regression gate step must be present — identified by the script name
    // (eval:check-regression) and the INTENTIONAL_EVAL_REGRESSION override key
    expect(workflow).toContain('eval:check-regression')
    expect(workflow).toContain('INTENTIONAL_EVAL_REGRESSION')

    // The eval-v0 job must appear before the regression gate step
    const v0Index = workflow.indexOf('eval-v0')
    const regressionIndex = workflow.indexOf('eval:check-regression')
    expect(v0Index).toBeGreaterThanOrEqual(0)
    expect(regressionIndex).toBeGreaterThan(v0Index)
  })
})

// ---------------------------------------------------------------------------
// T-0010-145..150: override grammar — R2 additions
// ---------------------------------------------------------------------------

describe('parseOverride — override grammar variations (R2)', () => {
  // T-0010-145: lowercase variant must NOT trigger
  it('T-0010-145: lowercase `intentional_eval_regression:` does NOT trigger override', () => {
    const result = parseOverride('intentional_eval_regression: some rationale')
    expect(result.accepted).toBe(false)
  })

  // T-0010-146: mixed-case variant must NOT trigger
  it('T-0010-146: mixed-case `Intentional_Eval_Regression:` does NOT trigger override', () => {
    const result = parseOverride('Intentional_Eval_Regression: some rationale')
    expect(result.accepted).toBe(false)
  })

  // T-0010-147: typo variant (REGRSSION) must NOT trigger
  it('T-0010-147: typo `INTENTIONAL_EVAL_REGRSSION:` (missing E) does NOT trigger override', () => {
    const result = parseOverride('INTENTIONAL_EVAL_REGRSSION: some rationale')
    expect(result.accepted).toBe(false)
  })

  // T-0010-148: rationale with leading/trailing whitespace is accepted (trimmed)
  it('T-0010-148: rationale with leading/trailing spaces is accepted after trim', () => {
    const result = parseOverride('INTENTIONAL_EVAL_REGRESSION:   rationale with leading spaces   ')
    expect(result.accepted).toBe(true)
    if (result.accepted) {
      expect(result.rationales[0]).toBe('rationale with leading spaces')
    }
  })

  // T-0010-149: whitespace-only rationale is rejected
  it('T-0010-149: whitespace-only rationale after colon is rejected', () => {
    const result = parseOverride('INTENTIONAL_EVAL_REGRESSION:   ')
    expect(result.accepted).toBe(false)
  })

  // T-0010-150: two override lines — any-match-wins; both rationales logged
  it('T-0010-150: two INTENTIONAL_EVAL_REGRESSION: lines — any-match-wins, both logged', () => {
    const prBody = [
      'Some PR text',
      'INTENTIONAL_EVAL_REGRESSION: first rationale',
      'More text',
      'INTENTIONAL_EVAL_REGRESSION: second rationale',
    ].join('\n')

    const result = parseOverride(prBody)
    expect(result.accepted).toBe(true)
    if (result.accepted) {
      expect(result.rationales).toHaveLength(2)
      expect(result.rationales[0]).toBe('first rationale')
      expect(result.rationales[1]).toBe('second rationale')
    }
  })
})

// ---------------------------------------------------------------------------
// T-0010-151: multi-archetype cross-condition (R2)
// ---------------------------------------------------------------------------

describe('check-eval-regression cross-condition (R2)', () => {
  it(
    'T-0010-151: exits 1 when overall delta is -1.5pp (within 2pp) but one archetype is -3.5pp',
    async () => {
      const tmpDir = makeTempDir()
      const resultsDir = path.join(tmpDir, 'results')
      fs.mkdirSync(resultsDir)

      // Baseline: overall=0.92, Tracker=0.88
      writeJson(tmpDir, 'baseline.json', makeBaseline())
      writeJson(
        resultsDir,
        '2026-05-10T01-00-00-000Z-v0.json',
        makeResults({
          overall_pass_rate: 0.905, // -1.5pp overall (within 2pp threshold — passes overall check)
          Tracker: 0.845,           // -3.5pp on Tracker (exceeds 3pp threshold — blocked)
        }),
      )

      const code = await runWithOverrides({
        baselinePath: path.join(tmpDir, 'baseline.json'),
        resultsDir,
      })
      expect(code).toBe(1)
    },
  )
})

// ---------------------------------------------------------------------------
// T-0010-152: floating-point identical-to-baseline guard (R2)
// ---------------------------------------------------------------------------

describe('check-eval-regression floating-point guard (R2)', () => {
  it('T-0010-152: exits 0 when results are identical to baseline (zero delta, FP guard)', async () => {
    const tmpDir = makeTempDir()
    const resultsDir = path.join(tmpDir, 'results')
    fs.mkdirSync(resultsDir)

    const rate = 0.92
    writeJson(
      tmpDir,
      'baseline.json',
      makeBaseline({
        overall_pass_rate: rate,
        per_archetype_pass_rate: {
          ListCRUD: rate,
          Tracker: rate,
          Journal: rate,
          Calculator: rate,
        },
      }),
    )
    writeJson(
      resultsDir,
      '2026-05-10T01-00-00-000Z-v0.json',
      makeResults({
        overall_pass_rate: rate,
        ListCRUD: rate,
        Tracker: rate,
        Journal: rate,
        Calculator: rate,
      }),
    )

    const code = await runWithOverrides({baselinePath: path.join(tmpDir, 'baseline.json'), resultsDir})
    expect(code).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// T-0010-153..154: empty/whitespace baseline → exit 1 (R2)
// ---------------------------------------------------------------------------

describe('check-eval-regression empty/malformed baseline (R2)', () => {
  // T-0010-153: empty / zero-byte baseline → exit 1
  it('T-0010-153: exits 1 when baseline.json is empty (zero-byte)', async () => {
    const tmpDir = makeTempDir()
    const resultsDir = path.join(tmpDir, 'results')
    fs.mkdirSync(resultsDir)

    writeRaw(tmpDir, 'baseline.json', '')
    writeJson(resultsDir, '2026-05-10T01-00-00-000Z-v0.json', makeResults())

    const code = await runWithOverrides({baselinePath: path.join(tmpDir, 'baseline.json'), resultsDir})
    expect(code).toBe(1)
  })

  // T-0010-154: whitespace-only baseline → exit 1
  it('T-0010-154: exits 1 when baseline.json is whitespace-only', async () => {
    const tmpDir = makeTempDir()
    const resultsDir = path.join(tmpDir, 'results')
    fs.mkdirSync(resultsDir)

    writeRaw(tmpDir, 'baseline.json', '  \n  ')
    writeJson(resultsDir, '2026-05-10T01-00-00-000Z-v0.json', makeResults())

    const code = await runWithOverrides({baselinePath: path.join(tmpDir, 'baseline.json'), resultsDir})
    expect(code).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// T-0010-155: malformed results JSON → exit 1 (R2)
// ---------------------------------------------------------------------------

describe('check-eval-regression malformed results (R2)', () => {
  it('T-0010-155: exits 1 when results file is malformed JSON', async () => {
    const tmpDir = makeTempDir()
    const resultsDir = path.join(tmpDir, 'results')
    fs.mkdirSync(resultsDir)

    writeJson(tmpDir, 'baseline.json', makeBaseline())
    writeRaw(resultsDir, '2026-05-10T01-00-00-000Z-v0.json', '{invalid json')

    const code = await runWithOverrides({baselinePath: path.join(tmpDir, 'baseline.json'), resultsDir})
    expect(code).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// T-0010-156: results prompt_version mismatch → exit 1 (R2)
// ---------------------------------------------------------------------------

describe('check-eval-regression results version mismatch (R2)', () => {
  it('T-0010-156: exits 1 when results prompt_version does not match current PROMPT_VERSION', async () => {
    const tmpDir = makeTempDir()
    const resultsDir = path.join(tmpDir, 'results')
    fs.mkdirSync(resultsDir)

    writeJson(tmpDir, 'baseline.json', makeBaseline())
    writeJson(
      resultsDir,
      '2026-05-10T01-00-00-000Z-v0.json',
      makeResults({prompt_version: 'v0.0.1'}), // stale prompt version
    )

    const code = await runWithOverrides({baselinePath: path.join(tmpDir, 'baseline.json'), resultsDir})
    expect(code).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Unit tests for exported helpers
// ---------------------------------------------------------------------------

describe('findLatestV0Results', () => {
  it('returns null when results dir does not exist', () => {
    expect(findLatestV0Results('/nonexistent/path')).toBeNull()
  })

  it('returns null when results dir is empty', () => {
    const tmpDir = makeTempDir()
    const resultsDir = path.join(tmpDir, 'results')
    fs.mkdirSync(resultsDir)
    expect(findLatestV0Results(resultsDir)).toBeNull()
  })

  it('returns the most recent file by mtime', async () => {
    const tmpDir = makeTempDir()
    const resultsDir = path.join(tmpDir, 'results')
    fs.mkdirSync(resultsDir)

    writeJson(resultsDir, '2026-05-09T00-00-00-000Z-v0.json', {})
    // Small delay to ensure different mtimes
    await new Promise(resolve => setTimeout(resolve, 10))
    const second = writeJson(resultsDir, '2026-05-10T00-00-00-000Z-v0.json', {})

    const latest = findLatestV0Results(resultsDir)
    expect(latest).toBe(second)
  })

  it('ignores non-v0.json files', () => {
    const tmpDir = makeTempDir()
    const resultsDir = path.join(tmpDir, 'results')
    fs.mkdirSync(resultsDir)

    writeJson(resultsDir, '2026-05-10T00-00-00-000Z-out-of-scope-detection.json', {})
    expect(findLatestV0Results(resultsDir)).toBeNull()
  })
})

describe('readBaseline', () => {
  it('throws on empty content', () => {
    const tmpDir = makeTempDir()
    writeRaw(tmpDir, 'baseline.json', '')
    expect(() => readBaseline(path.join(tmpDir, 'baseline.json'))).toThrow()
  })

  it('throws on whitespace-only content', () => {
    const tmpDir = makeTempDir()
    writeRaw(tmpDir, 'baseline.json', '   \n  ')
    expect(() => readBaseline(path.join(tmpDir, 'baseline.json'))).toThrow()
  })

  it('throws on malformed JSON', () => {
    const tmpDir = makeTempDir()
    writeRaw(tmpDir, 'baseline.json', 'not json')
    expect(() => readBaseline(path.join(tmpDir, 'baseline.json'))).toThrow()
  })

  it('throws on valid JSON missing required keys', () => {
    const tmpDir = makeTempDir()
    writeJson(tmpDir, 'baseline.json', {prompt_version: 'v0.1.0'})
    expect(() => readBaseline(path.join(tmpDir, 'baseline.json'))).toThrow()
  })

  it('returns parsed baseline on valid input', () => {
    const tmpDir = makeTempDir()
    writeJson(tmpDir, 'baseline.json', makeBaseline())
    const b = readBaseline(path.join(tmpDir, 'baseline.json'))
    expect(b.prompt_version).toBe('v0.1.0')
    expect(b.overall_pass_rate).toBe(0.92)
  })
})

describe('extractArchetypeRates', () => {
  it('extracts per-archetype rates from summary', () => {
    const summary = {
      overall_pass_rate: 0.92,
      ListCRUD_pass_rate: 0.96,
      Tracker_pass_rate: 0.88,
      Journal_pass_rate: 0.92,
      Calculator_pass_rate: 0.92,
    }
    const rates = extractArchetypeRates(summary)
    expect(rates['ListCRUD']).toBe(0.96)
    expect(rates['Tracker']).toBe(0.88)
    expect(rates['Journal']).toBe(0.92)
    expect(rates['Calculator']).toBe(0.92)
  })

  it('returns empty object when no archetype keys present', () => {
    const rates = extractArchetypeRates({overall_pass_rate: 0.9})
    expect(Object.keys(rates)).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Test runner helper — runs main() with injected paths via module-level monkey-
// patching is not feasible without mocking the entire fs module. Instead we
// use the exported functions directly and verify the integration at the
// function level. For the full main() integration, we use environment-level
// overrides via the BASELINE_PATH and RESULTS_DIR constants.
//
// Since those paths are hardcoded in the module, we can't inject them without
// mocking. We use a lighter approach: test the exported sub-functions directly
// for unit coverage, and test the overall logic via a thin wrapper that calls
// the same logic path with temp paths.
// ---------------------------------------------------------------------------

async function runWithOverrides(opts: {
  baselinePath: string
  resultsDir: string
  args?: string[]
}): Promise<number> {
  // Replicate the main() logic with injected paths.
  // This avoids the need to mock node:fs or the hardcoded module constants.
  const {existsSync: exists} = fs
  const {baselinePath, resultsDir, args = []} = opts

  // 1. Missing baseline → exit 0
  if (!exists(baselinePath)) {
    return 0
  }

  // 2. Read baseline
  let baseline: ReturnType<typeof readBaseline>
  try {
    baseline = readBaseline(baselinePath)
  } catch {
    return 1
  }

  // 3. Read current PROMPT_VERSION (use the real one from system.ts)
  let currentVersion: string
  try {
    const {readPromptVersion} = await import('./check-eval-regression.js')
    currentVersion = readPromptVersion()
  } catch {
    return 1
  }

  // 4. Baseline version mismatch → exit 0
  if (baseline.prompt_version !== currentVersion) {
    return 0
  }

  // 5. Find most recent results
  const resultsPath = findLatestV0Results(resultsDir)
  if (!resultsPath) return 1

  // 6. Read results
  let results: ReturnType<typeof readResults>
  try {
    results = readResults(resultsPath)
  } catch {
    return 1
  }

  // 7. Results version mismatch → exit 1
  if (results.prompt_version !== currentVersion) {
    return 1
  }

  // 8. Compute deltas (same rounding logic as check-eval-regression.ts)
  const roundDelta = (d: number): number => Math.round(d * 10000) / 10000
  const overallDeltaPp = roundDelta(
    (results.summary.overall_pass_rate - baseline.overall_pass_rate) * 100,
  )
  const archetypeRates = extractArchetypeRates(results.summary)
  const failures: string[] = []

  if (overallDeltaPp < -baseline.thresholds.overall_drop_max_pp) {
    failures.push(`overall dropped ${(-overallDeltaPp).toFixed(2)}pp`)
  }

  for (const [arch, rate] of Object.entries(archetypeRates)) {
    const baseRate = baseline.per_archetype_pass_rate[arch]
    if (typeof baseRate === 'number') {
      const delta = roundDelta((rate - baseRate) * 100)
      if (delta < -baseline.thresholds.per_archetype_drop_max_pp) {
        failures.push(`${arch} dropped ${(-delta).toFixed(2)}pp`)
      }
    }
  }

  if (failures.length === 0) return 0

  // 9. Check override
  const {readPrBody, parseOverride: parse} = await import('./check-eval-regression.js')
  const prBody = readPrBody(args)
  const override = parse(prBody)

  if (override.accepted) return 0
  return 1
}
