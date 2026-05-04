/**
 * jestSetup.js — setupFilesAfterFramework for the a2ui-renderer Jest env.
 *
 * RTL's detectHostComponentNames() renders a probe tree to discover the
 * internal types for Text, TextInput, Image, Switch, ScrollView, and Modal.
 * In the renderer package's Jest env (react-native preset, not jest-expo),
 * that probe hits `NativeAnimatedHelper.js` and `AnimatedObject.js` which
 * use Flow utility types (`$NonMaybeType`, type-guard `value is T`) that
 * @babel/preset-flow cannot parse in this RN 0.76 version.
 *
 * The workaround: pre-configure RTL's `hostComponentNames` with the string
 * names that RN uses for these host components in its test renderer, so
 * detectHostComponentNames() is never called. These string names are stable
 * across RN 0.74–0.76 in the test renderer (no native bridge, no Fabric).
 *
 * See RTL configure() API:
 *   https://callstack.github.io/react-native-testing-library/docs/api#configure
 */
const {configure} = require('@testing-library/react-native')

configure({
  hostComponentNames: {
    text: 'Text',
    textInput: 'TextInput',
    image: 'Image',
    switch: 'Switch',
    scrollView: 'ScrollView',
    modal: 'Modal',
  },
})
