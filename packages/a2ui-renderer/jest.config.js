/** @type {import('jest').Config} */
module.exports = {
  // Use the react-native preset so __DEV__, __dirname globals and RN's
  // haste module system are properly configured. The preset sets up
  // setupFiles and testEnvironment needed for RTL + react-native.
  preset: 'react-native',
  passWithNoTests: true,
  // Pre-configure RTL's hostComponentNames so detectHostComponentNames() is
  // never called. In the renderer package's Jest env (react-native preset, not
  // jest-expo), the probe render hits NativeAnimatedHelper.js and AnimatedObject.js
  // which use Flow utility types that @babel/preset-flow cannot parse in RN 0.76.
  // This setup file bypasses that by providing the known string host-component names
  // directly. (See src/test/jestSetup.js for details.)
  setupFilesAfterEnv: ['<rootDir>/src/legacy/test/jestSetup.js'],
  // V0 component tests run under jest.config.rn.cjs (which has the safe-area
  // mock and RTL setup for V0). Exclude src/v0/ here to avoid duplicate runs
  // and missing-mock failures in the legacy config's environment.
  testMatch: ['**/?(*.)+(test).ts?(x)'],
  testPathIgnorePatterns: ['/node_modules/', '/src/v0/'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  // Transform everything via babel-jest using the renderer's babel.config.js.
  // This handles:
  //   - TypeScript/TSX via @babel/preset-typescript + @babel/preset-react
  //   - Flow types in react-native packages via @babel/preset-flow
  // Note: ts-jest is not used here because it conflicts with Istanbul's
  // coverage instrumentation when collectCoverageFrom includes tsx files.
  // Type-checking is handled separately by `pnpm typecheck`.
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': 'babel-jest',
  },
  // Extended transformIgnorePatterns to handle pnpm's .pnpm layout.
  transformIgnorePatterns: [
    'node_modules/(?!(\\.pnpm/(@?(jest-)?react-native|@react-native(-community)?|@react-native\\+[^/]+|expo(nent)?|@expo(nent)?\\+[^/]+|react-navigation|@react-navigation\\+[^/]+|@testing-library\\+[^/]+)|((jest-)?react-native|@react-native(-community)?|@react-native/.*|expo(nent)?|@expo(nent)?/.*|react-navigation|@react-navigation/.*|@testing-library/.*)))',
  ],
  // Map Flow-typed react-native internals that @babel/preset-flow cannot parse
  // (specifically EventEmitter.js which uses Flow mapped-type syntax) to empty
  // module mocks. These are implementation details not relevant to renderer tests.
  // Note: moduleNameMapper matches against the IMPORT STRING as written in source
  // (relative imports like '../vendor/emitter/EventEmitter' are matched against
  // the resolved absolute module id). The pattern covers both relative and absolute
  // import paths that resolve to this file.
  moduleNameMapper: {
    // Strip .js extension from relative imports so Jest can find .ts source files.
    // Source files use .js extensions for ESM TypeScript compatibility (tsc),
    // but Jest's babel-jest transform resolves .ts files directly.
    '^(\\.{1,2}/.*)\\.js$': '$1',
    // Match both: import-as-written '../vendor/emitter/EventEmitter' and
    // the resolved absolute path (jest checks both depending on version).
    '.*vendor/emitter/EventEmitter.*': '<rootDir>/src/legacy/__mocks__/EventEmitterMock.js',
    // expo-haptics is a peerDependency provided by the host app at runtime.
    // In the renderer's Jest environment its transitive deps (expo-modules-core)
    // contain Flow-typed and native code the react-native preset cannot parse.
    // Map to a minimal mock that provides the ImpactFeedbackStyle + impactAsync
    // surface ButtonRenderer needs (T-0003-065 overrides at the test-file level).
    '^expo-haptics$': '<rootDir>/src/legacy/__mocks__/ExpoHapticsMock.js',
    // NativeAnimatedHelper.js in RN 0.76 uses the Flow utility type
    // `$NonMaybeType<typeof ...>['key']` which @babel/preset-flow cannot parse.
    // RTL's detectHostComponentNames() triggers this import when render() is
    // called; the renderer's tests don't exercise native animation, so a stub suffices.
    '.*private/animated/NativeAnimatedHelper.*':
      '<rootDir>/src/legacy/__mocks__/NativeAnimatedHelperMock.js',
  },
  // Coverage configuration.
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/legacy/test/**',
    '!src/v0/index.ts',
  ],
}
