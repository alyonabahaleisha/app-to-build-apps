import {z} from 'zod'

/**
 * outOfScope.ts — Tool definition + Zod schemas for the out_of_scope LLM tool.
 *
 * Two exports:
 *  1. Zod schemas (OutOfScopeCapabilitySchema, OutOfScopeInputSchema) — the
 *     source of truth used for JSON Schema generation AND for defense-in-depth
 *     re-validation at SSE emission time (T-0007-181, per RZ3-01 fix).
 *  2. outOfScopeTool — the Anthropic tool definition object.
 *
 * The input_schema is hand-written (not zodToJsonSchema) because the schema is
 * simple and we want additionalProperties: false explicitly in the JSON Schema
 * to catch extra keys from the model (T-0007-014).
 */

export const OutOfScopeCapabilitySchema = z.enum([
  'image_gen',
  'vision',
  'chat',
  'transcription',
  'classification',
  'unknown',
])
export type OutOfScopeCapability = z.infer<typeof OutOfScopeCapabilitySchema>

/**
 * Zod source-of-truth for the JSON Schema below.
 * Also used at SSE emission time for defense-in-depth re-validation.
 * A 201-char reason or schema-mismatch bug that bypasses Anthropic's
 * input_schema enforcement is caught here before any user-visible emission.
 */
export const OutOfScopeInputSchema = z
  .object({
    capability: OutOfScopeCapabilitySchema,
    reason: z.string().min(1).max(200),
  })
  .strict()
export type OutOfScopeInput = z.infer<typeof OutOfScopeInputSchema>

export const outOfScopeTool = {
  name: 'out_of_scope' as const,
  description:
    'Call this instead of produce_app_spec when the user prompt requires ' +
    'a capability not in the V0 catalog: image generation, vision (photo analysis), ' +
    'chat (conversational), voice transcription, or AI classification. ' +
    'Provide the matching capability tag and a brief reason (≤200 chars).',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['capability', 'reason'],
    properties: {
      capability: {
        type: 'string',
        enum: ['image_gen', 'vision', 'chat', 'transcription', 'classification', 'unknown'],
      },
      reason: {type: 'string', minLength: 1, maxLength: 200},
    },
  } as const,
}
