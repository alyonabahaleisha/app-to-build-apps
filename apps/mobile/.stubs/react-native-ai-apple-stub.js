// Empty stub for react-native-ai-apple in the React Native bundle.
//
// `react-native-ai-apple` is in `packages/a2ui-renderer`'s `optionalDependencies`
// because the package isn't published to npm yet. Metro bundles `require()` calls
// into module-id lookups at bundle time; an unresolvable require ends up as
// `require(undefined)` at runtime, which throws "Requiring unknown module" —
// and the throw happens BEFORE the surrounding try/catch can wrap it (since the
// module table miss is in the runtime's `__r()` function, not user code).
//
// This stub provides an `isAvailable()` that always reports false, so the AI
// capabilities check resolves to `{isSupported: false, reason: 'no-foundation-models'}`
// — the same fallback path the renderer already handles for unsupported devices.
module.exports = {
  isAvailable: async () => false,
}
