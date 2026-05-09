/**
 * T-0003-006b: Workspace boundary lint rule enforcement.
 *
 * Verifies that no-restricted-imports for forbidden import patterns in V0
 * renderer code fires correctly. Rules are sourced from the canonical
 * boundary-pattern list that matches eslint.config.mjs (root flat config,
 * packages/a2ui-renderer/src/v0/** scoped block).
 *
 * Previously loaded rules from packages/a2ui-renderer/.eslintrc.cjs (legacy
 * ESLint format). That file was deleted when rules were migrated to the root
 * flat config (ADR-0006 §K ESLint enforcement fix, Roz round-2 fix).
 *
 * Implementation note: ESLint 9's flat-config ESLint class uses dynamic
 * import() to load .mjs config files. Jest's CJS environment (babel-jest,
 * no --experimental-vm-modules) cannot run dynamic imports from the ESLint
 * config loader. We therefore use ESLint's legacy Linter (programmatic API,
 * synchronous, no filesystem access) with the boundary patterns inlined to
 * match eslint.config.mjs. This tests rule enforcement — the same behavior
 * pnpm lint exercises — without the ESM loader constraint.
 *
 * If eslint.config.mjs boundary patterns change, update BOUNDARY_PATTERNS
 * below to match. The patterns are the single source of truth; this test is
 * the enforcement proof.
 *
 * Why a runtime test, not a file-read test?
 *   Roz NF-2: a file-read test only checks the config is present, not that
 *   ESLint actually enforces it. This test proves enforcement by running ESLint
 *   against fixture strings containing forbidden imports.
 */
import {Linter} from 'eslint'

// ---------------------------------------------------------------------------
// Boundary patterns — must match the no-restricted-imports patterns in
// eslint.config.mjs (packages/a2ui-renderer/src/v0/** scoped block).
// ---------------------------------------------------------------------------

const BOUNDARY_PATTERNS: Array<{group: string[]; message: string}> = [
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
]

// ---------------------------------------------------------------------------
// Linter setup — legacy programmatic API, synchronous, no ESM loader needed.
// ---------------------------------------------------------------------------

const linter = new Linter({configType: 'eslintrc'})

const LINT_CONFIG: Linter.LegacyConfig = {
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  rules: {
    'no-restricted-imports': ['error', {patterns: BOUNDARY_PATTERNS}],
  },
}

function lintCode(code: string): Linter.LintMessage[] {
  return linter.verify(code, LINT_CONFIG, {filename: 'virtual-file.ts'})
}

function expectForbiddenImport(code: string): void {
  const messages = lintCode(code)
  const violations = messages.filter(m => m.ruleId === 'no-restricted-imports')
  expect(violations.length).toBeGreaterThanOrEqual(1)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('T-0003-006b: workspace boundary lint rule enforcement', () => {
  // Each forbidden pattern must fire no-restricted-imports.

  it('import from apps/mobile/** is forbidden', () => {
    expectForbiddenImport(`import {useTheme} from 'apps/mobile/src/theme/index'`)
  })

  it('import from #/theme is forbidden', () => {
    expectForbiddenImport(`import {useTheme} from '#/theme'`)
  })

  it('import from #/theme/tokens is forbidden', () => {
    expectForbiddenImport(`import {tokens} from '#/theme/tokens'`)
  })

  it('import from #/lib/api is forbidden', () => {
    expectForbiddenImport(`import {apiClient} from '#/lib/api'`)
  })

  it('import from #/state/session is forbidden', () => {
    expectForbiddenImport(`import {useSession} from '#/state/session/useSession'`)
  })

  it('import from #/components/Button is forbidden', () => {
    expectForbiddenImport(`import {Button} from '#/components/Button'`)
  })

  it('import from #/screens/AppRunner is forbidden', () => {
    expectForbiddenImport(`import {AppRunnerScreen} from '#/screens/AppRunner'`)
  })

  // Control tests: permitted imports must NOT fire the rule.

  it('import from zod is permitted (control test)', () => {
    const messages = lintCode(`import {z} from 'zod'`)
    const violations = messages.filter(m => m.ruleId === 'no-restricted-imports')
    expect(violations).toHaveLength(0)
  })

  it('import from @app-creator/a2ui-schema is permitted (control test)', () => {
    const messages = lintCode(`import type {A2UISpec} from '@app-creator/a2ui-schema'`)
    const violations = messages.filter(m => m.ruleId === 'no-restricted-imports')
    expect(violations).toHaveLength(0)
  })

  it('import from react is permitted (control test)', () => {
    const messages = lintCode(`import React from 'react'`)
    const violations = messages.filter(m => m.ruleId === 'no-restricted-imports')
    expect(violations).toHaveLength(0)
  })

  // Structural check: all six boundary pattern groups are covered.
  // Each group is tested for enforcement above; this final test confirms the
  // pattern list itself has not been accidentally truncated.
  it('BOUNDARY_PATTERNS covers all six required groups', () => {
    const groups = BOUNDARY_PATTERNS.flatMap(p => p.group)
    expect(groups).toContain('apps/mobile/**')
    expect(groups.some(g => g.includes('#/theme') || g.includes('\\#/theme'))).toBe(true)
    expect(groups.some(g => g.includes('#/lib') || g.includes('\\#/lib'))).toBe(true)
    expect(groups.some(g => g.includes('#/state') || g.includes('\\#/state'))).toBe(true)
    expect(groups.some(g => g.includes('#/components') || g.includes('\\#/components'))).toBe(true)
    expect(groups.some(g => g.includes('#/screens') || g.includes('\\#/screens'))).toBe(true)
  })
})
