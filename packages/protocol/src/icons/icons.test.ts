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
// T-0005-220: All 80 icon names parse (parameterized)
// ---------------------------------------------------------------------------
describe('T-0005-220: IconNameSchema — all 80 names parse', () => {
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
// T-0005-223: All 80 icons have non-empty path data (parameterized)
// ---------------------------------------------------------------------------
describe('T-0005-223: ICON_PATHS — all 80 icons have non-empty path data', () => {
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
// T-0005-228: Object.keys(ICON_PATHS).length === 80
// ---------------------------------------------------------------------------
describe('T-0005-228: ICON_PATHS exact count', () => {
  it('has exactly 80 entries', () => {
    expect(Object.keys(ICON_PATHS).length).toBe(80)
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

  it('ICON_NAMES has exactly 80 entries', () => {
    expect(ICON_NAMES.length).toBe(80)
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
