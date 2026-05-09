// Custom snapshot resolver for Node-runtime tests.
// Directs Jest snapshots to __node-snapshots__/ instead of the default __snapshots__/.
// This keeps Node and RN snapshot files separate so cross-runtime parity is
// unambiguous (ADR-0005 §J / T-0005-256a).
//
// Jest's consistency check: resolveTestPath(resolveSnapshotPath(X)) must === X.
// We store: <pkgRoot>/__node-snapshots__/<basename>.snap
// And recover: <pkgRoot>/src/<basename> (strip .snap, assume src/)

const path = require('path')

const PKG_ROOT = __dirname
const SNAP_EXT = '.snap'

module.exports = {
  /**
   * Resolves the snapshot file path from a test file path.
   * e.g. /abs/path/to/packages/design-system/src/coverArt.test.ts
   *   → /abs/path/to/packages/design-system/__node-snapshots__/coverArt.test.ts.snap
   */
  resolveSnapshotPath: (testFilePath, snapshotExtension) => {
    const base = path.basename(testFilePath)
    return path.join(PKG_ROOT, '__node-snapshots__', base + snapshotExtension)
  },

  /**
   * Resolves the test file path from a snapshot file path.
   * e.g. /abs/.../design-system/__node-snapshots__/coverArt.test.ts.snap
   *   → /abs/.../design-system/src/coverArt.test.ts
   */
  resolveTestPath: (snapshotFilePath, snapshotExtension) => {
    const snapBase = path.basename(snapshotFilePath, snapshotExtension)
    return path.join(PKG_ROOT, 'src', snapBase)
  },

  // Required by Jest — must be a file that round-trips correctly through the two functions above.
  testPathForConsistencyCheck: path.join(PKG_ROOT, 'src', 'example.test.ts'),
}
