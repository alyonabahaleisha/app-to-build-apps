/**
 * check-prompt-version-bumped.ts — ADR-0010 Step 5.
 *
 * CI pre-flight guard: when services/api/src/llm/prompts/system.ts changes
 * in a PR, PROMPT_VERSION must be strictly bumped (semver-greater) compared
 * to the base branch. Exits 1 when the check fails, saving Anthropic API
 * credits that would otherwise be wasted on a guaranteed-to-fail eval run.
 *
 * Usage:
 *   tsx scripts/check-prompt-version-bumped.ts
 *
 * Environment:
 *   GITHUB_BASE_REF — base branch name (set automatically by GitHub Actions
 *                     on pull_request events). Defaults to "main".
 *
 * Exit codes:
 *   0 — no system.ts changes, OR version is strictly greater, OR base ref
 *       unavailable (first-commit case — warns and passes through).
 *   1 — system.ts changed but PROMPT_VERSION unchanged, decreased, or
 *       unparseable.
 *
 * Tests: check-prompt-version-bumped.test.ts
 *        T-0010-099 through T-0010-114, T-0010-158.
 */

import {execSync} from 'node:child_process'
import {readFileSync} from 'node:fs'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SYSTEM_TS_REPO_PATH = 'services/api/src/llm/prompts/system.ts'

// ---------------------------------------------------------------------------
// readVersion — anchored regex extraction, never require/import.
//
// Anchored to "^export const PROMPT_VERSION = '<value>'" in multiline mode
// so occurrences in comments or other variable names are excluded by
// construction. This is the T-0010-158 security requirement.
//
// Leading zeros in semver segments are not a valid semver format but we
// reject them implicitly: the numeric comparison (parseInt) will still parse
// "01" as 1, so we validate the raw segment string to reject them explicitly.
// ---------------------------------------------------------------------------

export function readVersion(content: string): string {
  const m = content.match(/^export const PROMPT_VERSION = '([^']+)'/m)
  if (!m || !m[1]) {
    throw new Error('PROMPT_VERSION not found in system.ts')
  }
  return m[1]
}

// ---------------------------------------------------------------------------
// semverGt — strictly-greater semver comparison.
//
// Accepts "vX.Y.Z" or "X.Y.Z". No pre-release, no build metadata — the
// version is always major.minor.patch. Leading zeros in any segment are
// rejected (e.g., "v0.01.0" → throws). T-0010-108.
// ---------------------------------------------------------------------------

export function semverGt(a: string, b: string): boolean {
  const parse = (s: string): [number, number, number] => {
    const bare = s.replace(/^v/, '')
    const parts = bare.split('.')
    if (parts.length !== 3) {
      throw new Error(`invalid semver string: "${s}" (expected vX.Y.Z or X.Y.Z)`)
    }
    return parts.map((seg, _idx) => {
      // Reject leading zeros (e.g., "01") — not valid semver.
      if (seg.length > 1 && seg.startsWith('0')) {
        throw new Error(`invalid semver segment "${seg}" in "${s}" — leading zeros not allowed`)
      }
      const n = parseInt(seg, 10)
      if (isNaN(n) || n < 0) {
        throw new Error(`invalid semver segment "${seg}" in "${s}"`)
      }
      return n
    }) as [number, number, number]
  }

  const [aMajor, aMinor, aPatch] = parse(a)
  const [bMajor, bMinor, bPatch] = parse(b)

  if (aMajor !== bMajor) return aMajor > bMajor
  if (aMinor !== bMinor) return aMinor > bMinor
  return aPatch > bPatch
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function main(): Promise<number> {
  const base = process.env['GITHUB_BASE_REF'] ?? 'main'
  const path = SYSTEM_TS_REPO_PATH

  // 1. Check for a diff against the base branch.
  let diff: string
  try {
    diff = execSync(`git diff origin/${base} -- ${path}`, {encoding: 'utf-8'})
  } catch {
    // Base branch origin/<base> not available — first-commit case or shallow
    // clone without the remote ref. Warn and pass through.
    console.warn(
      `check-prompt-version-bumped: base ref origin/${base} not available; skipping version bump check`,
    )
    return 0
  }

  // 2. No diff — nothing to check.
  if (!diff) {
    console.warn(`check-prompt-version-bumped: no changes to ${path}; nothing to check`)
    return 0
  }

  // 3. Read current file content from disk.
  const current = readFileSync(path, 'utf-8')

  // 4. Read base content via git show.
  let baseContent: string
  try {
    baseContent = execSync(`git show origin/${base}:${path}`, {encoding: 'utf-8'})
  } catch {
    // File may not exist on base branch (new file case). Warn and pass through.
    console.warn(
      `check-prompt-version-bumped: could not read base version of ${path}; skipping`,
    )
    return 0
  }

  // 5. Extract PROMPT_VERSION from both sides.
  let cv: string
  let bv: string
  try {
    cv = readVersion(current)
  } catch (err) {
    console.error(`check-prompt-version-bumped: ${(err as Error).message}`)
    return 1
  }
  try {
    bv = readVersion(baseContent)
  } catch (err) {
    console.error(`check-prompt-version-bumped: could not read base PROMPT_VERSION — ${(err as Error).message}`)
    return 1
  }

  // 6. Same version → fail.
  if (cv === bv) {
    console.error(
      `check-prompt-version-bumped: ${path} changed; PROMPT_VERSION not bumped (still ${cv})`,
    )
    return 1
  }

  // 7. New version must be strictly greater.
  let gt: boolean
  try {
    gt = semverGt(cv, bv)
  } catch (err) {
    console.error(`check-prompt-version-bumped: semver comparison failed — ${(err as Error).message}`)
    return 1
  }

  if (!gt) {
    console.error(
      `check-prompt-version-bumped: PROMPT_VERSION ${cv} ≤ ${bv} (must be strictly greater)`,
    )
    return 1
  }

  console.warn(`check-prompt-version-bumped: PROMPT_VERSION bumped: ${bv} → ${cv}`)
  return 0
}

// Only auto-run when executed directly.
if (require.main === module) {
  main()
    .then(code => process.exit(code))
    .catch(err => {
      console.error('check-prompt-version-bumped fatal error:', err)
      process.exit(1)
    })
}
