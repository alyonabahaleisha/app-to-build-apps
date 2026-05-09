// Pure-JS SHA-256 helper — runs on Node and React Native (no native bindings).
//
// Wraps js-sha256@0.10.1 to provide a stable, typed, single-purpose API.
// The seed input accepted by coverArt is a 32-char hex string.
// sha256(seed) → 64-char hex; this 64-char string is passed to seedrandom()
// for full entropy spread across the PRNG state.

import {sha256 as _sha256} from 'js-sha256'

/**
 * Returns the SHA-256 hex digest of the input string.
 * Output is always a lowercase 64-character hex string.
 * Pure function — no side effects, no state.
 */
export function sha256(input: string): string {
  return _sha256(input)
}
