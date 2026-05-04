/**
 * Public hook for components to read session state and call session
 * actions. Throws if used outside `<SessionProvider>` — this would only
 * happen by accident.
 *
 * Stable reference contract (T-0001-084): the value returned by
 * `useSession()` is `===` between renders unless `state` actually changed,
 * because the provider memoizes the context value with `useMemo` keyed on
 * the state and the (already-stable) callback identities.
 */
import {useContext} from 'react'

import {SessionContext, type SessionContextValue} from './SessionProvider'

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext)
  if (value === null) {
    throw new Error('useSession() must be used within <SessionProvider>')
  }
  return value
}
