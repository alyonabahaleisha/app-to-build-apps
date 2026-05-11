# QA Report — ADR-0013 PRs 3+4 (Steps 3+4 — Env-flag flip + Magic-link deprecation warn)

_Reviewed by Roz — 2026-05-10_

## Verdict: REVISE (2 BLOCKING findings)

Implementation mostly right. Deprecation warn correctly placed before Zod parse. ESLint rule correctly scoped. eas.json flip clean. `@deprecated` JSDoc on route + provider module. T-0013-139a/b specific enough.

Two items block merge: env.example gap + missing Expo plugin entry (the latter is a device-breaking gap).

| Check | Status |
|---|---|
| Type Check (API) | PASS |
| Type Check (Mobile) | PASS (errors in `Run/copy.ts` from concurrent RunScreen work) |
| Tests (API auth) | BLOCKED — Docker daemon not available; 14 non-DB pass, 56 testcontainer-dependent |
| Tests (Mobile) | PASS — 30/30 (`getAuthProvider.test.ts` + `SignInScreen.test.tsx`) |
| Complexity | PASS |
| Security | PASS (with notes) |
| Docs Impact | **FAIL** — `services/api/.env.example` gap |

## BLOCKING — F1: `services/api/.env.example` missing 4 APPLE_SIWA_* entries

ADR-0013 Step 3 explicitly names this file in "Files to modify": "services/api/.env.example — add the four `APPLE_SIWA_*` env vars with placeholder values + comments explaining each." Never done across any of the 4 PRs to date.

**Fix:** Add to `.env.example`:
```
# Apple Sign In with Apple credentials (required for /auth/apple route in production)
# Source: Apple Developer portal → Identifiers → App IDs → SIWA capability
APPLE_SIWA_CLIENT_ID=com.appcreator.mvp
APPLE_SIWA_TEAM_ID=ABCDE12345
APPLE_SIWA_KEY_ID=ABCDE12345
APPLE_SIWA_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
```

New engineers onboarding hit silent boot errors otherwise.

## BLOCKING — F2: `app.config.ts` plugins array missing `expo-apple-authentication`

Carry-forward from PR 2. `apps/mobile/app.config.ts:23` current: `plugins: ['expo-secure-store']`.

Package correctly in `package.json: "expo-apple-authentication": "~6.4.2"` but Expo plugin entry absent. **Without it, iOS dev-client native module is not surfaced → SIWA call silently fails on device.**

ADR-0013 Step 2 + Step 3 AC item 3 both name this requirement: "confirm expo-apple-authentication is in the plugins array (added in Step 2; verified in Step 3 acceptance criteria)."

**Fix:** Update `app.config.ts:23`:
```ts
plugins: ['expo-secure-store', 'expo-apple-authentication'],
```

This is a real device-breaking bug — production EAS builds would ship without the native bridge, causing SIWA flow to fail at runtime with no useful error.

## Scrutiny Area Checklist

1. **eas.json production-only flip** — PASS (production: `apple`; dev/preview untouched → code default `magic-link`)
2. **ESLint rule rigor** — PASS (correct AST selector for dot-notation; `getAuthProvider.ts` ignored; bracket-notation acceptable since it's only legitimate use)
3. **Deprecation warn ordering** — PASS (warn at line 223-226; safeParse at 228; correct R2 P1-5 closure)
4. **Telemetry whitelist** — N/A (warn is `req.log.warn`, not analytics writeEvent; correct separation per ADR-0013 Step 5)
5. **T-0011-155/156 regression** — PASS (both still pass; code default unchanged)
6. **Magic-link still functional** — PASS (route unchanged except pre-parse warn tap)
7. **ESLint rule coverage** — PASS (grep confirms only `getAuthProvider.ts` reads the env var)

## Non-blocking Observations

- **ESLint rule bracket-notation** — dot-notation only. Acceptable: `getAuthProvider.ts` is the only permitted bracket-notation consumer.
- **T-0013-139a/b test pattern** — sound. Pino sink captures warn at level 40 with `event` + `provider` field checks. Will pass when Docker available in CI.
- **Pre-existing lint in `apps/mobile/src/lib/telemetry.ts:24`** — unused `event` param. Not this PR's file (concurrent RunScreen work). Flag for that PR to fix on landing.

## CI/CD Verification Required: Yes

- T-0013-139a/b + all `auth.test.ts` tests require Docker. CI is authoritative.
- After F2 fix, an EAS dev-client build is the only way to verify SIWA on iOS (Apple Developer setup required separately).

## Documentation Update Required: Yes

`services/api/.env.example` needs 4 APPLE_SIWA_* entries per F1.

## Roz's Assessment

Steps 3+4 mostly right. The deprecation warn ordering is correct. The ESLint rule is correctly scoped. eas.json flip is clean. `@deprecated` annotations on route + provider module.

Two items block merge:
- F1: `.env.example` missing 4 APPLE_SIWA_* entries — explicit Step 3 file-list omission across 4 PRs
- F2: `app.config.ts` plugins missing `expo-apple-authentication` — production EAS builds ship without native bridge, SIWA dies at runtime

Both surgical. Fix → rerun CI for Docker-gated tests → approvable.

**REVISE.**
