/**
 * SearchBarRenderer — search input with clear button.
 *
 * When `boundCollectionId` is set, writes the query to SearchFilterContext
 * so List/GridList renderers for that collection can filter in real time.
 * The query is also stored via valueBinding (state slot) for persistence.
 *
 * Collection binding behavior (per ADR-0009 §E):
 * - SearchBar writes its query (lowercased) to the Map on every change.
 * - On unmount, clears its Map entry to avoid stale filters.
 * - List renderers call `useSearchFilter(collectionId)` and filter rows
 *   by case-insensitive substring match across all string fields.
 *
 * voiceMic (V0.5 placeholder):
 * - Shows mic icon when query is empty.
 * - Tap opens "Voice search coming soon" — rendered as a simple alert/toast.
 *
 * Visual: 36pt tall, bg-elevated, radius-md, divider border.
 *   Leading: search icon placeholder (text '🔍' — icon system in Step 8).
 *   Trailing: clear button when value non-empty; mic when voiceMic+empty.
 *
 * Accessibility:
 *   - accessibilityRole="search"
 *   - accessibilityLabel: node.placeholder ?? 'Search'
 *   - Clear button: accessibilityLabel="Clear search"
 *   - Mic: accessibilityLabel="Voice search — coming soon"
 *
 * V1 Phase 1 Step 2 — ADR-0009 §E
 * T-0009-051..058, T-0009-059 (snapshot), T-0009-065, T-0009-066
 */
import React, {useEffect} from 'react'
import {View, Text, TextInput, Pressable} from 'react-native'
import type {Node} from '@app-creator/protocol'
import {useTheme} from '../../theme/RendererThemeProvider.js'
import {useBinding} from '../../state/useBinding.js'
import {useRendererStateContext} from '../../state/useRendererState.js'
import {useHost} from '../../host/HostContext.js'
import {useSearchFilterControls} from '../../state/SearchFilterContext.js'

type SearchBarNode = Extract<Node, {type: 'SearchBar'}>

export function SearchBarRenderer({node}: {node: SearchBarNode}) {
  const theme = useTheme()
  const {dispatch} = useRendererStateContext()
  const host = useHost()
  const filterControls = useSearchFilterControls()

  const boundValue = useBinding<string>(node.valueBinding)
  const query = typeof boundValue === 'string' ? boundValue : ''

  // Write to SearchFilterContext whenever the query changes.
  // ADR-0009 §E: filter is render-time only.
  useEffect(() => {
    if (node.boundCollectionId) {
      filterControls.setFilter(node.boundCollectionId, query)
    }
    // Cleanup: called on each query change (before the next effect run) and on
    // unmount. The clear-then-set within a single render cycle is intentional —
    // List consumers re-read the Map synchronously after the set.
    return () => {
      if (node.boundCollectionId) {
        filterControls.clearFilter(node.boundCollectionId)
      }
    }
  }, [query, node.boundCollectionId])

  function handleChangeText(text: string) {
    if (node.valueBinding.kind === 'state') {
      dispatch({type: 'set', target: node.valueBinding.slot, value: text})
    }
  }

  function handleClear() {
    if (node.valueBinding.kind === 'state') {
      dispatch({type: 'set', target: node.valueBinding.slot, value: ''})
    }
  }

  function handleVoiceMic() {
    host.onToast?.('Voice search is coming soon', undefined)
  }

  const bodySpec = theme.type.body
  const placeholder = node.placeholder ?? 'Search'
  const isEmpty = query.length === 0

  return (
    <View
      style={{
        height: 36,
        backgroundColor: theme['bg-elevated'],
        borderRadius: theme.radii['radius-md'],
        borderWidth: 1,
        borderColor: theme.divider,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.spacing['space-sm'],
      }}
      accessibilityRole="search"
      accessibilityLabel={placeholder}
      testID={`searchbar-container-${node.id}`}
    >
      {/* Leading: search icon */}
      <Text
        style={{
          fontSize: 14,
          color: theme['fg-muted'],
          marginRight: theme.spacing['space-xs'],
        }}
        accessibilityElementsHidden
      >
        {'🔍'}
      </Text>

      {/* Text input */}
      <TextInput
        value={query}
        onChangeText={handleChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme['fg-faint']}
        style={{
          flex: 1,
          fontSize: bodySpec.size,
          lineHeight: bodySpec.lineHeight,
          color: theme.fg,
          padding: 0,
        }}
        returnKeyType="search"
        clearButtonMode="never" // We render our own clear button.
        testID={`searchbar-input-${node.id}`}
      />

      {/* Trailing: clear button when non-empty */}
      {!isEmpty && (
        <Pressable
          onPress={handleClear}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          testID={`searchbar-clear-${node.id}`}
        >
          <Text style={{fontSize: 14, color: theme['fg-muted'], marginLeft: 4}}>{'✕'}</Text>
        </Pressable>
      )}

      {/* Trailing: mic when voiceMic=true AND empty */}
      {node.voiceMic && isEmpty && (
        <Pressable
          onPress={handleVoiceMic}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Voice search — coming soon"
          testID={`searchbar-mic-${node.id}`}
        >
          <Text style={{fontSize: 14, color: theme['fg-muted'], marginLeft: 4}}>{'🎤'}</Text>
        </Pressable>
      )}
    </View>
  )
}
