/**
 * ToastProvider — single toast at a time, replace-on-new (don't stack).
 * Per Sable's UX doc §Action feedback + Notes for Colby #5/#7.
 *
 * Auto-dismiss after 3s. Tap to dismiss. Slide-down + fade animation,
 * collapses to opacity-only when reduced-motion is on (per ARCHITECTURE.md
 * §12 + UX doc §Animation).
 *
 * Mounts once at the app root (above Navigation) so a single instance
 * floats above whatever screen is showing — that's the portal pattern
 * Cal called out in CLAUDE.md / ARCHITECTURE.md §7.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import {Toast, type ToastVariant} from './Toast'

interface ShowOptions {
  variant?: ToastVariant
  /** Custom dismiss timeout in ms — defaults to 3000. */
  durationMs?: number
}

interface ToastContextValue {
  show: (message: string, opts?: ShowOptions) => void
  hide: () => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

interface CurrentToast {
  id: number
  message: string
  variant: ToastVariant
  durationMs: number
}

const DEFAULT_DURATION_MS = 3_000

interface ProviderProps {
  children: ReactNode
}

export function ToastProvider({children}: ProviderProps) {
  const [current, setCurrent] = useState<CurrentToast | null>(null)
  const idRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const hide = useCallback(() => {
    clearTimer()
    setCurrent(null)
  }, [clearTimer])

  const show = useCallback(
    (message: string, opts?: ShowOptions) => {
      // Replace, don't queue. Per Sable's "Notes for Colby" #5.
      clearTimer()
      idRef.current += 1
      const next: CurrentToast = {
        id: idRef.current,
        message,
        variant: opts?.variant ?? 'default',
        durationMs: opts?.durationMs ?? DEFAULT_DURATION_MS,
      }
      setCurrent(next)
    },
    [clearTimer],
  )

  useEffect(() => {
    if (current === null) return
    const id = current.id
    timerRef.current = setTimeout(() => {
      setCurrent(c => (c?.id === id ? null : c))
    }, current.durationMs)
    return clearTimer
  }, [current, clearTimer])

  // Cleanup on unmount.
  useEffect(() => {
    return () => clearTimer()
  }, [clearTimer])

  const value = useMemo<ToastContextValue>(() => ({show, hide}), [show, hide])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {current ? (
        <Toast
          key={current.id}
          message={current.message}
          variant={current.variant}
          onDismiss={hide}
        />
      ) : null}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext)
  if (value === null) {
    throw new Error('useToast() must be used within <ToastProvider>')
  }
  return value
}
