/**
 * FormRenderer — A2UI Form component.
 *
 * Visual layout per Sable §A2UI Catalog Visual Treatment (line 406):
 *   Vertical stack with `md` gap between fields.
 *   Optional submit button at bottom: full-width, primary variant.
 *
 * Form is a layout + submit primitive only. It does NOT inject its own
 * formId-keyed state. Fields' `id`s drive state directly via the existing
 * dispatcher. M1 ignores formId (reserved for Phase 2 form-level events —
 * the schema requires it, we accept it and do nothing with it).
 *
 * Submit button visibility rules (§H of ADR-0003):
 *   submitLabel defined + submitAction defined  → button shown
 *   submitLabel undefined                        → button HIDDEN (regardless
 *                                                  of submitAction)
 *   submitLabel defined + submitAction undefined → button HIDDEN
 * T-0003-103b locks the second rule; T-0003-102 locks the third.
 *
 * Submit button implementation:
 *   Re-uses ButtonRenderer directly (DRY — single source of truth for Button
 *   visuals). A synthetic Button node {type:'Button', label:submitLabel,
 *   action:submitAction, variant:'primary'} is passed to ButtonRenderer.
 *   Full-width is achieved via alignSelf:'stretch' on the outer wrapper View.
 *
 * Non-field nodes in fields (T-0003-103c):
 *   Schema allows `fields: A2UINode[]` without constraining to field-type nodes.
 *   A Heading in `fields` renders inline as a regular row child via NodeRenderer.
 *   This is the permissive M1 interpretation; M2 may tighten the schema to only
 *   allow interactive field types inside Form.fields.
 *
 * Dispatch:
 *   Submit press → dispatch(submitAction) via ButtonRenderer's onPress.
 *   Field dispatches flow through NodeRenderer → each field's own dispatch handler.
 */
import React from 'react'
import {View} from 'react-native'

import type {A2UIAction, A2UINode} from '@app-creator/a2ui-schema'

import {NodeRenderer} from '../render'
import {useRendererTheme} from '../theme/RendererThemeProvider'
import type {Dispatch, RenderState} from '../types'
import {ButtonRenderer} from './Button'

// -- Node type (mirrored from the schema A2UINode union) ----------------------

export type A2UIFormNode = {
  id?: string
  type: 'Form'
  /**
   * formId is required by the schema. Reserved for Phase 2 form-level events.
   * M1 accepts it but does not read it (T-0003-105).
   */
  formId: string
  fields: A2UINode[]
  submitLabel?: string
  submitAction?: A2UIAction
}

export interface FormNodeProps {
  node: A2UIFormNode
  state: RenderState
  dispatch: Dispatch
}

// -- Component ----------------------------------------------------------------

export function FormRenderer({node, state, dispatch}: FormNodeProps): React.ReactElement {
  const theme = useRendererTheme()

  // Submit button is shown only when BOTH submitLabel and submitAction are
  // defined. submitLabel controls visibility (§H, T-0003-103b).
  const showSubmit = node.submitLabel !== undefined && node.submitAction !== undefined

  return (
    <View style={{gap: theme.spacing.md}}>
      {/* Render each field via NodeRenderer. Non-field nodes (e.g., Heading)
          are rendered inline without throwing — permissive M1 interpretation
          (T-0003-103c). M2 may tighten. */}
      {node.fields.map((field, i) => (
        <NodeRenderer key={i} node={field} state={state} dispatch={dispatch} />
      ))}

      {/* Submit button — full-width via alignSelf:'stretch' on the wrapper.
          Re-uses ButtonRenderer (DRY). Visible only when both submitLabel and
          submitAction are defined (§H). */}
      {showSubmit && (
        <View style={{alignSelf: 'stretch'}}>
          <ButtonRenderer
            node={{
              type: 'Button',
              label: node.submitLabel as string,
              action: node.submitAction as A2UIAction,
              variant: 'primary',
            }}
            state={state}
            dispatch={dispatch}
          />
        </View>
      )}
    </View>
  )
}
