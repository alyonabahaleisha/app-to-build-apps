/**
 * T-0004-018
 * Snapshot test: producePlanTool.input_schema round-trips via JSON.stringify+parse
 * identically, and matches zodToJsonSchema(PlanSchema).
 */

import {zodToJsonSchema} from 'zod-to-json-schema'
import {PlanSchema} from '@app-creator/a2ui-schema'
import {producePlanTool} from './producePlan.js'

describe('producePlanTool', () => {
  // T-0004-018
  it('input_schema round-trips via JSON.stringify+parse and matches snapshot', () => {
    const expected = zodToJsonSchema(PlanSchema, {target: 'jsonSchema7'})
    // Round-trip check: JSON.parse(JSON.stringify(...)) deep-equals the original.
    const roundTripped = JSON.parse(JSON.stringify(producePlanTool.input_schema))
    expect(roundTripped).toEqual(expected)
    expect(producePlanTool.input_schema).toMatchSnapshot()
  })

  it('has the correct name and a non-empty description', () => {
    expect(producePlanTool.name).toBe('produce_plan')
    expect(producePlanTool.description.length).toBeGreaterThan(10)
  })
})
