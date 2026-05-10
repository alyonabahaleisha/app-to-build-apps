/** @type {import('jest').Config} */
// Step 13: Unified jest config — legacy deleted, a single config suffices.
//
// Previously there were two configs:
//   - jest.config.js       (legacy M1 tests, src/legacy/)
//   - jest.config.rn.cjs  (V0 component tests, src/v0/)
//
// With src/legacy/ gone, jest.config.rn.cjs becomes the sole config.
// Renamed to jest.config.js (Option A per ADR-0006 Step 13 decision).
// jest.config.rn.cjs is removed; package.json "test:rn" script is also removed.
//
// Mocks previously in src/legacy/__mocks__/ have been relocated to src/__mocks__/.
module.exports = {
  preset: 'react-native',
  passWithNoTests: true,
  // Match tests in src/v0/ subdirectories AND directly in src/v0/ itself.
  // The second pattern picks up snapshot-matrix.test.tsx and viewport.test.tsx
  // (Step 12) which live at the src/v0/ level, not inside a subdirectory.
  testMatch: [
    '**/src/v0/**/?(*.)+(test).ts?(x)',
    '**/src/v0/?(*.)+(test).ts?(x)',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  // Setup after framework: provides RTL hostComponentNames pre-config and
  // react-native-safe-area-context mock for ScreenRenderer tests.
  setupFilesAfterEnv: ['<rootDir>/src/v0/__test-utils__/jestSetup.js'],
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': 'babel-jest',
  },
  moduleNameMapper: {
    // Strip .js extension from relative imports for Jest resolution.
    '^(\\.{1,2}/.*)\\.js$': '$1',
    // Stub out NativeAnimatedHelper (Flow utility types break babel-jest in RN 0.76).
    '.*private/animated/NativeAnimatedHelper.*':
      '<rootDir>/src/__mocks__/NativeAnimatedHelperMock.js',
    // Stub EventEmitter (Flow mapped-type syntax).
    '.*vendor/emitter/EventEmitter.*': '<rootDir>/src/__mocks__/EventEmitterMock.js',
    // expo-haptics: peerDep provided by host at runtime; stub for test env.
    '^expo-haptics$': '<rootDir>/src/__mocks__/ExpoHapticsMock.js',
    // react-native-reanimated: the official mock.js chains into Flow-typed RN source
    // files that Babel cannot parse. Use a fully self-contained manual mock instead.
    '^react-native-reanimated$':
      '<rootDir>/src/__mocks__/ReactNativeReanimatedMock.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(\\.pnpm/(@?(jest-)?react-native|@react-native(-community)?|@react-native\\+[^/]+|expo(nent)?|@expo(nent)?\\+[^/]+|react-navigation|@react-navigation\\+[^/]+|@testing-library\\+[^/]+|react-native-safe-area-context|react-native-reanimated|react-native-gesture-handler|@shopify/flash-list|@gorhom/bottom-sheet)|((jest-)?react-native|@react-native(-community)?|@react-native/.*|expo(nent)?|@expo(nent)?/.*|react-navigation|@react-navigation/.*|@testing-library/.*|react-native-safe-area-context|react-native-reanimated|react-native-gesture-handler|@shopify/flash-list|@gorhom/bottom-sheet)))',
  ],
  // Coverage configuration.
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/v0/index.ts',
    '!src/__mocks__/**',
  ],
}
