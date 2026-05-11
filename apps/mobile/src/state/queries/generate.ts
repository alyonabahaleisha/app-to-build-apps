/**
 * useGenerateMutation — SSE-driven /generate hook.
 *
 * ADR-0002 Step 8. Consumes the server's SSE stream:
 *   thinking_started → building_started → done | error
 * and exposes a `phase` discriminant that LoadingBubble and ChatScreen
 * subscribe to. No TanStack Query involved — this is a stateful mutation
 * driven by a ReadableStream, not a cached query.
 *
 * Critical contract (T-0002-131): `phase` transitions to 'thinking'
 * synchronously BEFORE the first `await fetch(...)`.
 *
 * Stall timer (T-0002-136/137): arm on every SSE event arrival; if 30s
 * elapse with no new event and the phase is still active, flip to 'stalled'.
 * Clear on transition to 'done' or 'error'.
 *
 * In-flight guard (T-0002-146): second `generate()` call while first is
 * active throws `{error: 'in_flight'}`.
 */
import {useCallback, useEffect, useRef, useState} from 'react'
import {useQueryClient} from '@tanstack/react-query'
import {createParser, type EventSourceMessage} from 'eventsource-parser'
// expo/fetch has streaming response-body support; React Native's global
// fetch does not (res.body is undefined). Required for SSE consumption.
import {fetch} from 'expo/fetch'

import {getCurrentSession, getApiUrl} from '#/lib/api'
import {logger} from '#/logger'
import {miniAppsKeys} from '#/state/queries/miniApps'

// -- Public types ------------------------------------------------------------

export type GeneratePhase = 'idle' | 'thinking' | 'building' | 'stalled' | 'done' | 'out_of_scope' | 'quota_exhausted' | 'error'

export interface GenerateResult {
  miniApp: {
    id: string
    title: string
    visibility: 'private'
    parent_project_id: string | null
    original_prompt: string
    created_at: string
  }
  spec: unknown
  render_hash: string
  thinking_duration_ms: number
  generation_duration_ms: number
}

export interface OutOfScopeResult {
  capability: 'image_gen' | 'vision' | 'chat' | 'transcription' | 'classification' | 'unknown'
  reason: string
  prompt_hash: string
}

export interface GenerateError {
  code:
    | 'invalid_input'
    | 'invalid_spec'
    | 'prompt_too_large'
    | 'rate_limited'
    | 'internal'
    | 'connection_lost'
  detail?: unknown
}

export interface QuotaExhaustedResult {
  resetAt: string // ISO 8601
}

export interface GenerateOutOfScopeEvent {
  type: 'out_of_scope'
  capability: OutOfScopeResult['capability']
  reason: string
  prompt_hash: string
}

export interface GenerateInput {
  prompt: string
  parentProjectId?: string
}

/**
 * Type guard: returns true if `phase` is one of the three active loading
 * phases that LoadingBubble can render.
 */
export function isActivePhase(phase: GeneratePhase): phase is 'thinking' | 'building' | 'stalled' {
  return phase === 'thinking' || phase === 'building' || phase === 'stalled'
}

/**
 * Type guard: returns true when the phase indicates an out-of-scope detection
 * (user should see "notify me" form).
 */
export function isOutOfScopePhase(phase: GeneratePhase): phase is 'out_of_scope' {
  return phase === 'out_of_scope'
}

export interface UseGenerateMutationResult {
  phase: GeneratePhase
  result: GenerateResult | null
  outOfScope: OutOfScopeResult | null
  quotaExhausted: QuotaExhaustedResult | null
  error: GenerateError | null
  generate: (input: GenerateInput) => Promise<void>
  reset: () => void
}

// -- Constants ---------------------------------------------------------------

const STALL_TIMEOUT_MS = 30_000

// -- Hook --------------------------------------------------------------------

export function useGenerateMutation(): UseGenerateMutationResult {
  const qc = useQueryClient()
  const [phase, setPhase] = useState<GeneratePhase>('idle')
  const [result, setResult] = useState<GenerateResult | null>(null)
  const [outOfScope, setOutOfScope] = useState<OutOfScopeResult | null>(null)
  const [quotaExhausted, setQuotaExhausted] = useState<QuotaExhaustedResult | null>(null)
  const [error, setError] = useState<GenerateError | null>(null)

  // Refs for cross-render state that doesn't drive UI directly.
  const abortRef = useRef<AbortController | null>(null)
  const stallRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlightRef = useRef(false)
  // Shadow of `phase` kept in a ref so the stall timeout callback can read
  // the latest phase value without capturing a stale closure.
  const phaseRef = useRef<GeneratePhase>('idle')

  const clearStall = useCallback(() => {
    if (stallRef.current !== null) {
      clearTimeout(stallRef.current)
      stallRef.current = null
    }
  }, [])

  const armStall = useCallback(() => {
    clearStall()
    stallRef.current = setTimeout(() => {
      // Only flip to 'stalled' if we're still actively generating.
      if (phaseRef.current === 'thinking' || phaseRef.current === 'building') {
        phaseRef.current = 'stalled'
        setPhase('stalled')
      }
    }, STALL_TIMEOUT_MS)
  }, [clearStall])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    clearStall()
    inFlightRef.current = false
    phaseRef.current = 'idle'
    setPhase('idle')
    setResult(null)
    setOutOfScope(null)
    setQuotaExhausted(null)
    setError(null)
  }, [clearStall])

  const generate = useCallback(
    async (input: GenerateInput): Promise<void> => {
      if (inFlightRef.current) {
        // T-0002-146: reject second call while first is in-flight.
        throw Object.assign(new Error('generate already in flight'), {error: 'in_flight'})
      }

      inFlightRef.current = true
      abortRef.current = new AbortController()

      // Synchronous phase transition BEFORE the first await — T-0002-131.
      phaseRef.current = 'thinking'
      setPhase('thinking')
      setResult(null)
      setOutOfScope(null)
      setError(null)
      armStall()

      try {
        const session = getCurrentSession()
        const baseUrl = getApiUrl()

        const res = await fetch(`${baseUrl}/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // T-0002-144: always attach auth header.
            ...(session ? {Authorization: `Bearer ${session.accessToken}`} : {}),
            Accept: 'text/event-stream',
          },
          body: JSON.stringify({
            prompt: input.prompt,
            ...(input.parentProjectId ? {parent_project_id: input.parentProjectId} : {}),
          }),
          signal: abortRef.current.signal,
        })

        if (!res.ok) {
          // 4xx/5xx response before SSE established — read JSON body.
          let code: GenerateError['code'] = 'internal'
          let bodyJson: {error?: string; reset_at?: string} = {}
          try {
            bodyJson = (await res.json()) as {error?: string; reset_at?: string}
          } catch {
            // Body wasn't JSON — stay with 'internal'.
          }
          // HTTP 429 with quota_exhausted is a special path — not a generic error.
          if (res.status === 429 && bodyJson.error === 'quota_exhausted') {
            clearStall()
            phaseRef.current = 'quota_exhausted'
            setPhase('quota_exhausted')
            setQuotaExhausted({resetAt: bodyJson.reset_at ?? new Date().toISOString()})
            return
          }
          const reported = bodyJson.error
          if (
            reported === 'invalid_input' ||
            reported === 'invalid_spec' ||
            reported === 'prompt_too_large' ||
            reported === 'rate_limited'
          ) {
            code = reported
          }
          clearStall()
          phaseRef.current = 'error'
          setPhase('error')
          setError({code})
          return
        }

        // Stream the SSE response body.
        const parser = createParser({
          onEvent: (event: EventSourceMessage) => {
            // Re-arm the stall timer on every event arrival — T-0002-137.
            armStall()

            if (event.data === '[DONE]') return

            let data: Record<string, unknown>
            try {
              data = JSON.parse(event.data) as Record<string, unknown>
            } catch {
              return
            }

            const type = data.type as string | undefined

            if (type === 'thinking_started') {
              phaseRef.current = 'thinking'
              setPhase('thinking')
            } else if (type === 'building_started') {
              phaseRef.current = 'building'
              setPhase('building')
            } else if (type === 'done') {
              clearStall()
              phaseRef.current = 'done'
              setPhase('done')
              setResult(data as unknown as GenerateResult)
              // A new project was just persisted server-side. Drop the Home
              // list cache so the next visit refetches; without this the
              // 5-min staleTime hides the new row until cache expires.
              void qc.invalidateQueries({queryKey: miniAppsKeys.list()})
            } else if (type === 'out_of_scope') {
              // Out-of-scope detection: surface to UI for "notify me" form.
              // No project was persisted on the server.
              clearStall()
              phaseRef.current = 'out_of_scope'
              setPhase('out_of_scope')
              setOutOfScope({
                capability: data['capability'] as OutOfScopeResult['capability'],
                reason: String(data['reason'] ?? ''),
                prompt_hash: String(data['prompt_hash'] ?? ''),
              })
            } else if (type === 'error') {
              clearStall()
              phaseRef.current = 'error'
              setPhase('error')
              setError({
                code: (data.code as GenerateError['code']) ?? 'internal',
                detail: data.detail,
              })
            }
          },
        })

        const reader = res.body!.getReader()
        const decoder = new TextDecoder()
        let readResult = await reader.read()
        while (!readResult.done) {
          parser.feed(decoder.decode(readResult.value, {stream: true}))
          readResult = await reader.read()
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // Navigation-away cancellation — don't surface as an error.
          return
        }
        logger.error('generate stream failed', {safeMessage: String(err)})
        clearStall()
        phaseRef.current = 'error'
        setPhase('error')
        setError({code: 'connection_lost'})
      } finally {
        inFlightRef.current = false
        clearStall()
      }
    },
    [armStall, clearStall],
  )

  // Cleanup on unmount: clear the stall timer and abort any in-flight SSE
  // stream. Without this, a 30s stall timer armed at screen entry can fire
  // after GeneratingScreen has navigated away, and Jest reports a worker
  // forced-exit warning due to active timers (F3/F10 in Roz QA).
  useEffect(() => {
    return () => {
      clearStall()
      abortRef.current?.abort()
    }
  }, [clearStall])

  return {phase, result, outOfScope, quotaExhausted, error, generate, reset}
}
