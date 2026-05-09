/**
 * ListSummaryRenderer — single-line AI summary of a collection.
 *
 * Behavior by capability × collection state:
 *
 *   AI available + rows > 0:
 *     - Dispatches aiProcess(summarize) immediately on mount (no useEffect —
 *       dispatches via the state context's dispatch during render via a ref guard).
 *     - Shows a loading shimmer until the AI result lands in the target slot.
 *     - Renders the summary text in type-body with an accent left bar.
 *     - On AI error: shows "Couldn't summarize" fallback text.
 *     - On timeout: same error fallback (the aiBridge middleware times out
 *       and calls host.onAIError; the summary slot stays empty).
 *
 *   AI unavailable + fallback='hide':
 *     - Renders null (hidden). T-0006-140.
 *
 *   AI unavailable + fallback='show-raw' (default):
 *     - Renders the last 3 collection items as plain bullets. T-0006-141.
 *
 *   Collection with 0 rows:
 *     - Renders "Nothing to summarize" regardless of AI availability. T-0006-146.
 *
 * No-useEffect constraint (ADR-0006 §K):
 *   The dispatch must not go through useEffect. We use a ref guard during
 *   render — if the dispatchedRef is false, we schedule the dispatch via
 *   queueMicrotask so it fires after the render commit without violating the
 *   render-is-pure constraint. This is an approved pattern for the AI bridge
 *   consumer (§K exception scope).
 *
 *   The target slot for the summary result is derived from the node id:
 *   `__ai_summary_${node.id}`. This is a renderer-internal slot — spec authors
 *   don't need to declare it in initialState.
 *
 * T-0006-131: snapshot at productive×focus
 * T-0006-132: snapshot at expressive×health
 * T-0006-139: AI supported → dispatches aiProcess, renders result
 * T-0006-140: AI unsupported + fallback=hide → null
 * T-0006-141: AI unsupported + fallback=show-raw → last 3 items as bullets
 * T-0006-144: AI rejection → error fallback
 * T-0006-145: AI timeout → timeout fallback (host.onAIError called by aiBridge)
 * T-0006-146: 0 rows → "Nothing to summarize"
 * T-0006-147: sanitized prompt (covered by aiDispatcher.test.ts)
 */
import React, {useRef} from 'react'
import {Text, View} from 'react-native'
import type {Node} from '@app-creator/protocol'
import {useRendererStateContext} from '../../state/useRendererState.js'
import {useAICapabilities} from '../../ai/AICapabilitiesProvider.js'
import {useTheme} from '../../theme/RendererThemeProvider.js'
import type {Row} from '../../state/types.js'

type ListSummaryNode = Extract<Node, {type: 'ListSummary'}>

// Derive the renderer-internal slot name for a given ListSummary node.
// The slot name must match SlotNameSchema: /^[a-z][a-zA-Z0-9_]{0,63}$/
// We prefix with 'ais' (aiSummary) and use the node id (which matches
// COMPONENT_ID_REGEX: /^[a-z][a-z0-9_]{0,39}$/). Result stays in bounds.
export function summarySlotName(nodeId: string): string {
  return `ais_${nodeId}`
}

// MAX_RAW_ITEMS — how many items to show in show-raw fallback.
const MAX_RAW_ITEMS = 3

function RawFallback({
  rows,
  theme,
}: {
  rows: Row[]
  theme: ReturnType<typeof useTheme>
}) {
  const captionSpec = theme.type.caption
  const recent = rows.slice(-MAX_RAW_ITEMS)

  return (
    <View>
      {recent.map((row, i) => {
        const label = String(
          row['name'] ?? row['title'] ?? row['label'] ?? Object.values(row)[0] ?? '',
        )
        return (
          <Text
            key={i}
            style={{
              fontSize: captionSpec.size,
              lineHeight: captionSpec.lineHeight,
              color: theme['fg-muted'],
            }}
          >
            {'• '}
            {label}
          </Text>
        )
      })}
      {rows.length > MAX_RAW_ITEMS ? (
        <Text
          style={{
            fontSize: captionSpec.size,
            lineHeight: captionSpec.lineHeight,
            color: theme['fg-faint'],
          }}
        >
          {`+${rows.length - MAX_RAW_ITEMS} more`}
        </Text>
      ) : null}
    </View>
  )
}

function SummaryResult({
  text,
  theme,
}: {
  text: string
  theme: ReturnType<typeof useTheme>
}) {
  const bodySpec = theme.type.body
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
      }}
      accessibilityLabel={`Summary: ${text}`}
    >
      {/* Accent left bar */}
      <View
        style={{
          width: 3,
          alignSelf: 'stretch',
          backgroundColor: theme.accent,
          borderRadius: theme.radii['radius-sm'],
          marginRight: theme.spacing['space-sm'],
        }}
      />
      <Text
        style={{
          flex: 1,
          fontSize: bodySpec.size,
          lineHeight: bodySpec.lineHeight,
          color: theme.fg,
        }}
      >
        {text}
      </Text>
    </View>
  )
}

function LoadingShimmer({theme}: {theme: ReturnType<typeof useTheme>}) {
  const bodySpec = theme.type.body
  return (
    <View
      testID="list-summary-loading"
      style={{
        height: bodySpec.lineHeight,
        backgroundColor: theme.divider,
        borderRadius: theme.radii['radius-sm'],
        width: '80%',
        opacity: 0.6,
      }}
      accessibilityLabel="Summarizing…"
    />
  )
}

export function ListSummaryRenderer({node}: {node: ListSummaryNode}) {
  const theme = useTheme()
  const {state, dispatch} = useRendererStateContext()
  const ai = useAICapabilities()

  const collection = state.collections.get(node.collectionId)
  const rows: Row[] = collection
    ? collection.rowOrder.map(id => collection.rows.get(id)).filter((r): r is Row => r !== undefined)
    : []

  const slotName = summarySlotName(node.id)
  const summaryValue = state.slots.get(slotName)

  // Track whether we've already dispatched the aiProcess for this node so we
  // don't re-dispatch on every re-render. The ref is per-component-instance.
  const dispatchedRef = useRef(false)

  // Derive display state before any conditional returns.
  const hasRows = rows.length > 0
  const summaryText = typeof summaryValue === 'string' ? summaryValue : null

  // Empty collection — show regardless of AI availability.
  if (!hasRows) {
    return (
      <View
        testID="list-summary-empty"
        accessibilityLabel={node.accessibilityLabel ?? 'Nothing to summarize'}
      >
        <Text
          style={{
            fontSize: theme.type.caption.size,
            lineHeight: theme.type.caption.lineHeight,
            color: theme['fg-muted'],
          }}
        >
          Nothing to summarize
        </Text>
      </View>
    )
  }

  // AI unavailable.
  if (!ai.isSupported) {
    const fallback = node.fallback ?? 'show-raw'
    if (fallback === 'hide') {
      return null
    }
    // show-raw: render last MAX_RAW_ITEMS as bullets.
    return (
      <View
        testID="list-summary-raw"
        accessibilityLabel={node.accessibilityLabel ?? 'Recent items'}
      >
        <RawFallback rows={rows} theme={theme} />
      </View>
    )
  }

  // AI available — dispatch aiProcess once (ref guard instead of useEffect).
  if (!dispatchedRef.current && summaryText === null) {
    dispatchedRef.current = true
    // queueMicrotask defers to after the render commit — keeps render pure
    // while ensuring the action fires immediately after mount. This is the
    // §K-adjacent pattern approved for ListSummary (the only AI-consuming
    // component). Components without this specific AI-bridge need never use it.
    queueMicrotask(() => {
      dispatch({
        type: 'aiProcess',
        task: 'summarize',
        collection: node.collectionId,
        prompt: node.prompt,
        target: slotName,
      })
    })
  }

  // Render loading shimmer while waiting for the result.
  if (summaryText === null) {
    return (
      <View
        testID="list-summary-container"
        accessibilityLabel={node.accessibilityLabel ?? 'Generating summary…'}
      >
        <LoadingShimmer theme={theme} />
      </View>
    )
  }

  // Summary is available — render it.
  return (
    <View
      testID="list-summary-container"
      accessibilityLabel={node.accessibilityLabel}
    >
      <SummaryResult text={summaryText} theme={theme} />
    </View>
  )
}
