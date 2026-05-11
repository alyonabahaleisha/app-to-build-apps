// Extracted from generate.ts rev-0 — shared utilities for LLM modules.
import {createHash} from 'crypto'
import {ZodError} from 'zod'

export function hashUserId(userId: string): string {
  return createHash('sha256').update(userId).digest('hex').slice(0, 16)
}

/**
 * sha256Hex — compute a full lowercase sha256 hex digest of a UTF-8 string.
 * Used by generateAppSpec to compute prompt_hash (ADR-0007 §H).
 * The canonical form is always lowercase (matching /^[a-f0-9]{64}$/).
 */
export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex')
}

/**
 * flattenZodIssues — extract error codes from a ZodError.
 *
 * Returns ONLY the closed-enum `code` strings — never `message` or `path`.
 * Returning paths or messages would leak LLM-emitted strings (collection IDs,
 * slot names, screen IDs) back to the client. Per ADR-0007 §F and the
 * retro-lessons.md normalizeRow lesson.
 *
 * Carryforward from PR 1 NOTE-3: the M1 shape `{path, message, code}[]` is
 * replaced here with `string[]` of codes only.
 */
export function flattenZodIssues(err: unknown): string[] {
  if (err instanceof ZodError) {
    return err.issues.map(issue => issue.code)
  }
  return ['unknown_error']
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
