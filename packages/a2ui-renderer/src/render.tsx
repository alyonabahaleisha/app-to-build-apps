import * as React from 'react'
import {Text, View} from 'react-native'

import type {A2UINode, A2UISpec} from '@app-creator/a2ui-schema'

import type {Dispatch, RenderState} from './types'

type RenderProps = {
  spec: A2UISpec
  state: RenderState
  dispatch: Dispatch
}

export function render({spec, state, dispatch}: RenderProps): React.ReactElement {
  const view = spec.views.find(v => v.id === spec.initialViewId)
  if (!view) {
    return (
      <View>
        <Text>Invalid spec: initialViewId not found</Text>
      </View>
    )
  }
  return <NodeRenderer node={view.root} state={state} dispatch={dispatch} />
}

function NodeRenderer({
  node,
  state: _state,
  dispatch: _dispatch,
}: {
  node: A2UINode
  state: RenderState
  dispatch: Dispatch
}): React.ReactElement {
  // Skeleton: returns a placeholder tree. Real renderers land per component
  // ticket per ARCHITECTURE.md §6 five-step gate.
  switch (node.type) {
    case 'Heading':
      return <Text accessibilityRole="header">{node.text}</Text>
    case 'Text':
      return <Text>{node.text}</Text>
    default:
      return <Text>[Unimplemented: {node.type}]</Text>
  }
}
