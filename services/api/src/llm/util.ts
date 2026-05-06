// Extracted from generate.ts rev-0 — shared utilities for LLM modules.
import {createHash} from 'crypto'
import {ZodError} from 'zod'

export function hashUserId(userId: string): string {
  return createHash('sha256').update(userId).digest('hex').slice(0, 16)
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
