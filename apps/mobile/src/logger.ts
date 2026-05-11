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

/**
 * Structured log call — two call signatures:
 *   logger.warn('message', context?)         — positional (legacy)
 *   logger.warn({event: ..., ...}, 'message') — pino-style structured (ADR-0013+)
 *
 * Both produce the same underlying output. The pino-style form is used by
 * auth modules per ADR-0013 §Decision 6 / T-0011-158.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LogContext = Record<string, any>
type LogArgs = [message: string, context?: LogContext] | [context: LogContext, message: string]

function resolveLogArgs(args: LogArgs): {message: string; context: LogContext | undefined} {
  if (typeof args[0] === 'string') {
    return {message: args[0], context: args[1] as LogContext | undefined}
  }
  return {message: args[1] as string, context: args[0] as LogContext}
}

export const logger = {
  info: (...args: LogArgs): void => {
    if (__DEV__) {
      const {message, context} = resolveLogArgs(args)
      console.warn(`[info] ${message}`, context ?? '')
    }
  },
  warn: (...args: LogArgs): void => {
    const {message, context} = resolveLogArgs(args)
    console.warn(`[warn] ${message}`, context ?? '')
  },
  error: (...args: LogArgs): void => {
    const {message, context} = resolveLogArgs(args)
    console.error(`[error] ${message}`, context ?? '')
  },
}
