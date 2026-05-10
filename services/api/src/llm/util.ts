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

export function flattenZodIssues(err: unknown): unknown {
  if (err instanceof ZodError) {
    return err.issues.map(issue => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    }))
  }
  return String(err)
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
