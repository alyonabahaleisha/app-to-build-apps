// Stub for expo/fetch in the Jest test environment.
//
// expo/fetch requires the ExpoFetchModule native module which isn't available
// in Jest. This stub delegates to global.fetch so tests that mock global.fetch
// (e.g., Chat/index.test.tsx) still work correctly.
//
// Step 11 (ADR-0006): added when the package-root cutover caused the full
// renderer source to be traversed, pulling in the generate.ts chain which
// imports expo/fetch.
module.exports = {
  // Delegate to global.fetch so tests can override it per-test with
  //   global.fetch = jest.fn().mockResolvedValue(...)
  // The function wrapper is necessary because global.fetch may be reassigned
  // after module evaluation.
  fetch: (...args) => global.fetch(...args),
}
