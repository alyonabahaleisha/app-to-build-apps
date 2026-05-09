const path = require('path')

/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  // Exclude the RN-runtime test file from the Node suite — it has its own runner
  testMatch: ['**/?(*.)+(test).ts', '**/?(*.)+(test).tsx'],
  testPathIgnorePatterns: ['/node_modules/', '\\.rn\\.test\\.ts$'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {useESM: true, tsconfig: 'tsconfig.test.json'}],
  },
  // Custom snapshot resolver: Node-runtime snapshots go to __node-snapshots__/
  snapshotResolver: path.resolve(__dirname, 'nodeSnapshotResolver.cjs'),
}
