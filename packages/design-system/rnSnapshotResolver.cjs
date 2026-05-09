// Custom snapshot resolver for RN-runtime tests.
// Directs Jest snapshots to __rn-snapshots__/ instead of the default __snapshots__/.
// Keeps RN and Node snapshot files separate for cross-runtime parity assertion
// (ADR-0005 §J / T-0005-256a).
//
// Jest's consistency check: resolveTestPath(resolveSnapshotPath(X)) must === X.
// We store: <pkgRoot>/__rn-snapshots__/<basename>.snap
// And recover: <pkgRoot>/src/<basename> (strip .snap)

const path = require('path')

const PKG_ROOT = __dirname

module.exports = {
  /**
   * Resolves the snapshot file path from a test file path.
   * e.g. /abs/.../design-system/src/coverArt.rn.test.ts
   *   → /abs/.../design-system/__rn-snapshots__/coverArt.rn.test.ts.snap
   */
  resolveSnapshotPath: (testFilePath, snapshotExtension) => {
    const base = path.basename(testFilePath)
    return path.join(PKG_ROOT, '__rn-snapshots__', base + snapshotExtension)
  },

  /**
   * Resolves the test file path from a snapshot file path.
   * e.g. /abs/.../design-system/__rn-snapshots__/coverArt.rn.test.ts.snap
   *   → /abs/.../design-system/src/coverArt.rn.test.ts
   */
  resolveTestPath: (snapshotFilePath, snapshotExtension) => {
    const snapBase = path.basename(snapshotFilePath, snapshotExtension)
    return path.join(PKG_ROOT, 'src', snapBase)
  },

  // Required by Jest — must be a file that round-trips correctly through the two functions above.
  testPathForConsistencyCheck: path.join(PKG_ROOT, 'src', 'example.rn.test.ts'),
}
