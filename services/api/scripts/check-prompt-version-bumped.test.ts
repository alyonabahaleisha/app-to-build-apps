/**
 * check-prompt-version-bumped tests — ADR-0010 Step 5.
 *
 * T-0010-099 through T-0010-114, T-0010-158.
 *
 * Mocks node:child_process (execSync) and node:fs (readFileSync) to avoid
 * git dependency in CI test runs. The script logic is exercised via its
 * exported functions (readVersion, semverGt) and main().
 *
 * jest.mock() calls are hoisted above imports by Jest's babel transform,
 * so the module-under-test picks up the mocked node:child_process and
 * node:fs regardless of declaration order here.
 */

jest.mock('node:child_process')
jest.mock('node:fs')

import {execSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
import {readVersion, semverGt, main} from './check-prompt-version-bumped.js'

const mockExecSync = execSync as jest.MockedFunction<typeof execSync>
const mockReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeSystemTs(version: string): string {
  return [
    '/**',
    ' * V1 system prompt.',
    ` * PROMPT_VERSION bumped to ${version}`,
    ' */',
    '',
    `// export const PROMPT_VERSION = 'v0.0.0' // old version in comment — must be ignored`,
    '',
    `export const PROMPT_VERSION = '${version}' as const`,
    '',
    'export const SYSTEM_PROMPT_STATIC = `You are Canvas...`',
  ].join('\n')
}

// ---------------------------------------------------------------------------
// readVersion unit tests
// ---------------------------------------------------------------------------

describe('readVersion', () => {
  it('T-0010-158 extracts version from export const, not from comment', () => {
    const content = makeSystemTs('v0.2.0')
    expect(readVersion(content)).toBe('v0.2.0')
  })

  it('T-0010-110 throws when PROMPT_VERSION is missing', () => {
    expect(() => readVersion('export const SOME_OTHER = "x"')).toThrow(
      'PROMPT_VERSION not found in system.ts',
    )
  })

  it('T-0010-111 throws when PROMPT_VERSION is not a string literal (concatenated expression)', () => {
    // The regex requires the pattern to be a quoted literal on one line.
    const content = `export const PROMPT_VERSION = VERSION_PREFIX + '.0'`
    expect(() => readVersion(content)).toThrow('PROMPT_VERSION not found in system.ts')
  })

  it('T-0010-112 only reads via regex — does not execute file content', () => {
    // Adversarial content with executable side-effects. If the script ever
    // used require/import instead of regex, this would throw or have side
    // effects. The test confirms readVersion returns the version without error.
    const adversarialContent =
      `process.exit(1)\n` + `export const PROMPT_VERSION = 'v0.2.0' as const\n`
    expect(readVersion(adversarialContent)).toBe('v0.2.0')
  })

  it('T-0010-158 anchored regex: comment-only occurrence does not satisfy extraction', () => {
    // Only comment occurrence — no export const line.
    const content = `// PROMPT_VERSION = 'v0.1.0' mentioned in comment\nexport const OTHER = 'x'`
    expect(() => readVersion(content)).toThrow('PROMPT_VERSION not found in system.ts')
  })
})

// ---------------------------------------------------------------------------
// semverGt unit tests
// ---------------------------------------------------------------------------

describe('semverGt', () => {
  it('T-0010-100 patch bump: v0.1.0 → v0.1.1', () => {
    expect(semverGt('v0.1.1', 'v0.1.0')).toBe(true)
  })

  it('T-0010-101 minor bump: v0.1.0 → v0.2.0', () => {
    expect(semverGt('v0.2.0', 'v0.1.0')).toBe(true)
  })

  it('T-0010-102 major bump: v0.1.0 → v1.0.0', () => {
    expect(semverGt('v1.0.0', 'v0.1.0')).toBe(true)
  })

  it('T-0010-104 downgrade patch: v0.1.1 → v0.1.0 is not greater', () => {
    expect(semverGt('v0.1.0', 'v0.1.1')).toBe(false)
  })

  it('T-0010-105 downgrade minor: v0.2.0 → v0.1.9 is not greater', () => {
    expect(semverGt('v0.1.9', 'v0.2.0')).toBe(false)
  })

  it('equal versions are not greater', () => {
    expect(semverGt('v0.2.0', 'v0.2.0')).toBe(false)
  })

  it('T-0010-106 boundary: v0.10.0 > v0.9.0 (numeric, not lexicographic)', () => {
    expect(semverGt('v0.10.0', 'v0.9.0')).toBe(true)
  })

  it('T-0010-107 boundary: v1.0.0 > v0.99.99', () => {
    expect(semverGt('v1.0.0', 'v0.99.99')).toBe(true)
  })

  it('T-0010-108 boundary: leading zeros in segment are rejected', () => {
    expect(() => semverGt('v0.01.0', 'v0.0.0')).toThrow('leading zeros not allowed')
  })

  it('T-0010-108 boundary: leading zeros in base version are also rejected', () => {
    expect(() => semverGt('v0.1.0', 'v0.01.0')).toThrow('leading zeros not allowed')
  })

  it('works without v prefix', () => {
    expect(semverGt('1.1.0', '1.0.0')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// main() integration tests — mocked execSync + readFileSync
// ---------------------------------------------------------------------------

describe('main', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    delete process.env['GITHUB_BASE_REF']
  })

  // -------------------------------------------------------------------------
  // Happy path: no diff
  // -------------------------------------------------------------------------

  it('T-0010-099 exits 0 when git diff shows no changes', async () => {
    // execSync('git diff origin/main -- ...') returns empty string → no change
    mockExecSync.mockReturnValueOnce('' as never)
    expect(await main()).toBe(0)
  })

  // -------------------------------------------------------------------------
  // Happy path: version bumped
  // -------------------------------------------------------------------------

  it('T-0010-100 exits 0 when PROMPT_VERSION bumped v0.1.0 → v0.1.1', async () => {
    // Call 1: git diff (non-empty → changed)
    mockExecSync.mockReturnValueOnce('--- a/system.ts\n+++ b/system.ts\n...' as never)
    // readFileSync → current file (v0.1.1)
    mockReadFileSync.mockReturnValueOnce(makeSystemTs('v0.1.1') as never)
    // Call 2: git show → base file (v0.1.0)
    mockExecSync.mockReturnValueOnce(makeSystemTs('v0.1.0') as never)

    expect(await main()).toBe(0)
  })

  it('T-0010-101 exits 0 when PROMPT_VERSION bumped v0.1.0 → v0.2.0', async () => {
    mockExecSync.mockReturnValueOnce('diff content' as never)
    mockReadFileSync.mockReturnValueOnce(makeSystemTs('v0.2.0') as never)
    mockExecSync.mockReturnValueOnce(makeSystemTs('v0.1.0') as never)

    expect(await main()).toBe(0)
  })

  it('T-0010-102 exits 0 when PROMPT_VERSION bumped v0.1.0 → v1.0.0 (major)', async () => {
    mockExecSync.mockReturnValueOnce('diff content' as never)
    mockReadFileSync.mockReturnValueOnce(makeSystemTs('v1.0.0') as never)
    mockExecSync.mockReturnValueOnce(makeSystemTs('v0.1.0') as never)

    expect(await main()).toBe(0)
  })

  // -------------------------------------------------------------------------
  // Failure: unchanged version
  // -------------------------------------------------------------------------

  it('T-0010-103 exits 1 when system.ts changed and PROMPT_VERSION unchanged', async () => {
    mockExecSync.mockReturnValueOnce('diff content' as never)
    mockReadFileSync.mockReturnValueOnce(makeSystemTs('v0.2.0') as never)
    mockExecSync.mockReturnValueOnce(makeSystemTs('v0.2.0') as never)

    expect(await main()).toBe(1)
  })

  // -------------------------------------------------------------------------
  // Failure: version downgraded
  // -------------------------------------------------------------------------

  it('T-0010-104 exits 1 when PROMPT_VERSION went v0.1.1 → v0.1.0 (downgrade)', async () => {
    mockExecSync.mockReturnValueOnce('diff content' as never)
    mockReadFileSync.mockReturnValueOnce(makeSystemTs('v0.1.0') as never)
    mockExecSync.mockReturnValueOnce(makeSystemTs('v0.1.1') as never)

    expect(await main()).toBe(1)
  })

  it('T-0010-105 exits 1 when PROMPT_VERSION went v0.2.0 → v0.1.9 (minor downgrade)', async () => {
    mockExecSync.mockReturnValueOnce('diff content' as never)
    mockReadFileSync.mockReturnValueOnce(makeSystemTs('v0.1.9') as never)
    mockExecSync.mockReturnValueOnce(makeSystemTs('v0.2.0') as never)

    expect(await main()).toBe(1)
  })

  // -------------------------------------------------------------------------
  // Boundary: base ref unavailable (first-commit case)
  // -------------------------------------------------------------------------

  it('T-0010-109 exits 0 with warning when git diff throws (base ref unavailable)', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    mockExecSync.mockImplementationOnce(() => {
      throw new Error('fatal: ambiguous argument "origin/main"')
    })

    expect(await main()).toBe(0)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('not available; skipping version bump check'),
    )
    warnSpy.mockRestore()
  })

  it('exits 0 with warning when git show throws (file not on base branch)', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    mockExecSync.mockReturnValueOnce('diff content' as never)
    mockReadFileSync.mockReturnValueOnce(makeSystemTs('v0.1.0') as never)
    mockExecSync.mockImplementationOnce(() => {
      throw new Error('fatal: Path not found in origin/main')
    })

    expect(await main()).toBe(0)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('could not read base version'))
    warnSpy.mockRestore()
  })

  // -------------------------------------------------------------------------
  // Error handling: broken system.ts
  // -------------------------------------------------------------------------

  it('T-0010-110 exits 1 when current system.ts has no PROMPT_VERSION', async () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    mockExecSync.mockReturnValueOnce('diff content' as never)
    mockReadFileSync.mockReturnValueOnce('export const SOME_OTHER = "x"' as never)

    expect(await main()).toBe(1)
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('PROMPT_VERSION not found'))
    errSpy.mockRestore()
  })

  it('T-0010-111 exits 1 when current PROMPT_VERSION is a concatenated expression', async () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    mockExecSync.mockReturnValueOnce('diff content' as never)
    mockReadFileSync.mockReturnValueOnce(
      `export const PROMPT_VERSION = PREFIX + '.0'\nexport const OTHER = 'x'` as never,
    )

    expect(await main()).toBe(1)
    errSpy.mockRestore()
  })

  // -------------------------------------------------------------------------
  // Security: T-0010-112 / T-0010-114
  // -------------------------------------------------------------------------

  it('T-0010-112 / T-0010-114 adversarial commit does not execute code and has no side effects', async () => {
    // If the script ever used require() or eval, the adversarial payload would
    // call process.exit(99). We confirm main() returns normally with exit 0.
    const adversarialBase = `process.exit(99)\nexport const PROMPT_VERSION = 'v0.1.0' as const\n`
    const adversarialCurrent =
      `process.exit(99)\nexport const PROMPT_VERSION = 'v0.2.0' as const\n`

    mockExecSync.mockReturnValueOnce('diff content' as never)
    mockReadFileSync.mockReturnValueOnce(adversarialCurrent as never)
    mockExecSync.mockReturnValueOnce(adversarialBase as never)

    expect(await main()).toBe(0)
  })

  // -------------------------------------------------------------------------
  // GITHUB_BASE_REF environment variable
  // -------------------------------------------------------------------------

  it('uses GITHUB_BASE_REF env var instead of "main" when set', async () => {
    process.env['GITHUB_BASE_REF'] = 'develop'
    mockExecSync.mockReturnValueOnce('' as never)

    expect(await main()).toBe(0)

    // Verify the first execSync call used 'origin/develop'
    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringContaining('origin/develop'),
      expect.anything(),
    )
  })

  // -------------------------------------------------------------------------
  // T-0010-113 — covered by the CI workflow (structural, not unit-testable here)
  // T-0010-158 — covered in readVersion suite above
  // -------------------------------------------------------------------------
})
