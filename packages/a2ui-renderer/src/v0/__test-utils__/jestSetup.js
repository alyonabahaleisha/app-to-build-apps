/**
 * jestSetup.js — setupFilesAfterFramework for the V0 a2ui-renderer Jest env.
 *
 * Pre-configure RTL's hostComponentNames to prevent detectHostComponentNames()
 * from probing native animated modules that use Flow utility types babel
 * cannot parse. Same pattern as src/legacy/test/jestSetup.js.
 *
 * Also provides mocks for:
 *   - react-native-safe-area-context (Screen component tests)
 *   - react-native-reanimated (via moduleNameMapper → ReactNativeReanimatedMock.js)
 *   - @shopify/flash-list (List tier FlashList tests — Step 7)
 *   - react-native-gesture-handler (SwipeableRow tests — Step 7)
 *
 * Note: react-native-reanimated is mocked via moduleNameMapper in jest.config.rn.cjs
 * (not via require() here) because the official mock.js pulls in real source
 * files that contain Flow type annotations which Babel cannot parse.
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

// Mock @shopify/flash-list — FlashList is a native-backed component; in tests
// we render as a simple View-based container that iterates over data and
// renders each item via renderItem. Uses only View (not ScrollView) to avoid
// pulling in the Flow-typed AnimatedObject.js chain from react-native's ScrollView.
//
// testID defaults to "flashlist" so tests can locate the element with getByTestId.
jest.mock('@shopify/flash-list', () => {
  const React = require('react')
  const {View} = require('react-native')
  function FlashList({data, renderItem, keyExtractor, ListEmptyComponent, testID}) {
    const rootProps = {testID: testID ?? 'flashlist'}
    if (!data || data.length === 0) {
      return ListEmptyComponent
        ? React.createElement(View, rootProps, React.createElement(ListEmptyComponent))
        : React.createElement(View, rootProps)
    }
    return React.createElement(
      View,
      rootProps,
      data.map((item, index) => {
        const key = keyExtractor ? keyExtractor(item, index) : String(index)
        return React.createElement(View, {key}, renderItem({item, index}))
      }),
    )
  }
  return {FlashList}
})

// Mock expo-image-picker — native image picker; not available in Jest env.
// Default behavior: library returns a cancelled result. Individual tests that
// need a successful pick call mockResolvedValueOnce on launchImageLibraryAsync
// or launchCameraAsync.
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn().mockResolvedValue({canceled: true, assets: []}),
  launchCameraAsync: jest.fn().mockResolvedValue({canceled: true, assets: []}),
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({status: 'granted', canAskAgain: true, granted: true, expires: 'never'}),
  MediaTypeOptions: {Images: 'Images', Videos: 'Videos', All: 'All'},
  ImagePickerOptions: {},
}))

// Mock react-native-ai-apple — optional native dep; not available in Jest env.
// The try/catch in aiCapabilitiesCheck and aiDispatcher handle MODULE_NOT_FOUND,
// so this mock is defense-in-depth. Tests that need AI behavior mock the
// AICapabilitiesProvider hook directly.
jest.mock('react-native-ai-apple', () => {
  throw Object.assign(new Error('Cannot find module'), {code: 'MODULE_NOT_FOUND'})
}, {virtual: true})

// Mock expo-haptics — peerDep provided by host at runtime; not available in Jest env.
// Also mapped via moduleNameMapper (ExpoHapticsMock.js), but jest.mock here ensures
// jest.clearAllMocks() between tests properly resets call counts for haptic assertions
// (T-0006-155, T-0006-159). Using jest.fn() directly rather than the mapper file so
// tests in haptics.test.ts can call toHaveBeenCalledWith() without "not a mock function" errors.
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: {Light: 'light', Medium: 'medium', Heavy: 'heavy'},
  NotificationFeedbackType: {Success: 'success', Warning: 'warning', Error: 'error'},
}))

// Mock react-native-gesture-handler — SwipeableRow uses Swipeable from RNGH.
// In tests, render the children and action buttons directly (always visible)
// so tests can assert on dispatch calls without simulating gesture events.
jest.mock('react-native-gesture-handler', () => {
  const React = require('react')
  const {View} = require('react-native')
  function Swipeable({children, renderLeftActions, renderRightActions, testID}) {
    return React.createElement(
      View,
      {testID},
      renderLeftActions ? renderLeftActions() : null,
      children,
      renderRightActions ? renderRightActions() : null,
    )
  }
  function GestureHandlerRootView({children, style}) {
    return React.createElement(View, {style}, children)
  }
  return {Swipeable, GestureHandlerRootView}
})
