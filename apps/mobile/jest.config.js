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
  transformIgnorePatterns: [
    'node_modules/(?!(\\.pnpm/(@?(jest-)?react-native|@react-native(-community)?|@react-native\\+[^/]+|expo(nent)?|@expo(nent)?\\+[^/]+|@expo-google-fonts\\+[^/]+|react-navigation|@react-navigation\\+[^/]+|@unimodules\\+[^/]+|unimodules|sentry-expo|native-base|react-native-svg|@supabase\\+[^/]+|@supabase|@gorhom\\+[^/]+|react-native-reanimated\\+[^/]+|react-native-gesture-handler\\+[^/]+)|((jest-)?react-native|@react-native(-community)?|@react-native/.*|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@supabase|@supabase/.*|@gorhom/.*|react-native-reanimated|react-native-gesture-handler)))',
  ],
  // Mock @gorhom/bottom-sheet using its built-in Jest mock.
  moduleNameMapper: {
    '^@gorhom/bottom-sheet$': '@gorhom/bottom-sheet/mock',
  },
}
