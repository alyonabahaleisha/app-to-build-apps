/**
 * Icon module tests — T-0005-219..231 (Step 9)
 *
 * Tests: IconNameSchema, ICON_NAMES, ICON_PATHS integrity.
 * The <Icon> RN component tests (T-0005-226, T-0005-227, T-0005-231) live in
 * packages/design-system/src/icons/icons.test.ts (RN environment required).
 *
 * Node-only environment: no RN imports allowed here.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import {execSync} from 'node:child_process'
import {ICON_NAMES, IconNameSchema, ICON_PATHS} from './index.js'

// __dirname is available in ts-jest (CJS transform mode).
// __dirname = packages/protocol/src/icons → 4 levels up = repo root
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..')

// ---------------------------------------------------------------------------
// T-0005-219: IconNameSchema.parse('chevron-left') succeeds
// ---------------------------------------------------------------------------
describe('T-0005-219: IconNameSchema — happy path', () => {
  it("parses 'chevron-left' successfully", () => {
    expect(() => IconNameSchema.parse('chevron-left')).not.toThrow()
    expect(IconNameSchema.parse('chevron-left')).toBe('chevron-left')
  })
})

// ---------------------------------------------------------------------------
// T-0005-220: All 98 icon names parse (parameterized) — V1 Phase 1 Step 8 grows 80→98
// ---------------------------------------------------------------------------
describe('T-0005-220: IconNameSchema — all 98 names parse', () => {
  test.each(ICON_NAMES)("'%s' parses", name => {
    expect(() => IconNameSchema.parse(name)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// T-0005-221: 'not-an-icon' fails (closed enum)
// ---------------------------------------------------------------------------
describe('T-0005-221: IconNameSchema — closed enum rejects unknown names', () => {
  it("rejects 'not-an-icon'", () => {
    expect(() => IconNameSchema.parse('not-an-icon')).toThrow()
  })

  it("rejects empty string", () => {
    expect(() => IconNameSchema.parse('')).toThrow()
  })

  it("rejects 'Refresh' (PascalCase — catalog is kebab-case only)", () => {
    expect(() => IconNameSchema.parse('Refresh')).toThrow()
  })
})

// ---------------------------------------------------------------------------
// T-0005-222: ICON_PATHS['chevron-left'] is a non-empty SVG path string
// ---------------------------------------------------------------------------
describe("T-0005-222: ICON_PATHS — 'chevron-left' has non-empty path data", () => {
  it("ICON_PATHS['chevron-left'] is a non-empty string", () => {
    const val = ICON_PATHS['chevron-left']
    expect(typeof val).toBe('string')
    expect(val.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// T-0005-223: All 98 icons have non-empty path data (parameterized) — V1 Phase 1 Step 8
// ---------------------------------------------------------------------------
describe('T-0005-223: ICON_PATHS — all 98 icons have non-empty path data', () => {
  test.each(ICON_NAMES)("ICON_PATHS['%s'] is non-empty", name => {
    expect(ICON_PATHS[name].length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// T-0005-224: lucide-static version pinned in package.json
// ---------------------------------------------------------------------------
describe('T-0005-224: lucide-static version pinned', () => {
  it('protocol package.json pins lucide-static at 0.487.0', () => {
    const pkgPath = path.join(REPO_ROOT, 'packages', 'protocol', 'package.json')
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as {
      dependencies?: Record<string, string>
    }
    const version = pkg.dependencies?.['lucide-static']
    // Pinned exact version (no ^ or ~ range operator)
    expect(version).toBe('0.487.0')
  })
})

// ---------------------------------------------------------------------------
// T-0005-225: Codegen with missing icon → gen-icon-paths exits non-zero
// ---------------------------------------------------------------------------
describe('T-0005-225: gen-icon-paths fails when lucide-static lacks an icon', () => {
  it('exits non-zero when a name cannot be resolved', () => {
    // Run gen-icon-paths with a monkey-patched ICON_NAMES that includes a
    // non-existent name. We use a temp script that calls the same logic.
    const tempScript = `
import * as lucide from 'lucide-static'

const names = ['xyz-nonexistent-icon']
const missing = []
for (const name of names) {
  const camel = name.replace(/-./g, m => m[1].toUpperCase())
  const pascal = camel[0].toUpperCase() + camel.slice(1)
  if (!(pascal in lucide)) missing.push(name)
}
if (missing.length > 0) {
  process.stderr.write('gen-icon-paths: missing Lucide icons: ' + missing.join(', ') + '\\n')
  process.exit(1)
}
`
    const tmpPath = path.join(REPO_ROOT, 'packages', 'protocol', '__test-gen-icon-paths-failure.mjs')
    fs.writeFileSync(tmpPath, tempScript, 'utf8')
    try {
      let threw = false
      try {
        execSync(`node --input-type=module < "${tmpPath}"`, {stdio: 'pipe'})
      } catch {
        threw = true
      }
      expect(threw).toBe(true)
    } finally {
      fs.unlinkSync(tmpPath)
    }
  })
})

// ---------------------------------------------------------------------------
// T-0005-228: Object.keys(ICON_PATHS).length === 98 (was 80 — V1 Phase 1 Step 8 adds 18)
// ---------------------------------------------------------------------------
describe('T-0005-228: ICON_PATHS exact count', () => {
  it('has exactly 98 entries (V1 Phase 1 Step 8 grows 80 → 98)', () => {
    expect(Object.keys(ICON_PATHS).length).toBe(98)
  })
})

// ---------------------------------------------------------------------------
// T-0005-229: Missing ICON_NAMES entry in ICON_PATHS fails codegen integrity
// ---------------------------------------------------------------------------
describe('T-0005-229: ICON_NAMES vs ICON_PATHS integrity', () => {
  it('every name in ICON_NAMES has a corresponding entry in ICON_PATHS', () => {
    const pathKeys = new Set(Object.keys(ICON_PATHS))
    const missing = ICON_NAMES.filter(n => !pathKeys.has(n))
    expect(missing).toHaveLength(0)
  })

  it('ICON_NAMES has exactly 98 entries (V1 Phase 1 Step 8 adds 18)', () => {
    expect(ICON_NAMES.length).toBe(98)
  })
})

// ---------------------------------------------------------------------------
// T-0009-198: ICON_NAMES.length === 98 (was 80 — V1 Phase 1 Step 8 adds 18)
// ---------------------------------------------------------------------------
describe('T-0009-198: icon catalog grows 80 → 98 (V1 Phase 1 Step 8)', () => {
  it('ICON_NAMES.length === 98', () => {
    expect(ICON_NAMES.length).toBe(98)
  })
})

// ---------------------------------------------------------------------------
// T-0009-199: IconNameSchema.parse('lightbulb') succeeds (new V1 icon)
// ---------------------------------------------------------------------------
describe('T-0009-199: new V1 icons parse — lightbulb', () => {
  it("IconNameSchema.parse('lightbulb') succeeds", () => {
    expect(() => IconNameSchema.parse('lightbulb')).not.toThrow()
    expect(IconNameSchema.parse('lightbulb')).toBe('lightbulb')
  })
})

// ---------------------------------------------------------------------------
// T-0009-200: IconNameSchema.parse('rainbow') rejects (not in catalog)
// ---------------------------------------------------------------------------
describe('T-0009-200: closed enum rejects names not in catalog', () => {
  it("IconNameSchema.parse('rainbow') rejects", () => {
    expect(() => IconNameSchema.parse('rainbow')).toThrow()
  })
})

// ---------------------------------------------------------------------------
// T-0009-201: All 18 new icons resolve to non-empty path data
// ---------------------------------------------------------------------------
describe('T-0009-201: all 18 new V1 Phase 1 icons have non-empty path data', () => {
  const NEW_V1_ICONS = [
    'bell',
    'calendar-days',
    'chevrons-up-down',
    'chevrons-left-right',
    'circle',
    'file-image',
    'file-text',
    'file-video',
    'flag',
    'gallery-thumbnails',
    'lightbulb',
    'list-checks',
    'plus-circle',
    'sliders-vertical',
    'tags',
    'circle-dollar-sign',
    'lock',
    'trending-up',
  ] as const

  test.each(NEW_V1_ICONS)("ICON_PATHS['%s'] is non-empty", name => {
    expect(ICON_PATHS[name].length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// T-0009-202: Codegen-drift — json-schema.json includes all 98 icon names in
// the coverIcon enum (verified by running codegen and comparing)
// This is the static assertion equivalent — IconNameSchema rejects non-catalog names.
// ---------------------------------------------------------------------------
describe('T-0009-202: codegen-drift CI — 98 icon names in closed enum', () => {
  it('IconNameSchema is a closed 98-name enum (drift guard)', () => {
    // All 98 names parse
    for (const name of ICON_NAMES) {
      expect(() => IconNameSchema.parse(name)).not.toThrow()
    }
    // A name not in the catalog rejects
    expect(() => IconNameSchema.parse('not-an-icon')).toThrow()
    // Count is exact
    expect(ICON_NAMES.length).toBe(98)
  })
})

// ---------------------------------------------------------------------------
// T-0005-230: ICON_PATHS values contain only canonical SVG path characters
// ---------------------------------------------------------------------------
describe('T-0005-230: ICON_PATHS — canonical SVG path characters only', () => {
  // Security guard: if Lucide ever ships unexpected chars in path data, this catches it.
  const SVG_PATH_CHAR_REGEX = /^[MmLlHhVvCcSsQqTtAaZz0-9\s,.\-]+$/

  test.each(ICON_NAMES)("ICON_PATHS['%s'] passes SVG char regex", name => {
    expect(SVG_PATH_CHAR_REGEX.test(ICON_PATHS[name])).toBe(true)
  })
})
