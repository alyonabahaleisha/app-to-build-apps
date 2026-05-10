import {zodToJsonSchema} from 'zod-to-json-schema'
import {SpecSchema} from '@app-creator/protocol'

/**
 * Anthropic tool definition for structured V0 app spec generation.
 *
 * input_schema is the full JSON Schema derived from SpecSchema (protocol package).
 * The model picks from this tool or out_of_scope under tool_choice: 'auto'.
 *
 * Description limits (T-0007-007): ≤500 chars.
 */
export const produceAppSpecTool = {
  name: 'produce_app_spec' as const,
  description:
    'Produce a structured V0 app spec describing the requested tool. ' +
    'Use the 28-component catalog and 12 action verbs. Choose archetype, ' +
    'stance, and palette appropriate to the prompt. Every collection must ' +
    'include realistic seedData (3–5 rows; no lorem ipsum). Every screen ' +
    'and component node must have a unique lowercase id. initialScreenId ' +
    'must reference an existing screen.id.',
  input_schema: zodToJsonSchema(SpecSchema, {target: 'jsonSchema7'}) as Record<string, unknown>,
}
