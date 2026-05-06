/**
 * Tier 1 persistence — secure tokens (ARCHITECTURE.md §5).
 *
 * The ONLY place in the app that imports `expo-secure-store`. Verified by
 * grep test (T-0001-082 sibling assertion in the audit lane). All other
 * modules read tokens via `useSession()` or the in-memory session ref the
 * provider exposes.
 *
 * Keys are namespaced with `appcreator.session.` to avoid collisions with
 * any other tenant of the iOS keychain on the same bundle.
 *
 * Errors from the underlying native module are wrapped in `SecureStoreError`
 * so callers don't need to know about Expo internals. The wrapper never
 * throws raw — failures resolve to `null` for reads and re-throw a typed
 * error for writes/deletes (callers decide what to do).
 */
import * as SecureStore from 'expo-secure-store'

const NAMESPACE = 'appcreator.session.'

export type SecureKey = 'accessToken' | 'refreshToken' | 'userId'

export interface SecureSnapshot {
  accessToken: string | null
  refreshToken: string | null
  userId: string | null
}

export class SecureStoreError extends Error {
  readonly cause: unknown
  constructor(message: string, cause: unknown) {
    super(message)
    this.name = 'SecureStoreError'
    this.cause = cause
  }
}

function namespaced(key: SecureKey): string {
  return `${NAMESPACE}${key}`
}

async function readOne(key: SecureKey): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(namespaced(key))
  } catch {
    // Reads must never throw — a corrupt keychain entry should look like
    // "no value" so the session resolves to `unauthenticated` instead of
    // jamming on `loading`. T-0001-080 covers this branch.
    return null
  }
}

async function writeOne(key: SecureKey, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(namespaced(key), value)
  } catch (err) {
    throw new SecureStoreError(`failed to write ${key}`, err)
  }
}

async function deleteOne(key: SecureKey): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(namespaced(key))
  } catch (err) {
    throw new SecureStoreError(`failed to delete ${key}`, err)
  }
}

export const secureStore = {
  /**
   * Read all tokens at once. Used by `SessionProvider` on mount. Each lookup
   * is parallelized so cold-start hydration stays well under the 500ms
   * budget (T-0001-073).
   */
  async read(): Promise<SecureSnapshot> {
    const [accessToken, refreshToken, userId] = await Promise.all([
      readOne('accessToken'),
      readOne('refreshToken'),
      readOne('userId'),
    ])
    return {accessToken, refreshToken, userId}
  },

  /**
   * Write the full session snapshot. All-or-nothing semantics from the
   * caller's perspective: if any single write throws, the caller should
   * decide whether to roll back via `clear()`.
   */
  async write(snapshot: SecureSnapshot): Promise<void> {
    const {accessToken, refreshToken, userId} = snapshot
    if (accessToken !== null) await writeOne('accessToken', accessToken)
    if (refreshToken !== null) await writeOne('refreshToken', refreshToken)
    if (userId !== null) await writeOne('userId', userId)
  },

  /**
   * Delete all session tokens. Sign-out path. After this resolves, `read()`
   * returns `{accessToken: null, refreshToken: null, userId: null}`
   * (T-0001-081).
   */
  async clear(): Promise<void> {
    await Promise.all([deleteOne('accessToken'), deleteOne('refreshToken'), deleteOne('userId')])
  },
}
