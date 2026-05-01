---
description: "React Native build skill: Expo dev server, web build, native builds, error parsing for the Bluesky Social App"
user-invocable: false
---

# React Native Build Skill

Provides canonical commands and error parsing for building the Bluesky Social App.

## Project Build Configuration

- **Framework**: React Native 0.81 with Expo 54
- **Language**: TypeScript
- **Platforms**: iOS, Android, Web
- **Package manager**: Yarn

## Build Commands

### Development

```bash
# Start Expo dev server
yarn start

# Start web development server
yarn web

# Run on iOS simulator
yarn ios

# Run on Android emulator/device
yarn android
```

### Production Builds

```bash
# Build web version
yarn build-web

# Generate native projects (prebuild)
yarn prebuild
```

### Quality Checks

```bash
# TypeScript type checking
yarn typecheck

# ESLint
yarn lint

# Jest tests
yarn test
```

**IMPORTANT**: Always use these yarn scripts, never call the underlying tools directly.

## Error Parsing

### TypeScript Errors
- Lines containing `error TS` are TypeScript errors
- Format: `src/path/file.tsx(line,col): error TS1234: message`
- Build is successful if exit code is 0 and no error lines appear

### ESLint Errors
- Lines with severity `error` are blocking
- Lines with severity `warning` are non-blocking
- New violations in changed files should be fixed

### Common Build Failures

1. **Missing import** — a file references a module not imported
2. **Type mismatch** — TypeScript strict mode caught an incompatibility
3. **Missing module** — `#/` alias not resolving correctly
4. **Metro bundler** — cache issues → `yarn start --reset-cache`
5. **Native dependencies** — need `yarn prebuild` after adding native packages

### Resolving Common Issues

```bash
# Clear Metro cache
yarn start --reset-cache

# Reinstall dependencies
rm -rf node_modules && yarn install

# Regenerate native projects
yarn prebuild

# iOS pod install (after prebuild)
cd ios && pod install && cd ..
```

## Import Aliases

The project uses `#/` as the import alias for `src/`:

```typescript
// Correct
import {useSession} from '#/state/session'
import {atoms as a} from '#/alf'

// Wrong
import {useSession} from '../../../state/session'
```

## Platform-Specific Files

The Metro bundler automatically resolves platform-specific files:
- `Component.tsx` — default/shared
- `Component.web.tsx` — web only
- `Component.native.tsx` — iOS + Android
- `Component.ios.tsx` — iOS only
- `Component.android.tsx` — Android only

## Environment Detection

```typescript
import {IS_WEB, IS_NATIVE, IS_IOS, IS_ANDROID} from '#/env'
```
