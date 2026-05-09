/**
 * T-0003-006b: Workspace boundary lint rule fires at runtime.
 *
 * Programmatic ESLint integration test that verifies the no-restricted-imports
 * rule in packages/a2ui-renderer/.eslintrc.cjs actually enforces forbidden
 * import patterns at lint time.
 *
 * Why a runtime test, not a file-read test?
 *   Roz NF-2: a file-read test only checks the config is present, not that
 *   ESLint actually enforces it. This test proves enforcement by running ESLint
 *   programmatically against fixture strings containing forbidden imports.
 *
 * Uses ESLint Linter (eslintrc-config mode) because:
 *   - ESLint v9 ships FlatESLint by default but Linter supports legacy configs.
 *   - Linter.verify() is synchronous and doesn't touch the filesystem.
 *   - no-restricted-imports is a built-in rule available in both config modes.
 *
 * Note on '#' patterns: minimatch (used by no-restricted-imports) treats '#'
 * as a special character. The .eslintrc.cjs escapes it as '\\#' in patterns.
 */
import path from 'path'
import {Linter} from 'eslint'

// -- Load the rule config from our .eslintrc.cjs file -------------------------

// Reading from the actual config file ensures the test and the config stay
// in sync. If the config is deleted, weakened, or scoped wrong, this test
// fails — verifying enforcement, not just file existence.
//
// We use Jest's built-in require (available via global.require in CJS context)
// to load the CJS config. This is intentional — .eslintrc.cjs is CommonJS by
// design, and loading it via require is the correct approach for a .cjs file.
// The @typescript-eslint/no-require-imports rule is disabled inline only here
// because there is no ES module equivalent for loading a .cjs config file at
// test runtime. Importing .cjs from ESM requires dynamic import + default
// export, which is brittle across CJS/ESM module boundaries.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const eslintrc = require(path.resolve(__dirname, '../../../.eslintrc.cjs')) as {
  rules: {[key: string]: unknown}
}

// Verify the rule exists before continuing.
const noRestrictedImportsConfig = eslintrc.rules['no-restricted-imports']
if (!noRestrictedImportsConfig) {
  throw new Error(
    'T-0003-006b: .eslintrc.cjs does not contain no-restricted-imports rule. ' +
      'Step 1 acceptance criteria require workspace boundary enforcement.',
  )
}

// -- Linter setup -------------------------------------------------------------

const linter = new Linter({configType: 'eslintrc'})

const LINT_CONFIG: Linter.LegacyConfig = {
  // Required: without sourceType:'module', Linter treats files as scripts
  // and 'import' is a reserved keyword (parse error).
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  rules: {
    'no-restricted-imports': noRestrictedImportsConfig as Linter.RuleEntry,
  },
}

// Helper: lint a code string and return all messages.
function lintCode(code: string): Linter.LintMessage[] {
  return linter.verify(code, LINT_CONFIG, {filename: 'virtual-file.ts'})
}

// Helper: assert at least one message with ruleId 'no-restricted-imports'.
function expectForbiddenImport(code: string): void {
  const messages = lintCode(code)
  const violations = messages.filter(m => m.ruleId === 'no-restricted-imports')
  expect(violations.length).toBeGreaterThanOrEqual(1)
}

// -- Tests --------------------------------------------------------------------

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

  // Structural check: the config file has all required patterns.
  // This is the "file-read" portion — it documents what patterns exist,
  // but the lint-execution tests above are the actual enforcement proof.
  it('.eslintrc.cjs has no-restricted-imports rule with all required boundary patterns', () => {
    const rule = eslintrc.rules['no-restricted-imports']
    expect(rule).toBeDefined()
    const config = Array.isArray(rule) ? rule[1] : rule
    const patterns = (config as {patterns: {group: string[]}[]}).patterns
    expect(patterns).toBeDefined()

    const groups = patterns.flatMap(p => p.group)
    // Note: '#' is escaped as '\\#' in minimatch glob patterns.
    expect(groups).toContain('apps/mobile/**')
    expect(groups.some(g => g.includes('#/theme') || g.includes('\\#/theme'))).toBe(true)
    expect(groups.some(g => g.includes('#/lib') || g.includes('\\#/lib'))).toBe(true)
    expect(groups.some(g => g.includes('#/state') || g.includes('\\#/state'))).toBe(true)
    expect(groups.some(g => g.includes('#/components') || g.includes('\\#/components'))).toBe(true)
    expect(groups.some(g => g.includes('#/screens') || g.includes('\\#/screens'))).toBe(true)
  })
})
