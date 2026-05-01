{\rtf1\ansi\ansicpg1252\cocoartf2868
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 ---\
description: Deep one-time exploration of the mobile codebase to produce ARCHITECTURE.md \'97 the source-of-truth spec that all other architecture commands render. Run on initial setup or after major refactors. Output is a decision-record-style document covering layering, state, networking, components, styling, observability, analytics, accessibility, dependencies, and known debt.\
argument-hint: [optional: "refresh" to update existing ARCHITECTURE.md, or a section name to deep-dive only that area]\
---\
\
# /architecture-discover\
\
Produce or refresh `ARCHITECTURE.md` at the repo root by **deeply exploring the codebase**. This is the slow, expensive command \'97 it reads files, traces imports, samples real code, and infers the rules the codebase actually follows (not the rules someone wishes it followed).\
\
The output document is the contract that `/system-overview`, `/architecture-check`, and feature-development commands all render against. If `ARCHITECTURE.md` is wrong, every downstream command is wrong. Take the time to get it right.\
\
## Input\
\
Topic: $ARGUMENTS\
\
| Argument | Behavior |\
|---|---|\
| *(empty)* | Full discovery. Produce `ARCHITECTURE.md` from scratch (or fail loudly if one exists \'97 use `refresh` to overwrite). |\
| `refresh` | Re-run full discovery, diff against existing `ARCHITECTURE.md`, propose changes section-by-section before writing. |\
| `<section>` | Re-run discovery for one section only (e.g. `networking`, `styling`, `analytics`). Patch that section in place. |\
\
## Step 0 \'97 Establish ground truth\
\
Before exploring, identify:\
\
1. **Repo root** \'97 confirm with `git rev-parse --show-toplevel`.\
2. **Stack signature** \'97 read `package.json`. Note: React Native vs Expo vs bare; native iOS/Android folders present?; monorepo (workspaces, nx, turbo)?\
3. **Existing docs** \'97 `CLAUDE.md`, `README.md`, `CONTRIBUTING.md`, `docs/`. These are hints, not truth. The code is truth.\
4. **Entry points** \'97 `index.js` / `App.tsx` / `app/_layout.tsx` (Expo Router). Trace from here.\
\
If this isn't a mobile codebase (no React Native, no Expo, no native folders), stop and say so.\
\
## Step 1 \'97 Explore systematically\
\
Work through the areas below **in order**. For each area, the goal is to answer three questions:\
\
1. **What did they pick?** (the actual tool / pattern in use)\
2. **What did they reject?** (inferred from absence \'97 if there's no axios, axios was rejected; if there's no Redux, Redux was rejected)\
3. **What's the rule?** (the convention new code must follow, derived from the dominant pattern, not the outliers)\
\
Use these exploration techniques per area. **Do not skip** \'97 partial exploration produces wrong rules.\
\
### 1.1 Layering & directory structure\
- `tree -L 3 -d src/` (or equivalent). Map the top-level folders.\
- For each top-level folder under `src/`, open 2\'963 representative files. What does this layer *do*?\
- Trace 2\'963 import chains from a screen down to a primitive. What's the dependency direction?\
- **Output to capture:** the layered stack, dependency direction, what each folder owns.\
\
### 1.2 Navigation\
- Find the navigator setup (React Navigation `createXNavigator`, or Expo Router `app/` folder).\
- List route definitions. Are routes typed? Is there a central route registry?\
- How are deep links handled?\
- **Output to capture:** navigation library, route typing approach, deep link strategy.\
\
### 1.3 Authentication & session\
- Search for token storage: `grep -r "accessToken\\|refreshToken\\|Bearer" src/`.\
- Find the session module (`src/state/session`, `src/auth`, `src/store/auth`, etc.).\
- Is there a single network client (agent, apollo client, axios instance) or many?\
- How is multi-account handled, if at all?\
- **Output to capture:** session location, single vs multi-client pattern, token access rules.\
\
### 1.4 Networking & server state\
- Search for: `useQuery`, `useMutation`, `useInfiniteQuery`, `useSWR`, `apollo`, `urql`, `axios`, `fetch(`.\
- Count occurrences. The one with the highest count is the sanctioned pattern; the rest are debt or special cases.\
- Find the query-key convention (factory function? array literals? object params?).\
- Find the error-handling convention (try/catch in hook? error boundary? toast?).\
- **Output to capture:** sanctioned data-fetching library, query-key pattern, error pattern.\
\
### 1.5 Persistence tiers\
- Search for storage adapters: `MMKV`, `AsyncStorage`, `expo-secure-store`, `react-native-keychain`, `localStorage`.\
- Find the storage wrapper (`src/storage`, `src/lib/storage`). Is there one, or do components touch storage directly?\
- Identify each tier and what lives in it. A typical mobile app has 4\'966 tiers; name them.\
- **Output to capture:** the tier table \'97 name, location, what belongs there, what doesn't.\
\
### 1.6 Component / design system\
- Find the design system root: `src/components`, `src/ui`, `src/design-system`, `src/alf`.\
- Look for tokens: colors, spacing, typography. Are they centralized or inline?\
- Open 3 primitive components (Button, Text, Input). How are they styled? (StyleSheet, styled-components, NativeWind, Tamagui, Restyle, ALF-style atoms?)\
- Open 3 feature components. Do they compose primitives or re-style from scratch?\
- **Output to capture:** styling system, token location, layering (tokens \uc0\u8594  primitives \u8594  composed \u8594  feature \u8594  screen).\
\
### 1.7 State management (client state, not server state)\
- Search for: `createContext`, `useReducer`, `zustand`, `jotai`, `redux`, `recoil`, `mobx`, `valtio`.\
- For each found, count files using it. Dominant winner = sanctioned. Others = debt or scoped use.\
- Where do preferences / settings live? (separate from session?)\
- **Output to capture:** client state library, preferences location.\
\
### 1.8 Observability\
- Find the logger: `src/logger`, `src/lib/log`, or raw `console.*` everywhere.\
- `grep -rn "console\\.\\(log\\|warn\\|error\\)" src/ | wc -l` \'97 how much console debt is there?\
- Find crash reporting: `Sentry`, `Bugsnag`, `Crashlytics`. Where is it initialized?\
- Is there structured logging? PII rules? (search for handle/email/token in log calls)\
- **Output to capture:** logger module, crash tool, init location, PII rules (if any).\
\
### 1.9 Analytics & events\
- Find the analytics provider: `Segment`, `Amplitude`, `Mixpanel`, `GrowthBook`, `PostHog`, `Firebase Analytics`.\
- Is there an event registry / typed event names, or are events strings sprinkled in components?\
- Naming convention?\
- **Output to capture:** provider, registry location (or "none \'97 debt"), naming convention.\
\
### 1.10 Feature flags & experiments\
- Find the flag provider: `GrowthBook`, `LaunchDarkly`, `Statsig`, `ConfigCat`, or homegrown.\
- Are flags read via a hook or directly from a global?\
- Is there cleanup metadata (owner, expiry)?\
- **Output to capture:** flag system, access pattern, lifecycle policy.\
\
### 1.11 Internationalization\
- Find i18n: `Lingui`, `i18next`, `react-intl`, `expo-localization`.\
- How are strings authored \'97 inline, extracted, or centralized JSON?\
- **Output to capture:** library, string-authoring pattern.\
\
### 1.12 Accessibility\
- Search for: `accessibilityLabel`, `accessibilityRole`, `accessibilityHint`, `accessible=`.\
- Sample 5 primitive components and 5 screens. What's the coverage rate?\
- Is there an a11y testing setup (axe, jest-axe, manual checklist)?\
- **Output to capture:** a11y conventions on primitives, coverage estimate, testing approach (or "none \'97 debt").\
\
### 1.13 Native modules & platform code\
- List `*.ios.ts(x)` and `*.android.ts(x)` files. Common pattern?\
- Any custom native modules in `ios/` or `android/`? Any Expo config plugins?\
- **Output to capture:** platform-split convention, native modules in use.\
\
### 1.14 Third-party dependencies\
- Read `package.json` `dependencies` and `devDependencies` in full.\
- Categorize each: navigation, state, network, UI, storage, analytics, observability, i18n, native capability, dev tooling.\
- Within each category, the kept library is sanctioned; named alternatives in that category that are NOT in the deps list are rejected.\
- Flag any duplicates (two date libraries, two icon sets, two HTTP clients) \'97 this is debt.\
- **Output to capture:** the sanctioned-library table, duplicate flags.\
\
### 1.15 Testing\
- `jest.config.*`, `vitest.config.*`, `detox.config.*`, `maestro/`, `e2e/`.\
- Count test files vs source files (rough ratio).\
- **Output to capture:** test runners, e2e tool (if any), rough coverage signal.\
\
### 1.16 Build, release, env\
- `app.json` / `app.config.*` (Expo), `eas.json`, Fastlane, `metro.config.*`.\
- Env handling: `react-native-config`, `expo-constants`, `.env` files.\
- **Output to capture:** build tool, env strategy.\
\
## Step 2 \'97 Detect debt and red flags\
\
While exploring, log every instance of:\
\
- Two libraries solving the same problem (e.g. `axios` AND `fetch` both used for API calls).\
- Code that bypasses the sanctioned layer (e.g. a component reading from MMKV directly when there's a `src/storage` wrapper).\
- Files that violate the dependency direction inferred in \'a71.1.\
- TODOs, FIXMEs, and `@deprecated` comments that hint at known migrations.\
- Dead code: imports that resolve nowhere, components never used.\
\
These become \'a713 (Known Debt) in the output.\
\
## Step 3 \'97 Write `ARCHITECTURE.md`\
\
Produce the document with this structure. Each section uses the **3-block ADR shape** from `/system-overview` (Decision / Rejected alternatives / Rule). The discovery command's job is to populate the facts; the overview command's job is to render them.}