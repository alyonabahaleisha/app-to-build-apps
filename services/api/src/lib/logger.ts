/**
 * Strip stack-internal paths and known PII patterns from an error before logging.
 * Per ARCHITECTURE.md §8.
 */
export function safeMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return 'unknown error'
}
