/**
 * AICapabilitiesProvider — async capability check on mount, cached in context.
 *
 * This is the SINGLE useEffect exception in the V0 renderer (ADR-0006 §K).
 * The check is inherently async and mount-time: we query whether the current
 * device/OS can run Apple Foundation Models. There is no synchronous API for
 * this. Every other state in the renderer is derived from props or dispatch.
 *
 * Safe default: isSupported=false until the check resolves. Components that
 * gate on AI features will hide themselves until (and if) the check confirms
 * availability. This is the correct failure mode — show less, never crash.
 *
 * Mounted ref guards against setState-after-unmount in tests that unmount
 * quickly (T-0006-027 pattern, consistent with useRendererState).
 */
import React, {createContext, useContext, useEffect, useState} from 'react'
import {aiCapabilitiesCheck} from './aiCapabilitiesCheck.js'
import type {AICapabilities} from './aiCapabilitiesCheck.js'

export type {AICapabilities}

// ---------------------------------------------------------------------------
// Context — defaults to safe {isSupported: false} so consumers before the
// provider mount (or outside it) degrade gracefully.
// ---------------------------------------------------------------------------

const AICapabilitiesContext = createContext<AICapabilities>({isSupported: false})

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AICapabilitiesProvider({children}: {children: React.ReactNode}) {
  const [caps, setCaps] = useState<AICapabilities>({isSupported: false})

  // §K exception: useEffect is allowed here because this is an async OS query
  // that cannot be driven by props or reducer dispatch.
  useEffect(() => {
    let mounted = true

    aiCapabilitiesCheck()
      .then(result => {
        if (mounted) setCaps(result)
      })
      .catch(() => {
        // aiCapabilitiesCheck() itself swallows errors and returns {isSupported: false,
        // reason: 'check-failed'}, so this branch is defense-in-depth only.
        if (mounted) setCaps({isSupported: false, reason: 'check-failed'})
      })

    return () => {
      mounted = false
    }
  }, [])

  return <AICapabilitiesContext.Provider value={caps}>{children}</AICapabilitiesContext.Provider>
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAICapabilities(): AICapabilities {
  // Context default ({isSupported: false}) is the correct behavior outside a
  // provider — AI features are simply unavailable.
  return useContext(AICapabilitiesContext)
}
