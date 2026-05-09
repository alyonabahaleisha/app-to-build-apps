/** @type {import('jest').Config} */
// RN-component test runner for src/v0/ — populated in Steps 4–10 of ADR-0006.
// Mirrors the existing jest.config.js (react-native preset + babel-jest) but
// scoped to src/v0/ so legacy and V0 test suites run independently.
// Step 4: setup file + moduleNameMapper + transformIgnorePatterns updated for
// layout component tests (react-native-safe-area-context mocked in setup).
module.exports = {
  preset: 'react-native',
  passWithNoTests: true,
  testMatch: ['**/src/v0/**/?(*.)+(test).ts?(x)'],
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
      '<rootDir>/src/legacy/__mocks__/NativeAnimatedHelperMock.js',
    // Stub EventEmitter (Flow mapped-type syntax).
    '.*vendor/emitter/EventEmitter.*': '<rootDir>/src/legacy/__mocks__/EventEmitterMock.js',
    // expo-haptics: peerDep provided by host at runtime; stub for test env.
    '^expo-haptics$': '<rootDir>/src/legacy/__mocks__/ExpoHapticsMock.js',
    // react-native-reanimated: the official mock.js chains into Flow-typed RN source
    // files that Babel cannot parse. Use a fully self-contained manual mock instead.
    '^react-native-reanimated$':
      '<rootDir>/src/legacy/__mocks__/ReactNativeReanimatedMock.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(\\.pnpm/(@?(jest-)?react-native|@react-native(-community)?|@react-native\\+[^/]+|expo(nent)?|@expo(nent)?\\+[^/]+|react-navigation|@react-navigation\\+[^/]+|@testing-library\\+[^/]+|react-native-safe-area-context|react-native-reanimated|react-native-gesture-handler|@shopify/flash-list)|((jest-)?react-native|@react-native(-community)?|@react-native/.*|expo(nent)?|@expo(nent)?/.*|react-navigation|@react-navigation/.*|@testing-library/.*|react-native-safe-area-context|react-native-reanimated|react-native-gesture-handler|@shopify/flash-list)))',
  ],
}
