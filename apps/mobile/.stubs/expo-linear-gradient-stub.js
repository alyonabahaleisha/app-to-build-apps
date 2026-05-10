// Stub for expo-linear-gradient in the Jest test environment.
//
// LinearGradient uses native modules unavailable in Jest.
// This stub renders a plain View with the same children, preserving testability.
// Tests can inspect `colors` via the component's props using getByTestId or
// by inspecting the rendered component tree.
const React = require('react')
const {View} = require('react-native')

function LinearGradient({colors, style, children, testID, start, end, ...rest}) {
  // Expose colors as a prop so tests can assert on tint values.
  return React.createElement(
    View,
    {style, testID, 'data-gradient-colors': colors?.join(','), ...rest},
    children,
  )
}

module.exports = {LinearGradient}
