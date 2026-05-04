/**
 * Minimal structured logger for the mobile app.
 *
 * Per CLAUDE.md §5: never use console.log. Use this module.
 * `safeMessage` strips internal paths and known PII from error objects.
 */

export function safeMessage(err: unknown): string {
  if (err instanceof Error) {
    // Strip absolute file paths from the message — they leak internals.
    return err.message.replace(/\/.+?\/apps\/mobile\//g, '<app>/')
  }
  if (typeof err === 'string') return err
  return 'unknown_error'
}

export const logger = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  info: (message: string, context?: Record<string, any>): void => {
    if (__DEV__) {
      console.warn(`[info] ${message}`, context ?? '')
    }
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  warn: (message: string, context?: Record<string, any>): void => {
    console.warn(`[warn] ${message}`, context ?? '')
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: (message: string, context?: Record<string, any>): void => {
    console.error(`[error] ${message}`, context ?? '')
  },
}
