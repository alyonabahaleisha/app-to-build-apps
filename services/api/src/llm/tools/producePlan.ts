import {zodToJsonSchema} from 'zod-to-json-schema'
import {PlanSchema} from '@app-creator/a2ui-schema'

/**
 * Anthropic tool definition for structured plan generation.
 * input_schema is the full JSON Schema derived from PlanSchema.
 * The planner is forced to call this tool via tool_choice (planner.ts).
 *
 * The model should choose the most fitting archetype from the closed enum
 * and emit screens with stable lowercase string ids that the builder will
 * use verbatim as view ids.
 */
export const producePlanTool = {
  name: 'produce_plan' as const,
  description:
    'Produce a structured plan for the requested app. ' +
    'Choose the most fitting archetype from the closed enum. ' +
    'Emit screens with stable, lowercase string ids — the builder uses them verbatim as view ids. ' +
    'Each screen id must be unique within the plan. ' +
    'Use navigation "none" only when the app has exactly one screen.',
  input_schema: zodToJsonSchema(PlanSchema, {target: 'jsonSchema7'}) as Record<string, unknown>,
}
