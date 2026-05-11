import tseslint from '@typescript-eslint/eslint-plugin'
import tsparser from '@typescript-eslint/parser'
import prettier from 'eslint-config-prettier'

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.expo/**',
      '**/ios/**',
      '**/android/**',
      '**/coverage/**',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {jsx: true},
      },
    },
    plugins: {'@typescript-eslint': tseslint},
    rules: {
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': [
        'error',
        {argsIgnorePattern: '^_', varsIgnorePattern: '^_'},
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['error', {allow: ['warn', 'error']}],
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', '**/eval/**/*.{ts,tsx}'],
    rules: {
      'no-console': 'off',
    },
  },
  // -------------------------------------------------------------------------
  // V0 renderer: useEffect ban (ADR-0006 §K) + workspace-boundary imports
  //
  // Previously in packages/a2ui-renderer/.eslintrc.cjs (legacy format), which
  // ESLint 9 flat config does not load. Migrated here as scoped blocks.
  //
  // §K exceptions carved out via separate ignore blocks below:
  //   1. src/v0/ai/       — AICapabilitiesProvider mount-time OS capability check
  //   2. src/v0/a11y/     — useReducedMotion OS preference query + subscription
  //   3. src/v0/state/useRendererState.ts — ref-update infrastructure, not app logic
  //   4. __demo__/, __test-utils__/, *.test.{ts,tsx} — test/demo code may use useEffect
  //   5. components/inputs/SearchBar.tsx — ADR-0009 §E: useEffect required for
  //      SearchFilterContext cleanup on unmount (same lifecycle justification as nav/).
  // -------------------------------------------------------------------------
  {
    files: ['packages/a2ui-renderer/src/v0/**/*.{ts,tsx}'],
    ignores: [
      'packages/a2ui-renderer/src/v0/ai/**',
      'packages/a2ui-renderer/src/v0/a11y/**',
      // nav/ — navigator components are infrastructure, not pure node renderers.
      // useEffect is needed for NavigationPrimitive cleanup on unmount (Step 10).
      'packages/a2ui-renderer/src/v0/nav/**',
      'packages/a2ui-renderer/src/v0/state/useRendererState.ts',
      // SearchBar — ADR-0009 §E: SearchFilterContext write + cleanup on unmount.
      // useEffect is the only correct way to clear the Map entry on unmount.
      'packages/a2ui-renderer/src/v0/components/inputs/SearchBar.tsx',
      'packages/a2ui-renderer/src/v0/__demo__/**',
      'packages/a2ui-renderer/src/v0/__test-utils__/**',
      'packages/a2ui-renderer/src/v0/**/*.test.ts',
      'packages/a2ui-renderer/src/v0/**/*.test.tsx',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        // Bare call: useEffect(...)
        {
          selector: "CallExpression[callee.name='useEffect']",
          message:
            'useEffect is banned in V0 renderer code per ADR-0006 §K. Use derived state ' +
            'from props or dispatch. If you need an async OS query or subscription, add it ' +
            'to src/v0/ai/ or src/v0/a11y/ with a documented justification.',
        },
        // Namespaced call: React.useEffect(...)
        {
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.property.name='useEffect']",
          message:
            'useEffect is banned in V0 renderer code per ADR-0006 §K. Use derived state ' +
            'from props or dispatch. If you need an async OS query or subscription, add it ' +
            'to src/v0/ai/ or src/v0/a11y/ with a documented justification.',
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
  },
  prettier,
]
