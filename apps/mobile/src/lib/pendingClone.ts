/**
 * pendingClone — persists a share_id intent across app restarts and the
 * SIWA (Sign In With Apple) authentication flow.
 *
 * Per ADR-0008 Step 5: when a user taps a clone universal link while
 * unauthenticated, we store the shareId here, navigate them to sign-in,
 * and after successful authentication, pop the intent and fire the clone
 * mutation before navigating to Library.
 *
 * Why expo-secure-store (not MMKV or AsyncStorage):
 *   This is per-device-installation state that must survive process death
 *   between the link tap and the SIWA round-trip. MMKV has the same
 *   durability but expo-secure-store is already required by the project
 *   (auth tokens), avoids adding an MMKV key outside the documented
 *   session namespace, and keeps cross-device semantics clean — a user
 *   signing into a new device should re-tap the link rather than replaying
 *   an intent stored on a different device. The precedent is the same
 *   pattern used by coachmarkStorage.ts (ADR-0011 Step 10).
 *
 * Exported functions:
 *   `setPendingClone(shareId)` — validates + stores share_id
 *   `popPendingClone()`        — reads then deletes; null on empty or error
 *   `clearPendingClone()`      — idempotent delete (used on sign-out)
 */
import * as SecureStore from 'expo-secure-store'

import {logger, safeMessage} from '#/logger'

const KEY = 'pendingClone.shareId.v1'

const SHARE_ID_RE = /^[0-9A-Za-z]{24}$/

/**
 * Validates and persists a share_id so it can survive a SIWA round-trip.
 *
 * Throws synchronously with `Error('invalid_share_id')` for malformed input
 * so the caller can abort before navigating to sign-in (T-0008-115..117).
 * Propagates SecureStore write errors to the caller (T-0008-129b) — the
 * caller surfaces a toast and does NOT navigate to sign-in.
 */
export async function setPendingClone(shareId: string): Promise<void> {
  if (!SHARE_ID_RE.test(shareId)) {
    throw new Error('invalid_share_id')
  }
  await SecureStore.setItemAsync(KEY, shareId)
}

/**
 * Returns the stored share_id (if any) and deletes it atomically.
 *
 * Returns null when:
 *   - no pending intent is stored (T-0008-119)
 *   - SecureStore.getItemAsync throws transiently (T-0008-118b)
 *
 * Read errors are treated as "no intent" — the user can re-tap the link.
 * We do NOT crash SessionProvider. Delete errors after a successful read
 * are logged but not surfaced; the caller gets the value anyway (worst case:
 * a second pop reads the same value and the idempotency guard on
 * acceptCloneIntent makes the second clone a no-op).
 *
 * Pending intents never expire (ADR-0008 §P1-2 decision; T-0008-117b pins
 * this contract — any future TTL addition will break that test).
 */
export async function popPendingClone(): Promise<string | null> {
  let value: string | null
  try {
    value = await SecureStore.getItemAsync(KEY)
  } catch (err) {
    logger.error('pendingClone_read_failed', {safeMessage: safeMessage(err)})
    return null
  }
  if (value) {
    try {
      await SecureStore.deleteItemAsync(KEY)
    } catch (err) {
      logger.error('pendingClone_delete_failed', {safeMessage: safeMessage(err)})
      // Surface the value anyway — see module-level doc.
    }
  }
  return value
}

/**
 * Clears the pending intent. Idempotent — no error if nothing is stored.
 * Called on sign-out to prevent cross-account intent replay (T-0008-123).
 */
export async function clearPendingClone(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY)
  } catch {
    // deleteItemAsync throws when the key doesn't exist on some platforms.
    // That's fine — idempotency is the contract.
  }
}
