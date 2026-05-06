/**
 * Patch intent validation — ADR-0004 Step 7.
 *
 * Implements the positive allow-list rule: every RFC 6902 patch op's `path`
 * (and `from` for `move`/`copy`) must be equal to, or a strict descendant of,
 * at least one entry in `targetPaths`. Parent, sibling, and unrelated paths
 * are rejected.
 *
 * "Strict descendant" means: path.startsWith(allowed + '/'). The trailing
 * slash is mandatory — without it, `/views/0/root/children` would be treated
 * as a prefix of `/views/0/root/childrenX`, which is a sibling, not a
 * descendant. That boundary case is exercised by T-0004-102.
 */
import type {JsonPatch} from '@app-creator/a2ui-schema'

/**
 * Returns true iff `path` is equal to at least one entry in `allowed`, OR is
 * a strict descendant of at least one entry (i.e. `path.startsWith(a + '/')`).
 *
 * Empty `allowed` → false for every path (vacuously no path is within anything).
 */
export function isPathWithinAny(path: string, allowed: string[]): boolean {
  return allowed.some(a => path === a || path.startsWith(a + '/'))
}

/**
 * Validate every op in `patch` against `targetPaths`.
 *
 * Returns `{ok: true}` when all ops are in scope.
 * Returns `{ok: false, offendingOp, reason}` for the first out-of-scope op
 * found (0-indexed). Stops at the first failure.
 *
 * Rules:
 *   - `op.path` must be within at least one `targetPaths` entry.
 *   - For `move` and `copy`: `op.from` must also be within at least one entry.
 *   - Empty patch (`[]`) is always valid — `{ok: true}`.
 *   - `test` ops follow the same path rule as any other op.
 */
export function validatePatchAgainstIntent(
  patch: JsonPatch,
  targetPaths: string[],
): {ok: true} | {ok: false; offendingOp: number; reason: string} {
  for (let i = 0; i < patch.length; i++) {
    const op = patch[i]!

    if (!isPathWithinAny(op.path, targetPaths)) {
      return {
        ok: false,
        offendingOp: i,
        reason: `op.path '${op.path}' outside intent`,
      }
    }

    // For move and copy: the source path must also be within scope.
    if ((op.op === 'move' || op.op === 'copy') && op.from !== undefined) {
      if (!isPathWithinAny(op.from, targetPaths)) {
        return {
          ok: false,
          offendingOp: i,
          reason: `op.from '${op.from}' outside intent`,
        }
      }
    }
  }

  return {ok: true}
}
