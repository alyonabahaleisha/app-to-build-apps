/**
 * T-0002-027
 * Snapshot test: produceAppSpecTool.input_schema matches zodToJsonSchema(A2UISpecSchema).
 */

import {zodToJsonSchema} from 'zod-to-json-schema'
import {A2UISpecSchema} from '@app-creator/a2ui-schema'
import {produceAppSpecTool} from './produceAppSpec.js'

describe('produceAppSpecTool', () => {
  // T-0002-027
  it('input_schema snapshot matches zodToJsonSchema(A2UISpecSchema)', () => {
    const expected = zodToJsonSchema(A2UISpecSchema, {target: 'jsonSchema7'})
    expect(produceAppSpecTool.input_schema).toEqual(expected)
    expect(produceAppSpecTool.input_schema).toMatchSnapshot()
  })

  it('has the correct name and a non-empty description', () => {
    expect(produceAppSpecTool.name).toBe('produce_app_spec')
    expect(produceAppSpecTool.description.length).toBeGreaterThan(10)
  })
})
