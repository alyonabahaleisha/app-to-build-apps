import {zodToJsonSchema} from 'zod-to-json-schema'
import {JsonPatchSchema} from '@app-creator/a2ui-schema'

/**
 * Anthropic tool definition for RFC 6902 patch generation.
 *
 * The model is forced to call this tool via tool_choice during edit flows
 * (runPipelineEdit). It must emit only patch ops whose `path` (and `from`
 * for move/copy ops) are equal to or strict descendants of the paths declared
 * in `edit_intent.target_paths` from the plan. The patchValidation module
 * enforces this constraint programmatically after the model responds.
 */
export const produceAppSpecPatchTool = {
  name: 'produce_app_spec_patch' as const,
  description:
    'Produce an RFC 6902 JSON Patch to apply to the current A2UI spec. ' +
    'Only emit patch ops that touch paths within edit_intent.target_paths from the plan. ' +
    'Every op path and from (for move/copy) MUST be equal to or a descendant of at least one target path. ' +
    'Do not modify any node outside the declared edit intent. ' +
    'Prefer the minimal set of ops needed to satisfy the user edit prompt.',
  input_schema: zodToJsonSchema(JsonPatchSchema, {target: 'jsonSchema7'}) as Record<string, unknown>,
}
