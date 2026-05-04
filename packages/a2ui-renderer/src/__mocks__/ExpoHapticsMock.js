/**
 * ExpoHapticsMock.js
 *
 * Package-level mock for expo-haptics in the a2ui-renderer Jest environment.
 *
 * expo-haptics is a peerDependency of the renderer (provided by the host app
 * at runtime). In the Jest environment for this package, expo-haptics's
 * transitive deps (expo-modules-core) contain Flow-typed and native code that
 * the react-native preset's Babel transform cannot parse.
 *
 * This mock provides the minimal surface ButtonRenderer needs:
 *   - ImpactFeedbackStyle.Light (used in the try/catch haptic call)
 *   - impactAsync (called but never awaited; no-op is correct for test env)
 *
 * Individual tests that need to simulate Haptics throwing (T-0003-065) can
 * override impactAsync via jest.mock('expo-haptics', ...) at the test level —
 * that call replaces this module-level mock for that test file only.
 *
 * Referenced from jest.config.js moduleNameMapper.
 */

const impactAsync = jest.fn(async () => {})

const ImpactFeedbackStyle = {
  Light: 'light',
  Medium: 'medium',
  Heavy: 'heavy',
}

module.exports = {
  __esModule: true,
  default: {impactAsync, ImpactFeedbackStyle},
  impactAsync,
  ImpactFeedbackStyle,
}
