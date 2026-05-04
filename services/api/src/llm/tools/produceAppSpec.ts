import {zodToJsonSchema} from 'zod-to-json-schema'
import {A2UISpecSchema} from '@app-creator/a2ui-schema'

/**
 * Anthropic tool definition for structured app spec generation.
 * input_schema is the full JSON Schema derived from A2UISpecSchema.
 * The model is forced to call this tool via tool_choice (generate.ts).
 */
export const produceAppSpecTool = {
  name: 'produce_app_spec' as const,
  description:
    'Produce a structured A2UI spec describing the requested app. ' +
    'Use the catalog components to build a clear, functional UI. ' +
    'Prefer simplicity and clarity over complexity. ' +
    'Every view must have a unique id. initialViewId must reference an existing view id.',
  input_schema: zodToJsonSchema(A2UISpecSchema, {target: 'jsonSchema7'}) as Record<string, unknown>,
}
