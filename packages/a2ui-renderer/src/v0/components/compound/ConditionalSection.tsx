/**
 * ConditionalSectionRenderer — renders children only if the collection
 * predicate matches.
 *
 * `showWhen: 'whenEmpty'` — renders children when the named collection has
 * zero rows (typical use: show an onboarding prompt before any data exists).
 *
 * `showWhen: 'whenNotEmpty'` — renders children when the collection has one
 * or more rows (typical use: show a summary or action only once data exists).
 *
 * Unknown collectionId: treats the collection as empty (no crash; warning
 * logged in __DEV__). This matches the List component's graceful-degradation
 * pattern.
 *
 * Accessibility: no additional ARIA beyond what children provide. The
 * container View uses accessibilityLabel from the node if provided.
 *
 * T-0006-129: snapshot at productive×focus
 * T-0006-130: snapshot at expressive×health
 * T-0006-137: showWhen='whenEmpty' hides children when collection has rows
 * T-0006-138: showWhen='whenNotEmpty' shows children when collection has rows
 */
import React from 'react'
import {View} from 'react-native'
import type {Node} from '@app-creator/protocol'
import {useRendererStateContext} from '../../state/useRendererState.js'
import {NodeRenderer} from '../NodeRenderer.js'

type ConditionalSectionNode = Extract<Node, {type: 'ConditionalSection'}>

export function ConditionalSectionRenderer({
  node,
}: {
  node: ConditionalSectionNode
}) {
  const {state} = useRendererStateContext()
  const collection = state.collections.get(node.collectionId)

  // Unknown collectionId → treat as empty (warn in dev).
  if (collection === undefined) {
    if (__DEV__) {
      console.warn(
        `[a2ui-renderer] ConditionalSection: collectionId "${node.collectionId}" not found. ` +
          `Treating as empty.`,
      )
    }
  }

  const rowCount = collection?.rowOrder.length ?? 0
  const isEmpty = rowCount === 0

  const shouldShow =
    node.showWhen === 'whenEmpty' ? isEmpty : !isEmpty

  if (!shouldShow) {
    return null
  }

  return (
    <View accessibilityLabel={node.accessibilityLabel}>
      {(node.children as Node[]).map(child => (
        <NodeRenderer key={child.id} node={child} />
      ))}
    </View>
  )
}
