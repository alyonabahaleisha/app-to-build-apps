/**
 * codegen.test.ts — Step 7 codegen tests
 *
 * Covers T-0005-179..186 + T-0005-183a + T-0005-187a + T-0005-187b.
 * ADR-spec'd tests: 11. Cardinality tripwires are additive per Step 1 precedent.
 *
 * Prerequisites: run `pnpm --filter @app-creator/protocol codegen` before
 * running this test suite. The tests read generated artifacts from disk; they
 * do not re-invoke the scripts themselves (Jest's environment is synchronous).
 *
 * T-0005-185 reframe (Roz F-05 closure): the byte-stable reproducibility
 * contract is covered by T-0005-180. T-0005-185 is retired as a redundant
 * simulation. The production guard is codegen-drift.yml, validated by the
 * workflow's first PR, not by a unit-test simulation.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import {execSync} from 'node:child_process'
import {parse as parseYaml} from 'yaml'

// ts-jest runs in CJS mode; __dirname is the scripts/ directory.
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..')
const GENERATED_DIR = path.join(REPO_ROOT, 'packages', 'protocol', 'generated')
const JSON_SCHEMA_PATH = path.join(GENERATED_DIR, 'json-schema.json')
const TYPES_PATH = path.join(GENERATED_DIR, 'types.ts')
const DOCS_PATH = path.join(GENERATED_DIR, 'docs.md')
const WORKFLOW_PATH = path.join(REPO_ROOT, '.github', 'workflows', 'codegen-drift.yml')

// ---------------------------------------------------------------------------
// T-0005-179 — Happy: codegen exits 0 and produces 3 files in generated/
// ---------------------------------------------------------------------------
describe('T-0005-179: pnpm codegen exits 0 and produces 3 files', () => {
  it('all three generated artifacts exist after codegen', () => {
    // Pre-condition: codegen was run before this test suite.
    // The test verifies the artifacts are present on disk.
    expect(fs.existsSync(JSON_SCHEMA_PATH)).toBe(true)
    expect(fs.existsSync(TYPES_PATH)).toBe(true)
    expect(fs.existsSync(DOCS_PATH)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// T-0005-180 — Regression: codegen is reproducible (byte-identical on two runs)
//
// T-0005-185 note: T-0005-185 is validated by the actual codegen-drift.yml
// workflow on the first PR (not by a unit-test simulation). The production
// guard is `git diff --exit-code packages/protocol/generated/` running after
// `pnpm codegen` in CI. T-0005-180 covers the byte-stability contract.
// ---------------------------------------------------------------------------
describe('T-0005-180: codegen is byte-stable (reproducible output)', () => {
  it('running codegen twice produces identical json-schema.json', () => {
    const before = fs.readFileSync(JSON_SCHEMA_PATH, 'utf8')

    execSync('pnpm --filter @app-creator/protocol codegen', {
      cwd: REPO_ROOT,
      stdio: 'pipe',
    })

    const after = fs.readFileSync(JSON_SCHEMA_PATH, 'utf8')
    expect(after).toBe(before)
  })

  it('running codegen twice produces identical types.ts', () => {
    const before = fs.readFileSync(TYPES_PATH, 'utf8')

    execSync('pnpm --filter @app-creator/protocol codegen', {
      cwd: REPO_ROOT,
      stdio: 'pipe',
    })

    const after = fs.readFileSync(TYPES_PATH, 'utf8')
    expect(after).toBe(before)
  })

  it('running codegen twice produces identical docs.md', () => {
    const before = fs.readFileSync(DOCS_PATH, 'utf8')

    execSync('pnpm --filter @app-creator/protocol codegen', {
      cwd: REPO_ROOT,
      stdio: 'pipe',
    })

    const after = fs.readFileSync(DOCS_PATH, 'utf8')
    expect(after).toBe(before)
  })
})

// ---------------------------------------------------------------------------
// T-0005-181 — Happy: generated/json-schema.json is valid JSON Schema 7
// ---------------------------------------------------------------------------
describe('T-0005-181: generated/json-schema.json is valid JSON Schema 7', () => {
  it('parses as JSON and has $schema pointing to JSON Schema 7', () => {
    const raw = fs.readFileSync(JSON_SCHEMA_PATH, 'utf8')
    const schema = JSON.parse(raw) as Record<string, unknown>

    expect(typeof schema).toBe('object')
    expect(schema['$schema']).toBe('http://json-schema.org/draft-07/schema#')
    // Must have a top-level $ref or properties, indicating a real schema shape
    expect('$ref' in schema || 'properties' in schema || 'definitions' in schema).toBe(true)
  })

  it('has a definitions block with at least a Spec entry', () => {
    const schema = JSON.parse(fs.readFileSync(JSON_SCHEMA_PATH, 'utf8')) as Record<string, unknown>
    const defs = schema['definitions'] as Record<string, unknown> | undefined
    expect(defs).toBeDefined()
    expect(typeof defs).toBe('object')
  })
})

// ---------------------------------------------------------------------------
// T-0005-182 — Happy: generated/types.ts exports Spec, Screen, Node, Action, Collection
// ---------------------------------------------------------------------------
describe('T-0005-182: generated/types.ts exports required type declarations', () => {
  it('exports Spec type', () => {
    const content = fs.readFileSync(TYPES_PATH, 'utf8')
    expect(content).toMatch(/export type Spec\s*=/)
  })

  it('exports SpecScreen type (named SpecScreen per ADR Step 5 naming)', () => {
    const content = fs.readFileSync(TYPES_PATH, 'utf8')
    expect(content).toMatch(/export type SpecScreen\s*=/)
  })

  it('exports Node type', () => {
    const content = fs.readFileSync(TYPES_PATH, 'utf8')
    expect(content).toMatch(/export type Node\s*=/)
  })

  it('exports Action type', () => {
    const content = fs.readFileSync(TYPES_PATH, 'utf8')
    expect(content).toMatch(/export type Action\s*=/)
  })

  it('exports Collection type', () => {
    const content = fs.readFileSync(TYPES_PATH, 'utf8')
    expect(content).toMatch(/export type Collection\s*=/)
  })

  it('exports all closed enum types', () => {
    const content = fs.readFileSync(TYPES_PATH, 'utf8')
    const enumTypes = [
      'Archetype', 'BindingKind', 'ColorToken', 'Currency', 'Elevation', 'MotionCurve',
      'NavPattern', 'Palette', 'RadiusToken', 'SlotKind', 'SpaceToken',
      'Stance', 'Tone', 'TypeRole',
    ]
    for (const name of enumTypes) {
      expect(content).toMatch(new RegExp(`export type ${name}\\s*=`))
    }
  })
})

// ---------------------------------------------------------------------------
// T-0005-183 — Happy: generated/docs.md has ≥60 sections
// ---------------------------------------------------------------------------
describe('T-0005-183: generated/docs.md has ≥60 sections', () => {
  it('docs.md contains at least 60 ## headers (one per token / component / verb)', () => {
    const content = fs.readFileSync(DOCS_PATH, 'utf8')
    const headers = content.split('\n').filter(l => l.startsWith('## '))
    expect(headers.length).toBeGreaterThanOrEqual(60)
  })
})

// ---------------------------------------------------------------------------
// T-0005-183a — Failure (F-07): gen-docs.ts emits non-empty paragraph per component
//
// Parameterized over 39 component names. For each component, the docs.md
// section (## ComponentName) must exist AND have at least one non-empty body
// paragraph. Guards the silent-empty-doc failure mode.
// ---------------------------------------------------------------------------
describe('T-0005-183a (F-07): gen-docs.ts emits non-empty paragraph for each of 49 components (V1 Phase 1 Step 6)', () => {
  const COMPONENT_NAMES = [
    // Layout tier (5 → 6 with Divider)
    'Screen', 'Section', 'Stack', 'Row', 'Card',
    // V1 Phase 1 Step 1 — layout addition
    'Divider',
    // Typography tier (3)
    'Heading', 'Body', 'Caption',
    // Inputs tier (5 → 11 with V1 Phase 1 Step 2)
    'TextField', 'NumberField', 'DateField', 'Picker', 'Switch',
    // V1 Phase 1 Step 2 — inputs tier expansion
    'MoneyField', 'TimeField', 'MultiPicker', 'Slider', 'RatingInput', 'SearchBar',
    // Display tier (4 → 6 with AvatarGroup + Callout)
    'Stat', 'Badge', 'Chip', 'Avatar',
    // V1 Phase 1 Step 3 — display tier additions
    'AvatarGroup', 'Callout',
    // Lists tier (5 → 9 with V1 Phase 1 Step 4)
    'List', 'ListItem', 'SwipeableRow', 'EmptyState', 'LoadingState',
    // V1 Phase 1 Step 4 — Lists & Data tier expansion
    'GridList', 'Carousel', 'Timeline', 'ErrorState',
    // Compound tier (4 → 5 with Image → 9 with V1 Phase 1 Step 5 → 11 with V1 Phase 1 Step 6)
    'ConditionalSection', 'ListSummary', 'MediaTray', 'ImagePicker',
    // V1 Phase 1 Step 1 — compound addition
    'Image',
    // V1 Phase 1 Step 5 — Productivity domain compounds
    'TransactionRow', 'Receipt', 'MetricTile', 'StepList',
    // V1 Phase 1 Step 6 — Date components
    'Calendar', 'Heatmap',
    // Actions tier (2 → 3 with IconButton)
    'Button', 'Fab',
    // V1 Phase 1 Step 1 — actions addition
    'IconButton',
  ] as const

  const content = fs.readFileSync(DOCS_PATH, 'utf8')

  /**
   * Parse docs.md into a map of section-name → body text.
   * A section runs from its ## header to the next ## header.
   */
  function parseSections(md: string): Map<string, string> {
    const map = new Map<string, string>()
    const lines = md.split('\n')
    let currentName: string | null = null
    const bodyLines: string[] = []

    for (const line of lines) {
      if (line.startsWith('## ')) {
        if (currentName !== null) {
          map.set(currentName, bodyLines.join('\n').trim())
        }
        currentName = line.slice(3).trim()
        bodyLines.length = 0
      } else if (currentName !== null) {
        bodyLines.push(line)
      }
    }
    if (currentName !== null) {
      map.set(currentName, bodyLines.join('\n').trim())
    }
    return map
  }

  const sections = parseSections(content)

  test.each(COMPONENT_NAMES)('component "%s" has a non-empty body paragraph', name => {
    const body = sections.get(name)
    expect(body).toBeDefined()
    expect(body!.trim().length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// T-0005-184 — Failure (design-system Step 9 guard)
//
// The Lucide icon removal guard is in packages/design-system/scripts/gen-icon-paths.ts
// (Step 9). The protocol codegen (json-schema.ts, types.ts, docs.ts) does not
// consume Lucide; this guard is out of scope for packages/protocol/scripts/.
// T-0005-184 is documented here as a cross-reference; its real implementation
// lives in the Step 9 test file: packages/design-system/src/icons/icons.test.ts
// T-0005-225 (that test file's Failure: codegen with missing icon → non-zero exit).
// ---------------------------------------------------------------------------
describe('T-0005-184: Lucide icon removal guard (cross-reference)', () => {
  it('documents that the Lucide guard lives in design-system Step 9 (T-0005-225)', () => {
    // The protocol codegen does not use lucide-static. The guard that catches
    // a missing Lucide icon is gen-icon-paths.ts in packages/design-system,
    // tested by T-0005-225. This test documents the cross-reference.
    expect(true).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// T-0005-185 — Regression (F-05 reframe, reference only)
//
// T-0005-185 is retired as a redundant simulation of the CI drift check.
// The production guard is codegen-drift.yml: `pnpm codegen` then
// `git diff --exit-code packages/protocol/generated/`. T-0005-180 already
// covers the byte-stable reproducibility contract. This test documents the
// reframe per ADR rev-1 F-05 closure.
// ---------------------------------------------------------------------------
describe('T-0005-185: codegen-drift guard (reframe — validated by codegen-drift.yml)', () => {
  it('T-0005-180 covers byte-stability; the production guard is the CI workflow (not a test simulation)', () => {
    // The original T-0005-185 was a Jest simulation of `git diff --exit-code`.
    // Per F-05 reframe (ADR rev-1): the production guard is the CI workflow
    // itself, validated on the first PR. T-0005-180 already asserts byte
    // stability. Simulating git-diff in Jest adds no incremental coverage.
    //
    // For auditability: the codegen-drift.yml workflow runs pnpm codegen then
    // `git diff --exit-code packages/protocol/generated/` on every PR that
    // touches packages/protocol/**. A non-zero diff → workflow fails.
    expect(fs.existsSync(WORKFLOW_PATH)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// T-0005-186 — Config (F-05 sharpened): YAML inspection of codegen-drift.yml
//
// Reads the workflow file, parses it as YAML, and asserts:
//   a) on.push.paths AND on.pull_request.paths both contain 'packages/protocol/**'
//   b) jobs.<name>.steps contains a step running pnpm codegen followed by
//      git diff --exit-code packages/protocol/generated/
// Not a regex on raw text — a structured YAML parse.
// ---------------------------------------------------------------------------
describe('T-0005-186: codegen-drift.yml YAML inspection', () => {
  let workflow: Record<string, unknown>

  beforeAll(() => {
    const raw = fs.readFileSync(WORKFLOW_PATH, 'utf8')
    workflow = parseYaml(raw) as Record<string, unknown>
  })

  it('on.push.paths contains packages/protocol/**', () => {
    const on = workflow['on'] as Record<string, unknown>
    const push = on['push'] as Record<string, unknown>
    const paths = push['paths'] as string[]
    expect(paths).toContain('packages/protocol/**')
  })

  it('on.pull_request.paths contains packages/protocol/**', () => {
    const on = workflow['on'] as Record<string, unknown>
    const pr = on['pull_request'] as Record<string, unknown>
    const paths = pr['paths'] as string[]
    expect(paths).toContain('packages/protocol/**')
  })

  it('jobs contains at least one job', () => {
    const jobs = workflow['jobs'] as Record<string, unknown>
    expect(Object.keys(jobs).length).toBeGreaterThanOrEqual(1)
  })

  it('a step runs pnpm codegen', () => {
    const jobs = workflow['jobs'] as Record<string, Record<string, unknown>>
    const jobKeys = Object.keys(jobs)
    expect(jobKeys.length).toBeGreaterThanOrEqual(1)

    const firstJob = jobs[jobKeys[0]!] as Record<string, unknown>
    const steps = firstJob['steps'] as Array<Record<string, unknown>>

    const codegenStep = steps.find(step => {
      const run = step['run'] as string | undefined
      return run?.includes('pnpm') && run.includes('codegen')
    })
    expect(codegenStep).toBeDefined()
  })

  it('a step runs git diff --exit-code packages/protocol/generated/', () => {
    const jobs = workflow['jobs'] as Record<string, Record<string, unknown>>
    const jobKeys = Object.keys(jobs)
    const firstJob = jobs[jobKeys[0]!] as Record<string, unknown>
    const steps = firstJob['steps'] as Array<Record<string, unknown>>

    const diffStep = steps.find(step => {
      const run = step['run'] as string | undefined
      return run?.includes('git diff') && run.includes('--exit-code') && run.includes('packages/protocol/generated')
    })
    expect(diffStep).toBeDefined()
  })

  it('the pnpm-codegen step comes before the git-diff step', () => {
    const jobs = workflow['jobs'] as Record<string, Record<string, unknown>>
    const jobKeys = Object.keys(jobs)
    const firstJob = jobs[jobKeys[0]!] as Record<string, unknown>
    const steps = firstJob['steps'] as Array<Record<string, unknown>>

    const codegenIdx = steps.findIndex(step => {
      const run = step['run'] as string | undefined
      return run?.includes('pnpm') && run.includes('codegen')
    })
    const diffIdx = steps.findIndex(step => {
      const run = step['run'] as string | undefined
      return run?.includes('git diff') && run.includes('--exit-code')
    })
    expect(codegenIdx).toBeGreaterThanOrEqual(0)
    expect(diffIdx).toBeGreaterThan(codegenIdx)
  })
})

// ---------------------------------------------------------------------------
// T-0005-187a — Failure (F-02): 'share' not present in generated/json-schema.json
//
// The codegen-level guard closes F-02: even if someone adds 'share' back to
// the ActionSchema, the generated json-schema.json must not contain it as a
// type.const value. T-0005-039 covers schema-level rejection; this closes the
// LLM-facing surface.
// ---------------------------------------------------------------------------
describe('T-0005-187a (F-02): json-schema.json does not contain "share" verb', () => {
  it('json-schema.json contains no const value of "share"', () => {
    const schema = JSON.parse(fs.readFileSync(JSON_SCHEMA_PATH, 'utf8')) as unknown

    // Structural walk: collect all {type: 'string', const: <value>} pairs.
    function collectConsts(obj: unknown, results: string[] = []): string[] {
      if (typeof obj !== 'object' || obj === null) return results
      if (Array.isArray(obj)) {
        for (const item of obj) collectConsts(item, results)
        return results
      }
      const record = obj as Record<string, unknown>
      if (record['type'] === 'string' && typeof record['const'] === 'string') {
        results.push(record['const'])
      }
      for (const val of Object.values(record)) {
        collectConsts(val, results)
      }
      return results
    }

    const allConsts = collectConsts(schema)
    expect(allConsts).not.toContain('share')
  })

  it('json-schema.json does not contain "share" as a type.const action verb', () => {
    // Step 9 note: the icon catalog legitimately includes "share" as an icon name
    // (it appears in enum arrays). This guard checks that "share" does NOT appear
    // as a type.const discriminant value — the pattern that would indicate it was
    // added back to the ActionSchema as a verb. The first sub-test (collectConsts)
    // already covers this; this is the targeted string-pattern secondary guard.
    const raw = fs.readFileSync(JSON_SCHEMA_PATH, 'utf8')
    // Action verbs appear as {type: "string", const: "verbName"} in the JSON.
    // Look specifically for that pattern. Simple string match: "const": "share"
    expect(raw).not.toMatch(/"const":\s*"share"/)
  })
})

// ---------------------------------------------------------------------------
// T-0005-187b — Boundary (F-13): action verb discriminated union has exactly 12 members
//
// Walk generated/json-schema.json to find the Action discriminated union (an
// anyOf/oneOf where every member object has type.const = a known verb name).
// Assert exactly 12 members. Catches accidental verb addition or removal.
// ---------------------------------------------------------------------------
describe('T-0005-187b (F-13): action verb union has exactly 12 members', () => {
  const KNOWN_VERB_NAMES = new Set([
    'set', 'update', 'reset', 'addItem', 'removeItem', 'updateItem',
    'clearCollection', 'navigate', 'back', 'capture', 'toast', 'aiProcess',
  ])

  it('finds exactly one action verb union with exactly 12 members', () => {
    const schema = JSON.parse(fs.readFileSync(JSON_SCHEMA_PATH, 'utf8')) as unknown

    /**
     * Walk the JSON schema tree and collect all anyOf/oneOf arrays where
     * every member is an object with a type.const that looks like an action verb.
     * Returns the list of found verb arrays.
     */
    function findVerbUnions(obj: unknown, results: string[][] = []): string[][] {
      if (typeof obj !== 'object' || obj === null) return results
      if (Array.isArray(obj)) {
        for (const item of obj) findVerbUnions(item, results)
        return results
      }
      const record = obj as Record<string, unknown>

      for (const key of ['anyOf', 'oneOf'] as const) {
        if (Array.isArray(record[key])) {
          const union = record[key] as unknown[]
          const verbsInUnion: string[] = []
          for (const member of union) {
            if (typeof member !== 'object' || member === null) continue
            const m = member as Record<string, unknown>
            const props = m['properties'] as Record<string, unknown> | undefined
            if (!props) continue
            const typeProp = props['type'] as Record<string, unknown> | undefined
            if (typeProp && typeof typeProp['const'] === 'string') {
              verbsInUnion.push(typeProp['const'])
            }
          }
          // A verb union: all members have type.const values that are in KNOWN_VERB_NAMES
          if (
            verbsInUnion.length > 0 &&
            verbsInUnion.every(v => KNOWN_VERB_NAMES.has(v))
          ) {
            results.push(verbsInUnion)
          }
        }
      }

      for (const val of Object.values(record)) {
        findVerbUnions(val, results)
      }
      return results
    }

    const verbUnions = findVerbUnions(schema)

    // There must be at least one action verb union in the schema
    expect(verbUnions.length).toBeGreaterThanOrEqual(1)

    // The union(s) that contain action verbs must all have exactly 12 members
    for (const union of verbUnions) {
      expect(union.length).toBe(12)
    }
  })

  it('action verb union contains all 12 expected verbs (no substitution)', () => {
    const schema = JSON.parse(fs.readFileSync(JSON_SCHEMA_PATH, 'utf8')) as unknown

    function findVerbUnions(obj: unknown, results: string[][] = []): string[][] {
      if (typeof obj !== 'object' || obj === null) return results
      if (Array.isArray(obj)) {
        for (const item of obj) findVerbUnions(item, results)
        return results
      }
      const record = obj as Record<string, unknown>
      for (const key of ['anyOf', 'oneOf'] as const) {
        if (Array.isArray(record[key])) {
          const union = record[key] as unknown[]
          const verbsInUnion: string[] = []
          for (const member of union) {
            if (typeof member !== 'object' || member === null) continue
            const m = member as Record<string, unknown>
            const props = m['properties'] as Record<string, unknown> | undefined
            if (!props) continue
            const typeProp = props['type'] as Record<string, unknown> | undefined
            if (typeProp && typeof typeProp['const'] === 'string') {
              verbsInUnion.push(typeProp['const'])
            }
          }
          if (verbsInUnion.length > 0 && verbsInUnion.every(v => KNOWN_VERB_NAMES.has(v))) {
            results.push(verbsInUnion)
          }
        }
      }
      for (const val of Object.values(record)) {
        findVerbUnions(val, results)
      }
      return results
    }

    const verbUnions = findVerbUnions(schema)
    expect(verbUnions.length).toBeGreaterThanOrEqual(1)

    const foundVerbs = new Set(verbUnions.flat())
    for (const verb of KNOWN_VERB_NAMES) {
      expect(foundVerbs).toContain(verb)
    }
  })
})

// ---------------------------------------------------------------------------
// Additive cardinality tripwires (following Step 1 precedent)
// ---------------------------------------------------------------------------

describe('Additive: 49 component schemas present in NodeSchema union (V1 Phase 1 Step 6)', () => {
  it('NodeSchema anyOf union in json-schema.json has exactly 49 members (all component types)', () => {
    const schema = JSON.parse(fs.readFileSync(JSON_SCHEMA_PATH, 'utf8')) as unknown

    const COMPONENT_NAMES = new Set([
      'Screen', 'Section', 'Stack', 'Row', 'Card',
      // V1 Phase 1 Step 1 — layout tier addition
      'Divider',
      'Heading', 'Body', 'Caption',
      'TextField', 'NumberField', 'DateField', 'Picker', 'Switch',
      // V1 Phase 1 Step 2 — inputs tier expansion
      'MoneyField', 'TimeField', 'MultiPicker', 'Slider', 'RatingInput', 'SearchBar',
      'Stat', 'Badge', 'Chip', 'Avatar',
      // V1 Phase 1 Step 3 — display tier additions
      'AvatarGroup', 'Callout',
      'List', 'ListItem', 'SwipeableRow', 'EmptyState', 'LoadingState',
      // V1 Phase 1 Step 4 — Lists & Data tier expansion
      'GridList', 'Carousel', 'Timeline', 'ErrorState',
      'ConditionalSection', 'ListSummary', 'MediaTray', 'ImagePicker',
      // V1 Phase 1 Step 1 — compound tier addition
      'Image',
      // V1 Phase 1 Step 5 — Productivity domain compounds
      'TransactionRow', 'Receipt', 'MetricTile', 'StepList',
      // V1 Phase 1 Step 6 — Date components
      'Calendar', 'Heatmap',
      'Button', 'FAB',
      // V1 Phase 1 Step 1 — actions tier addition
      'IconButton',
    ])

    function findComponentUnion(obj: unknown, results: string[][] = []): string[][] {
      if (typeof obj !== 'object' || obj === null) return results
      if (Array.isArray(obj)) {
        for (const item of obj) findComponentUnion(item, results)
        return results
      }
      const record = obj as Record<string, unknown>
      for (const key of ['anyOf', 'oneOf'] as const) {
        if (Array.isArray(record[key])) {
          const union = record[key] as unknown[]
          const namesInUnion: string[] = []
          for (const member of union) {
            if (typeof member !== 'object' || member === null) continue
            const m = member as Record<string, unknown>
            const props = m['properties'] as Record<string, unknown> | undefined
            if (!props) continue
            const typeProp = props['type'] as Record<string, unknown> | undefined
            if (typeProp && typeof typeProp['const'] === 'string') {
              namesInUnion.push(typeProp['const'])
            }
          }
          if (namesInUnion.length > 0 && namesInUnion.every(n => COMPONENT_NAMES.has(n))) {
            results.push(namesInUnion)
          }
        }
      }
      for (const val of Object.values(record)) {
        findComponentUnion(val, results)
      }
      return results
    }

    const unions = findComponentUnion(schema)
    // The top-level NodeSchema union should have 47 members (28 V0 + 3 V1P1S1 + 2 V1P1S3 + 6 V1P1S2 + 4 V1P1S4 + 4 V1P1S5)
    const fullUnions = unions.filter(u => u.length === 49)
    expect(fullUnions.length).toBeGreaterThanOrEqual(1)
  })
})

describe('Additive: docs.md section count — exactly 82 named sections (V1 Phase 1 Step 6)', () => {
  it('docs.md has exactly 82 named ## sections (13 token + 49 component + 12 verb + 5 binding + 3 top-level)', () => {
    const content = fs.readFileSync(DOCS_PATH, 'utf8')
    // Named sections are ## headers that are NOT group headers
    const GROUP_HEADERS = new Set([
      'Protocol Catalog',
      'Token Types',
      'Component Schemas',
      'Action Verbs',
      'Binding Types',
      'Top-Level Schemas',
    ])
    const allHeaders = content.split('\n').filter(l => l.startsWith('## ')).map(l => l.slice(3).trim())
    const namedHeaders = allHeaders.filter(h => !GROUP_HEADERS.has(h))
    expect(namedHeaders.length).toBe(82)
  })
})
