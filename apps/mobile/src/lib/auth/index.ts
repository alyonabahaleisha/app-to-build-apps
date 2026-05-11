/**
 * Auth module public API.
 *
 * Exports the provider dispatcher, error types, and interface. Internal
 * provider implementations (`magicLinkProvider`, `siwaProvider`) are not
 * re-exported — callers go through `getAuthProvider()`.
 */
export {getAuthProvider, __resetAuthProviderCacheForTests, __setEnvOverrideForTests} from './getAuthProvider'
export {AuthCanceledError, AuthFailedError} from './errors'
export type {AuthProvider, AuthProviderName, AuthSignInResult} from './types'
