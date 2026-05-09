const path = require('path')

// RN-runtime Jest configuration.
// Runs coverArt.rn.test.ts under the jest-expo preset to simulate the
// React Native JavaScript runtime. coverArt.ts itself has no RN-specific
// imports, so the same pure-JS code runs on both runtimes.
// Snapshots go to __rn-snapshots__/ to keep them separate from Node snapshots.
//
// Usage: pnpm --filter @app-creator/design-system exec jest --config jest.rn.config.cjs

/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  // Only run the RN-specific test file
  testMatch: ['**/*.rn.test.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {useESM: true, tsconfig: 'tsconfig.test.json'}],
  },
  // Custom snapshot resolver: RN snapshots go to __rn-snapshots__/
  snapshotResolver: path.resolve(__dirname, 'rnSnapshotResolver.cjs'),
}
