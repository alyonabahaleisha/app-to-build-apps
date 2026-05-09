/**
 * flushEffects — shared test utility for flushing async effects.
 *
 * Extracts the `act()` flush pattern used across test suites (per Roz Step 3
 * note). Useful for components with async state resolution (e.g., AI
 * capabilities check). Layout components (Step 4) are mostly synchronous,
 * but this utility is in place for Steps 5+ consumers.
 */
import {act} from '@testing-library/react-native'

export async function flushEffects(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
  })
}
