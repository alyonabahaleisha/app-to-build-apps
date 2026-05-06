/**
 * ADR-0004 Step 7 — produceAppSpecPatch tool snapshot + sanity tests.
 *
 * Mirrors the pattern of produceAppSpec.test.ts.
 */
import {zodToJsonSchema} from 'zod-to-json-schema'
import {JsonPatchSchema} from '@app-creator/a2ui-schema'
import {produceAppSpecPatchTool} from './produceAppSpecPatch.js'

describe('produceAppSpecPatchTool', () => {
  it('input_schema snapshot matches zodToJsonSchema(JsonPatchSchema)', () => {
    const expected = zodToJsonSchema(JsonPatchSchema, {target: 'jsonSchema7'})
    expect(produceAppSpecPatchTool.input_schema).toEqual(expected)
    expect(produceAppSpecPatchTool.input_schema).toMatchSnapshot()
  })

  it('has the correct name', () => {
    expect(produceAppSpecPatchTool.name).toBe('produce_app_spec_patch')
  })

  it('has a non-empty description mentioning target_paths', () => {
    expect(produceAppSpecPatchTool.description.length).toBeGreaterThan(10)
    expect(produceAppSpecPatchTool.description).toContain('target_paths')
  })
})
