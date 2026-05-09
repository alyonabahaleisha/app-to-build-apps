/**
 * RendererLoggerProvider — injects a logger into the renderer component tree.
 *
 * The renderer cannot import from apps/mobile/src/logger (workspace boundary).
 * This context lets AppRunner inject the mobile logger; tests inject a spy.
 *
 * Default (no provider): a no-op logger. Calling .warn() or .error() is safe
 * and produces no output (T-0003-020).
 */
import React, {createContext, useContext} from 'react'

import type {RendererLogger} from '../types'

// -- No-op default ------------------------------------------------------------

const NO_OP_LOGGER: RendererLogger = {
  warn(_message: string, _fields?: Record<string, unknown>): void {},
  error(_message: string, _fields?: Record<string, unknown>): void {},
}

// -- Context ------------------------------------------------------------------

const RendererLoggerContext = createContext<RendererLogger>(NO_OP_LOGGER)

// -- Provider -----------------------------------------------------------------

export interface RendererLoggerProviderProps {
  logger: RendererLogger
  children: React.ReactNode
}

export function RendererLoggerProvider({
  logger,
  children,
}: RendererLoggerProviderProps): React.ReactElement {
  return <RendererLoggerContext.Provider value={logger}>{children}</RendererLoggerContext.Provider>
}

// -- Hook ---------------------------------------------------------------------

/**
 * useRendererLogger — returns the injected logger, or the no-op default if
 * no provider is mounted (T-0003-020).
 */
export function useRendererLogger(): RendererLogger {
  return useContext(RendererLoggerContext)
}
