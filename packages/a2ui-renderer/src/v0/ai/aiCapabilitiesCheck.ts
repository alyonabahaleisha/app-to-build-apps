/**
 * aiCapabilitiesCheck — missing-module-safe wrapper around react-native-ai-apple.
 *
 * react-native-ai-apple is an optionalDependency (not on npm; native-only).
 * We use a dynamic require() so the module graph doesn't blow up when the
 * package is absent. The try/catch handles all three failure modes:
 *   1. Module not installed → require() throws MODULE_NOT_FOUND
 *   2. Module installed but isAvailable not a function → wrong API shape
 *   3. isAvailable() rejects → OS too old / permission denied
 *
 * This is the ONLY place in the renderer that touches react-native-ai-apple.
 * AICapabilitiesProvider calls this once on mount and caches the result.
 */

export type AICapabilities = {
  isSupported: boolean
  reason?: string
}

export async function aiCapabilitiesCheck(): Promise<AICapabilities> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const aiModule = require('react-native-ai-apple') as Record<string, unknown>

    if (typeof aiModule?.isAvailable !== 'function') {
      // Module exists but the expected API surface is missing.
      return {isSupported: false, reason: 'no-foundation-models'}
    }

    const isAvailable = await (aiModule.isAvailable as () => Promise<boolean>)()
    if (!isAvailable) {
      // OS is too old or device doesn't have Pro Neural Engine.
      return {isSupported: false, reason: 'os-too-old'}
    }

    return {isSupported: true}
  } catch {
    // Covers: MODULE_NOT_FOUND, runtime errors from isAvailable(), anything else.
    return {isSupported: false, reason: 'check-failed'}
  }
}
