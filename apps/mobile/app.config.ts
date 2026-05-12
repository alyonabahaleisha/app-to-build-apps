import {ExpoConfig, ConfigContext} from 'expo/config'

export default ({config}: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'App Creator',
  slug: 'app-creator',
  version: '0.1.0',
  orientation: 'portrait',
  scheme: 'appcreator',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  // splash: deferred — no asset shipped at MVP. Expo's default white splash
  // will be used. Add `splash: {image, resizeMode, backgroundColor}` here
  // when the brand splash is ready.
  ios: {
    bundleIdentifier: process.env.IOS_BUNDLE_ID ?? 'com.appcreator.mvp',
    buildNumber: process.env.IOS_BUILD_NUMBER ?? '1',
    supportsTablet: false,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
    // Universal Links entitlement — required for iOS to intercept
    // https://canvas.app/m/* URLs. The AASA file on the API side must
    // list this app's APPLE_APP_ID_PREFIX to close the handshake.
    associatedDomains: ['applinks:canvas.app'],
  },
  plugins: ['expo-secure-store', 'expo-apple-authentication'],
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    eas: {projectId: process.env.EAS_PROJECT_ID ?? ''},
    // Dev-mode runtime smoke check: assert that the running app's bundle ID
    // matches the AASA file's expected appID. Set to the same value as the
    // server-side APPLE_APP_ID_PREFIX env var (e.g. "TEAMID.com.appcreator.mvp").
    // Intentionally undefined in CI/production — the Eva post-deploy smoke
    // test curls the AASA file directly (aasa-smoke.yml).
    appleAppSiteAssociationAppId: process.env.APPLE_APP_SITE_EXPECTED_APP_ID,
  },
})
