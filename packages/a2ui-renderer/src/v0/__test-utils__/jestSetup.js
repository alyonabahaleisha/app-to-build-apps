/**
 * jestSetup.js — setupFilesAfterFramework for the V0 a2ui-renderer Jest env.
 *
 * Pre-configure RTL's hostComponentNames to prevent detectHostComponentNames()
 * from probing native animated modules that use Flow utility types babel
 * cannot parse. Same pattern as src/legacy/test/jestSetup.js.
 *
 * Also provides a mock for react-native-safe-area-context so Screen component
 * tests that call useSafeAreaInsets() get a stable zero-insets response.
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

// Mock react-native-safe-area-context — the renderer uses useSafeAreaInsets()
// in ScreenRenderer. In tests, return zero insets (no safe area).
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0}),
  SafeAreaProvider: ({children}) => children,
  SafeAreaView: ({children}) => children,
  SafeAreaInsetsContext: {Consumer: ({children}) => children({top: 0, bottom: 0, left: 0, right: 0})},
}))
