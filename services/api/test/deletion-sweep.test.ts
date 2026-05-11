/**
 * ADR-0007 Step 6 Deletion Sweep Tests
 *
 * T-IDs covered:
 *   T-0007-124 through T-0007-135f — file existence checks (deleted files must not exist)
 *   T-0007-136 through T-0007-139  — grep assertions (no @app-creator/a2ui-schema imports)
 *   T-0007-143                     — env.ts does NOT define PLAN_BUILD_* vars
 *   T-0007-147                     — index.ts does NOT register /edit route
 *   T-0007-149                     — adr-index.md shows ADR-0004 status: Superseded
 *   T-0007-150                     — adr-index.md contains ADR-0007 row
 *   T-0007-151                     — ADR-0004 status header reads "Superseded"
 *
 * Filesystem assertions use fs.existsSync.
 * Grep assertions use execSync guarded by process.platform !== 'win32'.
 * Source-code assertions use fs.readFileSync for non-grep content checks.
 *
 * Note: T-0007-148 (all kept tests pass) and T-0007-144 (EVAL_MODE defined)
 * are covered by the test suite running to zero failures and env.test.ts respectively.
 * T-0007-184 (live 404 on /edit) is a Docker-gated runtime test — skipped here,
 * covered by the source-level T-0007-147.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import {execSync} from 'node:child_process'

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, '../../..')
const API_SRC = path.join(ROOT, 'services/api/src')
const API_TEST = path.join(ROOT, 'services/api/test')
const API_EVAL = path.join(ROOT, 'services/api/eval')
const API_PKG = path.join(ROOT, 'services/api/package.json')
const ADR_INDEX = path.join(ROOT, '.claude/references/adr-index.md')
const ADR_0004 = path.join(ROOT, 'docs/adrs/ADR-0004-plan-build-pipeline.md')
const SERVER_TS = path.join(API_SRC, 'server.ts')
const ENV_TS = path.join(API_SRC, 'lib/env.ts')

function src(...parts: string[]): string {
  return path.join(API_SRC, ...parts)
}

function grepReturnsNoMatches(pattern: string, dir: string): boolean {
  try {
    const result = execSync(`grep -rn "${pattern}" "${dir}"`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    // If grep found matches it returns output; filter out comment-only matches
    // (lines where the match is preceded by * or //) to avoid false positives
    // from documentation strings in the deletion-sweep.test.ts file itself.
    const importLines = result
      .trim()
      .split('\n')
      .filter(line => {
        const trimmed = line.replace(/^[^:]+:\d+:\s*/, '') // strip filename:linenum:
        // Only flag actual import statements, not comments or string literals in comments
        return /^import\b/.test(trimmed) || /from ['"]@app-creator\/a2ui-schema/.test(trimmed)
      })
    return importLines.length === 0
  } catch (err: unknown) {
    // grep exits with code 1 when no matches — that's the success case for us
    const execError = err as {status?: number}
    if (execError.status === 1) return true
    throw err
  }
}

// ---------------------------------------------------------------------------
// T-0007-124..135f: Files that must NOT exist after deletion sweep
// ---------------------------------------------------------------------------

describe('T-0007-124..135f: Deleted files do not exist', () => {
  const DELETED_FILES = [
    // T-0007-124
    {t: 'T-0007-124', file: src('llm/planner.ts')},
    // T-0007-125
    {t: 'T-0007-125', file: src('llm/planner.test.ts')},
    // T-0007-126
    {t: 'T-0007-126', file: src('llm/prompts/planner.ts')},
    // T-0007-127
    {t: 'T-0007-127', file: src('llm/pipeline.ts')},
    // T-0007-128
    {t: 'T-0007-128', file: src('llm/pipeline.test.ts')},
    // T-0007-129
    {t: 'T-0007-129', file: src('llm/tools/producePlan.ts')},
    // T-0007-130
    {t: 'T-0007-130', file: src('llm/tools/produceAppSpecPatch.ts')},
    // T-0007-131
    {t: 'T-0007-131', file: src('llm/serializePlan.ts')},
    // T-0007-132
    {t: 'T-0007-132', file: src('llm/patchValidation.ts')},
    // T-0007-133
    {t: 'T-0007-133', file: src('routes/edit.ts')},
    // T-0007-134
    {t: 'T-0007-134', file: src('services/specValidation.ts')},
    // T-0007-135
    {t: 'T-0007-135', file: src('lib/canonical.ts')},
    // T-0007-135a
    {t: 'T-0007-135a', file: src('llm/tools/producePlan.test.ts')},
    // T-0007-135b
    {t: 'T-0007-135b', file: src('llm/tools/produceAppSpecPatch.test.ts')},
    // T-0007-135c (may not have existed — still asserts absence)
    {t: 'T-0007-135c', file: src('llm/serializePlan.test.ts')},
    // T-0007-135d
    {t: 'T-0007-135d', file: src('llm/patchValidation.test.ts')},
    // T-0007-135e
    {t: 'T-0007-135e', file: src('routes/edit.test.ts')},
    // T-0007-135f
    {t: 'T-0007-135f', file: src('services/specValidation.test.ts')},
  ]

  for (const {t, file} of DELETED_FILES) {
    it(`${t}: ${path.relative(ROOT, file)} does not exist`, () => {
      expect(fs.existsSync(file)).toBe(false)
    })
  }
})

// ---------------------------------------------------------------------------
// T-0007-136..138: No @app-creator/a2ui-schema imports remain in services/api
// ---------------------------------------------------------------------------

describe('T-0007-136..138: No @app-creator/a2ui-schema imports in services/api', () => {
  const SCHEMA_IMPORT = '@app-creator/a2ui-schema'

  // These grep tests use execSync which relies on Unix grep; skip on Windows CI.
  const it_unix = process.platform === 'win32' ? it.todo : it

  it_unix(
    `T-0007-136: grep -rn "${SCHEMA_IMPORT}" services/api/src returns zero matches`,
    () => {
      expect(grepReturnsNoMatches(SCHEMA_IMPORT, API_SRC)).toBe(true)
    },
  )

  it_unix(
    `T-0007-137: grep -rn "${SCHEMA_IMPORT}" services/api/test returns zero matches`,
    () => {
      expect(grepReturnsNoMatches(SCHEMA_IMPORT, API_TEST)).toBe(true)
    },
  )

  it_unix(
    `T-0007-138: grep -rn "${SCHEMA_IMPORT}" services/api/eval returns zero matches`,
    () => {
      // eval/ may not exist yet (Step 7 PR); assert it either doesn't exist or has no matches
      if (!fs.existsSync(API_EVAL)) return
      expect(grepReturnsNoMatches(SCHEMA_IMPORT, API_EVAL)).toBe(true)
    },
  )
})

// ---------------------------------------------------------------------------
// T-0007-139: package.json does NOT list @app-creator/a2ui-schema
// ---------------------------------------------------------------------------

describe('T-0007-139: package.json does not list @app-creator/a2ui-schema', () => {
  it('T-0007-139: @app-creator/a2ui-schema is not in dependencies', () => {
    const pkg = JSON.parse(fs.readFileSync(API_PKG, 'utf8')) as {
      dependencies?: Record<string, string>
    }
    expect(Object.keys(pkg.dependencies ?? {})).not.toContain('@app-creator/a2ui-schema')
  })
})

// ---------------------------------------------------------------------------
// T-0007-143: env.ts does NOT define PLAN_BUILD_* vars
// ---------------------------------------------------------------------------

describe('T-0007-143: env.ts does not define PLAN_BUILD_* variables', () => {
  it('T-0007-143: env.ts source does not contain PLAN_BUILD_PIPELINE_PERCENT', () => {
    const source = fs.readFileSync(ENV_TS, 'utf8')
    expect(source).not.toContain('PLAN_BUILD_PIPELINE_PERCENT')
  })

  it('T-0007-143: env.ts source does not contain PLAN_BUILD_PIPELINE_SHADOW', () => {
    const source = fs.readFileSync(ENV_TS, 'utf8')
    expect(source).not.toContain('PLAN_BUILD_PIPELINE_SHADOW')
  })

  it('T-0007-143: env.ts source does not contain PLAN_BUILD_EVAL_MODE', () => {
    const source = fs.readFileSync(ENV_TS, 'utf8')
    expect(source).not.toContain('PLAN_BUILD_EVAL_MODE')
  })
})

// ---------------------------------------------------------------------------
// T-0007-147: server.ts does NOT register the /edit route
// ---------------------------------------------------------------------------

describe('T-0007-147: server.ts does not register the /edit route', () => {
  it("T-0007-147: server.ts does not import from './routes/edit.js'", () => {
    const source = fs.readFileSync(SERVER_TS, 'utf8')
    expect(source).not.toContain("from './routes/edit.js'")
    expect(source).not.toContain('editRoutes')
  })

  it('T-0007-147: server.ts does not call register(editRoutes)', () => {
    const source = fs.readFileSync(SERVER_TS, 'utf8')
    expect(source).not.toContain('editRoutes')
  })
})

// ---------------------------------------------------------------------------
// T-0007-149: adr-index.md shows ADR-0004 status: Superseded by ADR-0007
// ---------------------------------------------------------------------------

describe('T-0007-149: adr-index.md shows ADR-0004 as Superseded', () => {
  it('T-0007-149: adr-index.md contains "Superseded by ADR-0007" for ADR-0004 row', () => {
    const source = fs.readFileSync(ADR_INDEX, 'utf8')
    // The ADR-0004 row must contain "Superseded"
    const lines = source.split('\n')
    const adr0004Line = lines.find(l => l.includes('| 0004 |'))
    expect(adr0004Line).toBeDefined()
    expect(adr0004Line).toContain('Superseded')
  })
})

// ---------------------------------------------------------------------------
// T-0007-150: adr-index.md contains ADR-0007 row
// ---------------------------------------------------------------------------

describe('T-0007-150: adr-index.md contains ADR-0007 row', () => {
  it('T-0007-150: adr-index.md has a row for ADR-0007 with relevant tags', () => {
    const source = fs.readFileSync(ADR_INDEX, 'utf8')
    expect(source).toContain('| 0007 |')
    // Must include at least one of the required tags
    const lines = source.split('\n')
    const adr0007Line = lines.find(l => l.includes('| 0007 |'))
    expect(adr0007Line).toBeDefined()
    expect(adr0007Line).toMatch(/llm|generation|v0/)
  })
})

// ---------------------------------------------------------------------------
// T-0007-151: ADR-0004 status header reads "Superseded"
// ---------------------------------------------------------------------------

describe('T-0007-151: ADR-0004 status header reads "Superseded"', () => {
  it('T-0007-151: ADR-0004-plan-build-pipeline.md Status section contains "Superseded"', () => {
    const source = fs.readFileSync(ADR_0004, 'utf8')
    // Find the ## Status block and verify it contains Superseded
    const statusIdx = source.indexOf('## Status')
    expect(statusIdx).toBeGreaterThan(-1)
    const statusSection = source.slice(statusIdx, statusIdx + 200)
    expect(statusSection).toContain('Superseded')
  })
})
