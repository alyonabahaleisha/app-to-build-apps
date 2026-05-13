// Stub for expo-apple-authentication until the native binary is rebuilt.
//
// siwaProvider.ts imports `expo-apple-authentication` and calls
// `AppleAuthentication.signInAsync(...)` plus uses enum constants. The native
// binary on the simulator was built before this package was added; the
// "ExpoAppleAuthentication" native view manager / module isn't registered.
//
// This stub exports the enum constants and a `signInAsync` that immediately
// rejects with a clear "not available" error. The "Continue without signing in"
// path remains, so the user can still bypass auth to reach the Library.
async function signInAsync() {
  throw new Error(
    '[expo-apple-authentication stub] Not available in this build. Use "Continue without signing in" or rebuild the dev-client.',
  )
}

async function isAvailableAsync() {
  return false
}

const AppleAuthenticationScope = {
  FULL_NAME: 0,
  EMAIL: 1,
}

const AppleAuthenticationCredentialState = {
  REVOKED: 0,
  AUTHORIZED: 1,
  NOT_FOUND: 2,
  TRANSFERRED: 3,
}

const AppleAuthenticationOperation = {
  IMPLICIT: 0,
  LOGIN: 1,
  REFRESH: 2,
  LOGOUT: 3,
}

const AppleAuthenticationButtonStyle = {
  WHITE: 0,
  WHITE_OUTLINE: 1,
  BLACK: 2,
}

const AppleAuthenticationButtonType = {
  SIGN_IN: 0,
  CONTINUE: 1,
  SIGN_UP: 2,
}

// AppleAuthenticationButton is a native view; the warning we saw said the view
// manager isn't exported. Stub it as a no-op View so renders don't crash.
const React = require('react')
const {View} = require('react-native')
function AppleAuthenticationButton(props) {
  return React.createElement(View, {
    ...props,
    accessibilityLabel: '[siwa-button-stub]',
  })
}

module.exports = {
  signInAsync,
  isAvailableAsync,
  AppleAuthenticationScope,
  AppleAuthenticationCredentialState,
  AppleAuthenticationOperation,
  AppleAuthenticationButtonStyle,
  AppleAuthenticationButtonType,
  AppleAuthenticationButton,
  // The TS-only types (AppleAuthenticationFullName, AppleAuthenticationCredential)
  // don't need runtime entries.
}
