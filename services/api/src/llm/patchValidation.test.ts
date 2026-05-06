/**
 * ADR-0004 Step 7 — patch intent validation tests.
 *
 * T-ID: T-0004-102 (umbrella: ~8+ underlying tests)
 *
 * Covers:
 *   (a) Empty patch: always {ok: true}
 *   (b) Single op exact-match path: allowed
 *   (c) Descendant path: allowed
 *   (d) Sibling rejection: rejected
 *   (e) Parent rejection: rejected
 *   (f) move with `from` inside but `path` outside: rejected, reason cites op.path
 *   (g) copy with `path` inside but `from` outside: rejected, reason cites op.from
 *   (h) test op inside scope: allowed
 *   Boundary: prefix collision (target `/views/0/root/children`, op `/views/0/root/childrenX`)
 *   Boundary: empty targetPaths
 */

import {validatePatchAgainstIntent, isPathWithinAny} from './patchValidation.js'
import type {JsonPatch} from '@app-creator/a2ui-schema'

// ---------------------------------------------------------------------------
// isPathWithinAny — unit tests
// ---------------------------------------------------------------------------

describe('isPathWithinAny', () => {
  it('returns true for exact match', () => {
    expect(isPathWithinAny('/views/0/root', ['/views/0/root'])).toBe(true)
  })

  it('returns true for strict descendant', () => {
    expect(isPathWithinAny('/views/0/root/children/2', ['/views/0/root'])).toBe(true)
  })

  it('returns false when path is a parent of the allowed entry', () => {
    expect(isPathWithinAny('/views/0', ['/views/0/root'])).toBe(false)
  })

  it('returns false for sibling (same prefix, different child)', () => {
    expect(isPathWithinAny('/views/0/root/children/3', ['/views/0/root/children/2'])).toBe(false)
  })

  it('returns false for empty allowed array', () => {
    expect(isPathWithinAny('/views/0/root', [])).toBe(false)
  })

  it('rejects path that shares a prefix without trailing slash (boundary)', () => {
    // target /views/0/root/children must NOT match /views/0/root/childrenX
    expect(isPathWithinAny('/views/0/root/childrenX', ['/views/0/root/children'])).toBe(false)
  })

  it('returns true when at least one of multiple allowed paths matches', () => {
    expect(
      isPathWithinAny('/views/0/root/children/5', ['/views/0/title', '/views/0/root']),
    ).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// validatePatchAgainstIntent — T-0004-102 (a) through (h) + boundary cases
// ---------------------------------------------------------------------------

describe('validatePatchAgainstIntent', () => {
  const TARGET = '/views/0/root'
  const CHILD_TARGET = '/views/0/root/children/2'

  // (a) Empty patch
  it('(a) returns {ok: true} for an empty patch', () => {
    const result = validatePatchAgainstIntent([], [TARGET])
    expect(result).toEqual({ok: true})
  })

  // (b) Single op exact-match path
  it('(b) returns {ok: true} for a single op whose path exactly matches a target', () => {
    const patch: JsonPatch = [{op: 'replace', path: TARGET, value: 'x'}]
    const result = validatePatchAgainstIntent(patch, [TARGET])
    expect(result).toEqual({ok: true})
  })

  // (c) Descendant path
  it('(c) returns {ok: true} for a descendant path', () => {
    const patch: JsonPatch = [{op: 'replace', path: '/views/0/root/children/2', value: 'x'}]
    const result = validatePatchAgainstIntent(patch, [TARGET])
    expect(result).toEqual({ok: true})
  })

  // (d) Sibling rejection
  it('(d) rejects op with sibling path, reason includes "outside intent"', () => {
    const patch: JsonPatch = [{op: 'replace', path: '/views/0/root/children/3', value: 'x'}]
    const result = validatePatchAgainstIntent(patch, [CHILD_TARGET])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.offendingOp).toBe(0)
      expect(result.reason).toContain('outside intent')
    }
  })

  // (e) Parent rejection
  it('(e) rejects op whose path is a parent of the target', () => {
    const patch: JsonPatch = [{op: 'replace', path: '/views/0/root', value: 'x'}]
    const result = validatePatchAgainstIntent(patch, [CHILD_TARGET])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.offendingOp).toBe(0)
    }
  })

  // (f) move with `from` inside but `path` outside
  it('(f) rejects move op when path is outside intent (even if from is inside)', () => {
    const patch: JsonPatch = [
      {
        op: 'move',
        from: '/views/0/root/children/2', // inside CHILD_TARGET
        path: '/views/0/other',           // outside
      },
    ]
    const result = validatePatchAgainstIntent(patch, [CHILD_TARGET])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.offendingOp).toBe(0)
      expect(result.reason).toContain("op.path")
    }
  })

  // (g) copy with `path` inside but `from` outside
  it('(g) rejects copy op when from is outside intent (even if path is inside)', () => {
    const patch: JsonPatch = [
      {
        op: 'copy',
        from: '/views/1/root', // outside
        path: '/views/0/root/children/2/label', // inside CHILD_TARGET
      },
    ]
    const result = validatePatchAgainstIntent(patch, [CHILD_TARGET])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.offendingOp).toBe(0)
      expect(result.reason).toContain("op.from")
    }
  })

  // (h) test op inside scope
  it('(h) allows test op whose path is within scope', () => {
    const patch: JsonPatch = [{op: 'test', path: '/views/0/root/children/2', value: 'expected'}]
    const result = validatePatchAgainstIntent(patch, [TARGET])
    expect(result).toEqual({ok: true})
  })

  // Boundary: prefix collision
  it('(boundary) rejects op whose path shares prefix without trailing slash', () => {
    // target /views/0/root/children, op /views/0/root/childrenX
    const patch: JsonPatch = [
      {op: 'replace', path: '/views/0/root/childrenX', value: 'x'},
    ]
    const result = validatePatchAgainstIntent(patch, ['/views/0/root/children'])
    expect(result.ok).toBe(false)
  })

  // Boundary: empty targetPaths
  it('(boundary) rejects every op when targetPaths is empty', () => {
    const patch: JsonPatch = [{op: 'add', path: '/views/0/root/children/0', value: {type: 'Text', text: 'hi'}}]
    const result = validatePatchAgainstIntent(patch, [])
    expect(result.ok).toBe(false)
  })

  // Multiple ops — first violation reported with correct index
  it('reports the correct offendingOp index when a later op is out of scope', () => {
    const patch: JsonPatch = [
      {op: 'replace', path: TARGET, value: 'ok'},      // index 0 — in scope
      {op: 'replace', path: '/views/1/root', value: 'x'}, // index 1 — out of scope
    ]
    const result = validatePatchAgainstIntent(patch, [TARGET])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.offendingOp).toBe(1)
    }
  })

  // move fully within scope: ok
  it('allows move op when both path and from are within scope', () => {
    const patch: JsonPatch = [
      {
        op: 'move',
        from: '/views/0/root/children/0',
        path: '/views/0/root/children/1',
      },
    ]
    const result = validatePatchAgainstIntent(patch, [TARGET])
    expect(result).toEqual({ok: true})
  })
})
