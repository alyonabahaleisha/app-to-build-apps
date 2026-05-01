---
description: "Expo / EAS skill: dev workflow with dev-client, EAS Build for iOS, EAS Submit to App Store Connect, secrets, version/buildNumber discipline, and common error parsing for the App Creator MVP."
user-invocable: false
---

# Expo / EAS Skill

The App Creator mobile app is built with **Expo (managed workflow)** and shipped via **EAS Build + EAS Submit**. Local Expo Go is **not supported** because we use native modules (`react-native-mmkv`, `@sentry/react-native`, `expo-secure-store`) that aren't in the Expo Go bundle.

## When to use this skill

- Running the mobile app locally (always via dev-client, never Expo Go).
- Producing a TestFlight build.
- Adding or rotating secrets.
- Bumping version / `buildNumber`.
- Debugging EAS Build failures.
- Configuring Apple credentials.

## Project configuration

Single source of truth: `apps/mobile/app.config.ts`.

```ts
import {ExpoConfig, ConfigContext} from 'expo/config'

export default ({config}: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'App Creator',
  slug: 'app-creator',
  version: '0.1.0',
  orientation: 'portrait',
  scheme: 'appcreator',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: process.env.IOS_BUNDLE_ID ?? 'com.example.appcreator',
    buildNumber: process.env.IOS_BUILD_NUMBER ?? '1',
    supportsTablet: false,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,  // saves a question on App Store Connect
    },
  },
  plugins: [
    'expo-secure-store',
    '@sentry/react-native/expo',
  ],
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  },
})
```

`buildNumber` increments on every production build. `version` follows semver and bumps when shipping a meaningfully new feature to TestFlight.

## EAS profile structure

`apps/mobile/eas.json`:

```json
{
  "cli": {"version": ">= 11.0.0"},
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {"simulator": true}
    },
    "preview": {
      "distribution": "internal",
      "ios": {"simulator": false}
    },
    "production": {
      "distribution": "store",
      "ios": {"autoIncrement": "buildNumber"}
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "$APPLE_ID",
        "ascAppId": "$ASC_APP_ID",
        "appleTeamId": "$APPLE_TEAM_ID"
      }
    }
  }
}
```

Three profiles, three meanings:
- `development` — dev-client for engineers, runs on simulator + sideloaded device.
- `preview` — internal share-link for non-engineers, no Apple review.
- `production` — TestFlight + App Store. The only profile that ships.

## Local dev workflow

```bash
# First time only: build a dev-client (one per simulator OS major version)
pnpm --filter @app-creator/mobile eas build --profile development --platform ios --local

# After install on simulator
pnpm --filter @app-creator/mobile expo start --dev-client

# Or for a physical device, scan the QR code from `expo start --dev-client --tunnel`
```

`--local` runs the build on this machine (requires Xcode); without it, EAS runs the build in the cloud (slower but no Xcode required).

## Producing a TestFlight build

Pre-flight checklist:
1. ✅ Bundle ID set in `app.config.ts` (or `IOS_BUNDLE_ID` env).
2. ✅ App Store Connect record exists with that bundle ID.
3. ✅ Apple Developer account enrolled and accepted EAS to manage credentials (`eas credentials` walks through it).
4. ✅ `version` and `buildNumber` reviewed.
5. ✅ All tests + eval pass on this commit.

Build + submit:
```bash
# Build
pnpm --filter @app-creator/mobile eas build --platform ios --profile production

# After success (link returned in CLI), submit
pnpm --filter @app-creator/mobile eas submit --platform ios --latest
```

App Store Connect processes the binary (~15 min). After that:
- **Internal testing group** → testers see the build automatically, no Apple beta review.
- **External testing group** → requires Apple beta review (24–48h, sometimes faster).

For M1 we use **internal only** — faster iteration, no review queue.

## Secrets

App-side env vars (read in `app.config.ts` or `expo-constants`):

```bash
# Public (reachable from JS, prefix is enforced)
eas secret:create --name EXPO_PUBLIC_API_URL --value https://api.appcreator.example.com
eas secret:create --name EXPO_PUBLIC_SENTRY_DSN --value <dsn>

# Build-time only (not bundled)
eas secret:create --name IOS_BUNDLE_ID --value com.yourorg.appcreator
eas secret:create --name APPLE_TEAM_ID --value ABC123XYZ
```

Rules:
- `EXPO_PUBLIC_*` are bundled into the JS — anything reachable to a determined attacker. Don't put service-role keys here.
- API keys for Anthropic / Supabase service role / etc live on the **backend**, not in mobile secrets. The mobile app talks to our API; our API talks to vendors.

## Versioning discipline

| When | What to bump |
|---|---|
| Bug fix, no new feature | `buildNumber++` only |
| New feature shipped to TestFlight | `version` minor++ + `buildNumber++` |
| Breaking change (rare at MVP) | `version` major++ + `buildNumber++` |

`buildNumber` is **monotonic** and never reused — even after a failed upload. App Store Connect rejects re-uploads with the same `buildNumber`.

EAS can auto-increment via `"autoIncrement": "buildNumber"` in `eas.json` (already configured for the `production` profile).

## Common error parsing

### "Bundle identifier is not registered"
You haven't created the App Store Connect record yet. Create it at https://appstoreconnect.apple.com → My Apps → + → New App, using the same bundle ID as `app.config.ts`.

### "Invalid binary — missing ITSAppUsesNonExemptEncryption"
Add `infoPlist: {ITSAppUsesNonExemptEncryption: false}` to the iOS config (already in our template). Saves a per-submission compliance question.

### "App Store Connect API error: ENTITY_ERROR.RELATIONSHIP.REQUIRED — appCategory"
Open the App Store Connect record → App Information → set Primary Category (e.g. Productivity). EAS Submit needs the record fully configured before it can attach the binary.

### "buildNumber must be greater than the previous build"
A previous upload (even a failed one) already used this `buildNumber`. Bump it.

### "Provisioning profile doesn't include the application's bundle identifier"
EAS-managed credentials are out of sync. Run `eas credentials` → iOS → Production → "Set up a new provisioning profile."

### "Code signing failure: no matching distribution certificate"
First-time setup. Run `eas credentials` and let EAS create + register the distribution cert. You'll need to be logged into your Apple Developer account.

### "Native module not found: RNCMaterialIcons"
Some package was added without a config plugin. Check ARCHITECTURE.md §13 — every native module needs Expo plugin coverage. If the package has no plugin, it can't be used.

### EAS build hangs at "Installing dependencies"
Almost always a `pnpm-lock.yaml` issue — outdated, or workspace mismatch. Regenerate with `pnpm install` from the repo root, commit, retry.

## Workflow for adding a native module

1. Confirm an Expo config plugin exists. Search expo.dev or the package README.
2. Add to `package.json` of `apps/mobile`.
3. Add the plugin name to `plugins` in `app.config.ts`.
4. Run `pnpm --filter @app-creator/mobile expo prebuild --platform ios --clean` to confirm the native config generates cleanly. Don't commit `ios/` — the prebuild is a sanity check.
5. Build a dev-client (`eas build --profile development --platform ios --local`).
6. Add the package to ARCHITECTURE.md §14 sanctioned list (architect approval needed if it's a new category).

## What the CLI cannot do for you

- **Apple Developer enrollment** — ($99/yr) must be done manually at developer.apple.com. EAS reads the credentials but can't enroll.
- **App Store Connect record creation** — must be created manually the first time. EAS writes to it but doesn't create it.
- **Apple Team ID lookup** — find it at developer.apple.com → Account → Membership.
- **Internal tester invites** — managed in App Store Connect. EAS uploads the binary; you invite testers by email.
