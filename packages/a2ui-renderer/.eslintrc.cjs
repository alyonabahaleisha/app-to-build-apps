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
 */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  rules: {
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
}
