/**
 * coachmarkStorage — wraps expo-secure-store for the `coachmark_share_seen` key.
 *
 * Per ADR-0011 Step 10 + canvas-v0-ux.md §First-Time-User Coachmark (note 7):
 * This is per-device state (not per-account), so it lives in expo-secure-store,
 * not in the mini_apps table. A user signing in on a new device should see the
 * coachmark again — it's an iOS gesture they need to learn on this device.
 *
 * Exported functions:
 *   `hasSeenCoachmark()` — T-0011-284
 *   `markCoachmarkSeen()` — T-0011-283
 */
import * as SecureStore from 'expo-secure-store'

const COACHMARK_KEY = 'coachmark_share_seen'

/**
 * Returns true if the user has already dismissed the share coachmark
 * on this device. Reads return null on failure (treated as not-seen).
 */
export async function hasSeenCoachmark(): Promise<boolean> {
  try {
    const value = await SecureStore.getItemAsync(COACHMARK_KEY)
    return value === 'true'
  } catch {
    // On read failure, treat as not-seen so the coachmark shows.
    return false
  }
}

/**
 * Marks the share coachmark as seen on this device.
 * Failures are swallowed — a write error should not crash the UI.
 */
export async function markCoachmarkSeen(): Promise<void> {
  try {
    await SecureStore.setItemAsync(COACHMARK_KEY, 'true')
  } catch {
    // Non-fatal — coachmark will re-appear on next mount (acceptable failure mode).
  }
}
