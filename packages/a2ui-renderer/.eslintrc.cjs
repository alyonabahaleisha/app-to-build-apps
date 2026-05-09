/**
 * Workspace-boundary lint rules for packages/a2ui-renderer.
 *
 * The renderer package MUST NOT import from apps/mobile/ or from the
 * mobile app's path aliases (#/...). Any such import would violate the
 * two-layer rule in ARCHITECTURE.md §6 and would make the renderer
 * non-portable (ADR-0003 §C, §D, §K).
 *
 * These patterns are enforced by no-restricted-imports. T-0003-006b
 * verifies the rule fires at runtime via ESLint's programmatic API.
 *
 * Note on pattern escaping: '#' must be escaped as '\\#' in minimatch
 * glob patterns (used by the `patterns` form of no-restricted-imports)
 * because '#' is a special character in shell/glob contexts.
 *
 * If you find yourself wanting to import one of these, the answer is:
 * add a Context to the renderer package and inject from the host app.
 * See RendererThemeProvider and RendererLoggerProvider as the pattern.
 *
 * useEffect ban (ADR-0006 §K):
 * useEffect is banned across the renderer. The renderer must be a pure
 * function of {spec, state, dispatch}. Two exceptions are carved out via
 * overrides below:
 *   1. src/v0/ai/ — AICapabilitiesProvider's mount-time OS capability
 *      check is an async query that cannot be driven by props/dispatch.
 *   2. src/v0/a11y/ — useReducedMotion queries the OS accessibility
 *      preference and subscribes to changes — same justification.
 * useRendererState (src/v0/state/) also uses useEffect for ref-update
 * infrastructure (updating mutable refs after each render) — this is
 * allowed per the "infra, not app logic" carve-out noted in Step 2.
 */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  rules: {
    /**
     * useEffect ban — applies to all files not covered by overrides below.
     * Selector matches any call to useEffect from any import source.
     */
    'no-restricted-syntax': [
      'error',
      {
        selector: "CallExpression[callee.name='useEffect']",
        message:
          'useEffect is banned in the V0 renderer (ADR-0006 §K). Derive state from ' +
          'props or dispatch. If you need an async OS query or subscription, add it to ' +
          'src/v0/ai/ or src/v0/a11y/ with a documented justification.',
      },
    ],
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['apps/mobile/**'],
            message:
              'Workspace boundary violation: renderer cannot import from apps/mobile/. ' +
              'Add a Context to the renderer and inject from the host app.',
          },
          {
            group: ['\\#/theme', '\\#/theme/**'],
            message:
              'Workspace boundary violation: renderer cannot import the mobile theme alias. ' +
              'Use RendererThemeProvider context instead.',
          },
          {
            group: ['\\#/lib/*', '\\#/lib/**'],
            message:
              'Workspace boundary violation: renderer cannot import mobile lib utilities. ' +
              'Add a Context to the renderer if a capability is needed.',
          },
          {
            group: ['\\#/state/*', '\\#/state/**'],
            message:
              'Workspace boundary violation: renderer cannot import mobile state modules.',
          },
          {
            group: ['\\#/components/*', '\\#/components/**'],
            message:
              'Workspace boundary violation: renderer cannot import mobile shell components. ' +
              'The renderer has its own component catalog in src/components/.',
          },
          {
            group: ['\\#/screens/*', '\\#/screens/**'],
            message:
              'Workspace boundary violation: renderer cannot import mobile screen components.',
          },
        ],
      },
    ],
  },
  overrides: [
    {
      // §K exception 1: AI capability check — async OS query, mount-time only.
      // §K exception 2 (widened at Step 3): useReducedMotion — async OS query + subscription.
      // §K exception 3: useRendererState ref-update pattern — infra, not app logic.
      files: ['src/v0/ai/**', 'src/v0/a11y/**', 'src/v0/state/useRendererState.ts'],
      rules: {
        'no-restricted-syntax': 'off',
      },
    },
  ],
}
