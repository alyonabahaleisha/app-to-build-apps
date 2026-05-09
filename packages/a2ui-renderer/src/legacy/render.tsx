import * as React from 'react'
import {Text, View} from 'react-native'

import type {A2UINode, A2UISpec} from '@app-creator/a2ui-schema'

import {ButtonRenderer} from './components/Button'
import {ContainerRenderer} from './components/Container'
import {CounterRenderer} from './components/Counter'
import {FormRenderer} from './components/Form'
import {HeadingRenderer} from './components/Heading'
import {ImageRenderer} from './components/Image'
import {ListRenderer} from './components/List'
import {TextRenderer} from './components/Text'
import {TextInputRenderer} from './components/TextInput'
import {ToggleRenderer} from './components/Toggle'
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

/**
 * NodeRenderer — discriminated switch over all A2UI catalog node types.
 *
 * Exported so component implementations (Container, List, …) can recurse
 * into children without importing from their sibling files. This is the
 * single dispatch point for the entire catalog.
 *
 * The final `default` branch is intentional defense-in-depth (per ADR §F +
 * T-0003-038b): even though all 10 catalog types will be implemented by
 * Step 7, the fallback exists to handle any runtime-injected unknown type
 * that bypasses Zod validation. Do NOT remove this branch.
 */
export function NodeRenderer({
  node,
  state,
  dispatch,
}: {
  node: A2UINode
  state: RenderState
  dispatch: Dispatch
}): React.ReactElement {
  switch (node.type) {
    case 'Heading':
      return <HeadingRenderer node={node} state={state} dispatch={dispatch} />
    case 'Text':
      return <TextRenderer node={node} state={state} dispatch={dispatch} />
    case 'Image':
      return <ImageRenderer node={node} state={state} dispatch={dispatch} />
    case 'Container':
      return <ContainerRenderer node={node} state={state} dispatch={dispatch} />
    case 'Button':
      return <ButtonRenderer node={node} state={state} dispatch={dispatch} />
    case 'Counter':
      return <CounterRenderer node={node} state={state} dispatch={dispatch} />
    case 'List':
      return <ListRenderer node={node} state={state} dispatch={dispatch} />
    case 'TextInput':
      return <TextInputRenderer node={node} state={state} dispatch={dispatch} />
    case 'Toggle':
      return <ToggleRenderer node={node} state={state} dispatch={dispatch} />
    case 'Form':
      return <FormRenderer node={node} state={state} dispatch={dispatch} />
    default:
      // Defense-in-depth: any type not in the above switch (e.g., future
      // schema additions or runtime-injected unknown types that bypass Zod)
      // renders a visible placeholder instead of throwing.
      return <Text>[Unimplemented: {(node as {type: string}).type}]</Text>
  }
}
