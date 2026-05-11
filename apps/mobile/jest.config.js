/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/?(*.)+(test).ts?(x)'],
  // Override the preset's `transformIgnorePatterns` to (a) include the
  // `@react-native/js-polyfills` package (jest-expo 52's default omits it
  // and the package ships Flow-typed JS), and (b) match pnpm's
  // `.pnpm/<scope+name>@<version>/node_modules/...` layout, where `/` in
  // package names is encoded as `+`. Combined with `@babel/preset-flow`
  // in babel.config.js, this lets jest-expo parse RN's polyfill files.
  //
  // `@gorhom/bottom-sheet`, `react-native-reanimated`, and
  // `react-native-gesture-handler` are added here so Jest transforms their
  // ESM source (ADR-0002 Step 9).
  //
  // Step 11 (ADR-0006): @shopify/flash-list added because the V0 renderer
  // (now at the package root) imports it. Tests that load the Navigation tree
  // transitively import the renderer, so flash-list must be transformable.
  transformIgnorePatterns: [
    'node_modules/(?!(\\.pnpm/(@?(jest-)?react-native|@react-native(-community)?|@react-native\\+[^/]+|expo(nent)?|@expo(nent)?\\+[^/]+|@expo-google-fonts\\+[^/]+|react-navigation|@react-navigation\\+[^/]+|@unimodules\\+[^/]+|unimodules|sentry-expo|native-base|react-native-svg|@supabase\\+[^/]+|@supabase|@gorhom\\+[^/]+|react-native-reanimated\\+[^/]+|react-native-gesture-handler\\+[^/]+|@shopify\\+flash-list\\+[^/]+)|((jest-)?react-native|@react-native(-community)?|@react-native/.*|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@supabase|@supabase/.*|@gorhom/.*|react-native-reanimated|react-native-gesture-handler|@shopify/flash-list)))',
  ],
  // Mock @gorhom/bottom-sheet using its built-in Jest mock.
  moduleNameMapper: {
    '^@gorhom/bottom-sheet$': '@gorhom/bottom-sheet/mock',
    // Strip .js extension from relative imports inside workspace packages.
    // The V0 renderer uses explicit .js extensions (ESM convention) which
    // Jest cannot resolve without this mapper. Applies to relative paths
    // that begin with ./ or ../ — workspace package imports are unaffected.
    '^(\\.{1,2}/.*)\\.js$': '$1',
    // expo/fetch requires the ExpoFetchModule native module (unavailable in Jest).
    // Tests that need real fetch behaviour mock generate.ts directly.
    '^expo/fetch$': '<rootDir>/.stubs/expo-fetch-stub.js',
    // expo-linear-gradient uses native modules unavailable in Jest.
    // Stub renders a plain View so tests can assert on gradient props.
    '^expo-linear-gradient$': '<rootDir>/.stubs/expo-linear-gradient-stub.js',
    // expo-apple-authentication requires a native iOS module unavailable in Jest.
    // Every test importing siwaProvider (directly or transitively) receives this
    // mock. Tests call jest.spyOn on signInAsync to control fixture data.
    // Per ADR-0013 Step 2 AC item 10.
    '^expo-apple-authentication$': '<rootDir>/src/testHelpers/mockExpoAppleAuthentication.ts',
  },
}
