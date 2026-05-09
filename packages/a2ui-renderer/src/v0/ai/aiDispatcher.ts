/**
 * aiDispatcher — wraps react-native-ai-apple for the aiBridge middleware.
 *
 * react-native-ai-apple is an optionalDependency (native-only; iOS 26+ Pro).
 * Dynamic require() with try/catch handles: MODULE_NOT_FOUND, wrong API shape,
 * and runtime failures — all three collapse to null (AI unavailable).
 *
 * The AIDispatcher interface is defined in aiBridge.ts. This module provides
 * the concrete implementation that wraps the real native module.
 *
 * API surface of react-native-ai-apple (V0 subset):
 *   - summarize(text: string): Promise<string>
 *   OR: run({operation: 'summarize', input: string}): Promise<{text: string}>
 *
 * We probe both shapes at runtime and use whichever is present. If neither is
 * found, we return null so callers degrade gracefully.
 *
 * Used by: useRendererState (passes instance to makeAIBridgeMiddleware).
 * Mocked in tests via jest.mock('./aiDispatcher').
 *
 * PII / security: The prompt is sanitized before passing to the native module.
 * Row field values are serialized into a compact "- key: value" format; keys
 * and values are stringified and truncated at 200 chars each to prevent prompt
 * injection from unbounded user-entered content. T-0006-147 covers this.
 */

import type {AIDispatcher} from '../state/middleware/aiBridge.js'
import type {Row} from '../state/types.js'

// AI_TIMEOUT_MS — maximum time to wait for the native module to respond.
// T-0006-145: ListSummary shows timeout state when this fires.
export const AI_TIMEOUT_MS = 30_000

// MAX_FIELD_VALUE_LENGTH — truncation limit for row field values in the prompt.
// Prevents unbounded user content from inflating the prompt or leaking excess PII.
const MAX_FIELD_VALUE_LENGTH = 200

// MAX_FIELD_KEY_LENGTH — truncation limit for field names.
const MAX_FIELD_KEY_LENGTH = 64

// MAX_ROWS_IN_PROMPT — limit how many rows we serialize to avoid huge prompts.
const MAX_ROWS_IN_PROMPT = 20

/**
 * sanitizeRowsForPrompt — serializes a collection of rows into a compact
 * string suitable for inclusion in the AI prompt.
 *
 * Each row becomes "- key: value" lines. Keys and values are truncated.
 * Rows beyond MAX_ROWS_IN_PROMPT are omitted. This is the T-0006-147 guard.
 */
export function sanitizeRowsForPrompt(
  items: ReadonlyArray<Record<string, unknown>>,
): string {
  const capped = items.slice(0, MAX_ROWS_IN_PROMPT)
  return capped
    .map((row, i) => {
      const lines = Object.entries(row)
        .map(([k, v]) => {
          const key = String(k).slice(0, MAX_FIELD_KEY_LENGTH)
          const val = String(v).slice(0, MAX_FIELD_VALUE_LENGTH)
          return `  ${key}: ${val}`
        })
        .join('\n')
      return `Item ${i + 1}:\n${lines}`
    })
    .join('\n')
}

// RNAIAppleModule — the expected API shape of react-native-ai-apple.
// V0 supports two shapes (summarize() or run()) and probes at runtime.
type RNAIAppleModule = {
  summarize?: (text: string) => Promise<string>
  run?: (opts: {operation: string; input: string}) => Promise<{text: string}>
  isAvailable?: () => Promise<boolean>
}

/**
 * getAINativeModule — attempts to require react-native-ai-apple.
 * Returns the module if present and API-compatible, null otherwise.
 * Result is cached after first call.
 */
let _cachedModule: RNAIAppleModule | null | undefined = undefined

function getAINativeModule(): RNAIAppleModule | null {
  if (_cachedModule !== undefined) return _cachedModule

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-ai-apple') as RNAIAppleModule
    if (
      typeof mod?.summarize === 'function' ||
      typeof mod?.run === 'function'
    ) {
      _cachedModule = mod
      return mod
    }
    // Module present but API surface missing.
    _cachedModule = null
    return null
  } catch {
    // MODULE_NOT_FOUND or any other require-time error.
    _cachedModule = null
    return null
  }
}

/**
 * resetAIModuleCache — for testing only. Clears the cached module so tests
 * can control the mock state per-test.
 */
export function resetAIModuleCache(): void {
  _cachedModule = undefined
}

/**
 * makeAIDispatcher — creates the concrete AIDispatcher that calls the native
 * module. Returns null if the module is unavailable.
 *
 * The dispatcher's summarize() method:
 *   1. Sanitizes row items into the prompt (T-0006-147).
 *   2. Builds a final prompt string combining node.prompt + serialized items.
 *   3. Calls the native module with a 30s timeout (T-0006-145).
 *   4. Returns the summary text on success.
 *   5. Throws on failure — callers (aiBridge middleware) catch and route to
 *      host.onAIError.
 */
export function makeAIDispatcher(): AIDispatcher | null {
  const mod = getAINativeModule()
  if (mod === null) return null

  return {
    async summarize(input: {
      prompt: string
      items: ReadonlyArray<Row>
    }): Promise<string> {
      const serializedItems = sanitizeRowsForPrompt(
        input.items as ReadonlyArray<Record<string, unknown>>,
      )
      const fullPrompt = serializedItems
        ? `${input.prompt}\n\nItems:\n${serializedItems}`
        : input.prompt

      let resultPromise: Promise<string>

      if (typeof mod.summarize === 'function') {
        resultPromise = mod.summarize(fullPrompt)
      } else if (typeof mod.run === 'function') {
        resultPromise = mod.run({operation: 'summarize', input: fullPrompt}).then(
          r => r.text,
        )
      } else {
        throw new Error('react-native-ai-apple: no supported API surface')
      }

      // Race the native call against the 30s timeout.
      // We store the timer ref so we can clear it if the result arrives
      // before the timeout fires — prevents the timer from keeping the
      // process alive in test environments (open handle prevention).
      let timeoutHandle: ReturnType<typeof setTimeout>
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error('AI timeout')), AI_TIMEOUT_MS)
      })

      return Promise.race([
        resultPromise.finally(() => clearTimeout(timeoutHandle)),
        timeoutPromise,
      ])
    },
  }
}
