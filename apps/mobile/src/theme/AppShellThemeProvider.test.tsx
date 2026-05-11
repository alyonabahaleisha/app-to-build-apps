/**
 * AppShellThemeProvider tests — ADR-0011 Step 5.
 *
 * T-IDs covered:
 *   T-0011-097 — useAppShellTheme() returns theme('productive', 'focus') resolved theme
 *   T-0011-098 — tokens are frozen (mutation attempts throw in strict mode)
 *   T-0011-099 — useAppShellTheme() returns same object reference across re-renders (memoized)
 *   T-0011-100 — apps/mobile/src/theme/index.ts is deleted (filesystem check)
 *   T-0011-101 — all files that imported useTheme from #/theme now import useAppShellTheme
 *   T-0011-141d — calling hook outside provider throws with a specific message
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import {execSync} from 'node:child_process'

import {renderHook, act} from '@testing-library/react-native'
import React from 'react'

import {theme as designSystemTheme} from '@app-creator/design-system'
import {AppShellThemeProvider, useAppShellTheme} from './AppShellThemeProvider'

// -- Helpers -----------------------------------------------------------------

function makeWrapper() {
  return function Wrapper({children}: {children: React.ReactNode}) {
    return React.createElement(AppShellThemeProvider, {children})
  }
}

// ============================================================================
// T-0011-097: returns theme('productive', 'focus')
// ============================================================================
describe('T-0011-097: useAppShellTheme — returns productive/focus theme', () => {
  it('resolved theme matches theme("productive", "focus") from design-system', () => {
    const expected = designSystemTheme('productive', 'focus')
    const {result} = renderHook(() => useAppShellTheme(), {wrapper: makeWrapper()})

    // Key spot checks — same values as design-system resolves
    expect(result.current.bg).toBe(expected.bg)
    expect(result.current.accent).toBe(expected.accent)
    expect(result.current['accent-fg']).toBe(expected['accent-fg'])
    expect(result.current.fg).toBe(expected.fg)
    expect(result.current.divider).toBe(expected.divider)
  })
})

// ============================================================================
// T-0011-098: tokens are frozen
// ============================================================================
describe('T-0011-098: useAppShellTheme — tokens are frozen', () => {
  it('the returned theme object is frozen (Object.isFrozen)', () => {
    const {result} = renderHook(() => useAppShellTheme(), {wrapper: makeWrapper()})
    expect(Object.isFrozen(result.current)).toBe(true)
  })

  it('attempting to mutate a token throws in strict mode', () => {
    const {result} = renderHook(() => useAppShellTheme(), {wrapper: makeWrapper()})
    // In strict mode, assignment to a frozen property throws TypeError.
    expect(() => {
      'use strict'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(result.current as any).bg = '#000000'
    }).toThrow(TypeError)
  })
})

// ============================================================================
// T-0011-099: same object reference across re-renders
// ============================================================================
describe('T-0011-099: useAppShellTheme — memoized reference', () => {
  it('returns the same object reference on re-renders', () => {
    const {result, rerender} = renderHook(() => useAppShellTheme(), {wrapper: makeWrapper()})
    const first = result.current
    act(() => rerender({}))
    expect(result.current).toBe(first)
  })
})

// ============================================================================
// T-0011-100: theme/index.ts is deleted
// ============================================================================
describe('T-0011-100: theme/index.ts deleted', () => {
  it('apps/mobile/src/theme/index.ts does not exist', () => {
    const filePath = path.resolve(__dirname, 'index.ts')
    expect(fs.existsSync(filePath)).toBe(false)
  })
})

// ============================================================================
// T-0011-101: no files import useTheme from #/theme
// ============================================================================
describe('T-0011-101: no import of useTheme from #/theme', () => {
  it('grep finds zero src files importing useTheme from #/theme (not #/theme/AppShellThemeProvider)', () => {
    const srcDir = path.resolve(__dirname, '../../../')
    // Match `from '#/theme'` (exact) — NOT `from '#/theme/AppShellThemeProvider'`
    let output = ''
    try {
      output = execSync(
        `grep -r "from '#/theme'" "${srcDir}" --include="*.ts" --include="*.tsx" -l 2>/dev/null`,
        {encoding: 'utf-8'},
      ).trim()
    } catch {
      output = ''
    }
    // Allow only the AppShellThemeProvider.tsx file itself if it imports from '#/theme' (it doesn't — it imports from @app-creator/design-system)
    // Any other file importing from '#/theme' (the deleted index.ts) is a regression.
    const lines = output.split('\n').filter(Boolean)
    // Filter out this test file itself (which may reference the path in a string literal)
    const violations = lines.filter(
      l => !l.includes('AppShellThemeProvider.test.tsx'),
    )
    expect(violations).toHaveLength(0)
  })
})

// ============================================================================
// T-0011-141d: hook outside provider throws
// ============================================================================
describe('T-0011-141d: useAppShellTheme outside provider throws', () => {
  it('throws with "useAppShellTheme must be used within AppShellThemeProvider"', () => {
    // Suppress the React error boundary console output in the test run.
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useAppShellTheme())).toThrow(
      'useAppShellTheme must be used within AppShellThemeProvider',
    )
    consoleError.mockRestore()
  })
})
