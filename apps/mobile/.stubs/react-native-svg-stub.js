// Stub for react-native-svg until the native binary is rebuilt.
//
// MetricTile.tsx imports `react-native-svg` statically. The native binary
// on the simulator was built before react-native-svg was added; without the
// RNSVG native module registered, the import throws at module-init time.
//
// This stub returns no-op React components so the static module graph
// evaluates. SAMPLE_SPEC doesn't use MetricTile (it's a ListCRUD demo), so
// at runtime nothing actually renders these stubs.
const React = require('react')
const {View} = require('react-native')

function makeStub(name) {
  return function Stub(props) {
    return React.createElement(View, {...props, accessibilityLabel: `[svg-stub:${name}]`})
  }
}

const Svg = makeStub('Svg')

module.exports = Svg
module.exports.default = Svg
module.exports.Svg = Svg
module.exports.Circle = makeStub('Circle')
module.exports.Ellipse = makeStub('Ellipse')
module.exports.G = makeStub('G')
module.exports.Line = makeStub('Line')
module.exports.Path = makeStub('Path')
module.exports.Polygon = makeStub('Polygon')
module.exports.Polyline = makeStub('Polyline')
module.exports.Rect = makeStub('Rect')
module.exports.Text = makeStub('Text')
module.exports.TSpan = makeStub('TSpan')
module.exports.Use = makeStub('Use')
module.exports.Defs = makeStub('Defs')
module.exports.LinearGradient = makeStub('LinearGradient')
module.exports.RadialGradient = makeStub('RadialGradient')
module.exports.Stop = makeStub('Stop')
module.exports.ClipPath = makeStub('ClipPath')
module.exports.Mask = makeStub('Mask')
module.exports.Pattern = makeStub('Pattern')
module.exports.SvgXml = makeStub('SvgXml')
module.exports.SvgUri = makeStub('SvgUri')
