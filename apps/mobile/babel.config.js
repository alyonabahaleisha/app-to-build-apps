module.exports = function (api) {
  api.cache(true)
  return {
    // `@babel/preset-flow` strips Flow type syntax. React Native's source
    // (notably `@react-native/js-polyfills/error-guard.js`) ships Flow,
    // and `babel-preset-expo` does NOT enable Flow stripping by default
    // under jest-expo. Without this preset, jest fails to parse those
    // files. Listed AFTER expo so Flow stripping runs after expo's
    // top-level transforms.
    presets: ['babel-preset-expo', '@babel/preset-flow'],
    plugins: [
      [
        'module-resolver',
        {
          alias: {
            '#': './src',
          },
        },
      ],
      // Required by react-native-reanimated (peer dep of @gorhom/bottom-sheet).
      // Must be listed last per the reanimated docs.
      'react-native-reanimated/plugin',
    ],
  }
}
