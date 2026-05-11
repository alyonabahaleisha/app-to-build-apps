/**
 * AppShellThemeProvider — ADR-0011 Step 5.
 *
 * Resolves the host chrome's fixed theme: productive stance + focus palette.
 * Per ADR-0011 §Decision 12: the app shell always uses this combination so
 * the host chrome (TabBar, headers, Settings sheet) stays visually constant
 * regardless of which mini-app the user has open in Run mode.
 *
 * Exposes `useAppShellTheme()` returning the same `ResolvedTheme` shape that
 * the renderer's `useTheme()` returns — one API, no surprise.
 *
 * T-0011-097: returns theme('productive', 'focus')
 * T-0011-098: tokens are frozen (Object.freeze, per design-system contract)
 * T-0011-099: same reference across re-renders (useMemo)
 * T-0011-100: theme/index.ts is deleted; this is the only theme hook
 * T-0011-141d: calling hook outside provider throws with a clear message
 */
import {createContext, useContext, useMemo, type ReactNode} from 'react'

import {theme, type ResolvedTheme} from '@app-creator/design-system'

// The fixed host-chrome stance + palette per ADR-0011 §Decision 12.
const SHELL_STANCE = 'productive' as const
const SHELL_PALETTE = 'focus' as const

const AppShellThemeContext = createContext<ResolvedTheme | null>(null)

/**
 * AppShellThemeProvider — wrap the app root (App.tsx) with this provider.
 * The resolved theme is memoized; it never changes because stance + palette
 * are constants, so the memo dependency array is empty.
 */
export function AppShellThemeProvider({children}: {children: ReactNode}) {
  // Empty deps: SHELL_STANCE and SHELL_PALETTE are module-level constants — never change.
  const resolvedTheme = useMemo(() => theme(SHELL_STANCE, SHELL_PALETTE), [])

  return (
    <AppShellThemeContext.Provider value={resolvedTheme}>
      {children}
    </AppShellThemeContext.Provider>
  )
}

/**
 * useAppShellTheme() — returns the resolved productive/focus theme for the
 * app shell. Must be called within <AppShellThemeProvider>.
 *
 * T-0011-141d: throws a descriptive error when called outside the provider
 * so missing-provider regressions surface immediately at dev time.
 */
export function useAppShellTheme(): ResolvedTheme {
  const ctx = useContext(AppShellThemeContext)
  if (ctx === null) {
    throw new Error('useAppShellTheme must be used within AppShellThemeProvider')
  }
  return ctx
}
