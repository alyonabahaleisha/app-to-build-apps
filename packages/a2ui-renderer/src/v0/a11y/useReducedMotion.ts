/**
 * useReducedMotion — subscribes to the system "Reduce Motion" accessibility
 * preference and returns the current boolean state.
 *
 * This is the SECOND useEffect exception in the V0 renderer (ADR-0006 §K,
 * widened from the original single-exception for AICapabilitiesProvider).
 * Like the AI capability check, reduced-motion state is an async OS query
 * with a change subscription — there is no synchronous API and no way to
 * derive this from props or dispatch.
 *
 * Pattern mirrors AICapabilitiesProvider:
 *   - useState defaults to false (no motion reduction = safe/neutral default)
 *   - useEffect queries current state + subscribes to changes
 *   - mounted ref prevents setState-after-unmount
 *   - cleanup removes the subscription via sub.remove()
 *
 * Note: useSyncExternalStore was considered but requires a module-level
 * mutable snapshot (async initialization complicates the getSnapshot contract).
 * useEffect is simpler and correct here.
 */
import {useEffect, useState} from 'react'
import {AccessibilityInfo} from 'react-native'

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  // §K exception: useEffect allowed here for async OS query + subscription.
  useEffect(() => {
    let mounted = true

    // Query current state.
    AccessibilityInfo.isReduceMotionEnabled().then(v => {
      if (mounted) setReduced(v)
    })

    // Subscribe to changes (fires when user toggles in Settings).
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', v => {
      if (mounted) setReduced(v)
    })

    return () => {
      mounted = false
      sub.remove()
    }
  }, [])

  return reduced
}
