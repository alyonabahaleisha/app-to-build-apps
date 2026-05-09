/**
 * HostContext — minimal stub for Step 4.
 *
 * Provides HostCallbacks via context so NodeRenderer can call
 * host.onUnknownNodeType on defensive default branches.
 *
 * The full <Renderer> component lands at Step 10; HostProvider is the
 * surface tests use to inject callbacks. Components and NodeRenderer consume
 * useHost() to access callbacks.
 *
 * Fallback behavior (no provider): returns a no-op HostCallbacks object.
 * This prevents test noise when a component is rendered outside a
 * HostProvider (e.g., in shallow unit tests for layout components).
 */
import React, {createContext, useContext} from 'react'
import type {HostCallbacks} from '../state/hostCallbacks.js'

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const HostContext = createContext<HostCallbacks | null>(null)

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function HostProvider({
  value,
  children,
}: {
  value: HostCallbacks
  children: React.ReactNode
}) {
  return <HostContext.Provider value={value}>{children}</HostContext.Provider>
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const FALLBACK_HOST: HostCallbacks = {
  onToast: () => {},
  onAIError: () => {},
}

export function useHost(): HostCallbacks {
  const ctx = useContext(HostContext)
  // Graceful fallback: layout components don't need host callbacks,
  // but NodeRenderer's defensive branch requires onUnknownNodeType.
  // Returning a no-op object instead of throwing keeps Step 4 layout
  // tests simple while still wiring the NodeRenderer correctly.
  return ctx ?? FALLBACK_HOST
}
