/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/?(*.)+(test).ts'],
  testTimeout: 120_000, // testcontainers boot can take 30–60s on first run
  moduleNameMapper: {
    '^#/(.*)$': '<rootDir>/src/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', {tsconfig: 'tsconfig.json'}],
  },
}
