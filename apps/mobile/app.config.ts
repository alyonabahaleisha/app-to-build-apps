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
  },
  plugins: ['expo-secure-store'],
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    eas: {projectId: process.env.EAS_PROJECT_ID ?? ''},
  },
})
