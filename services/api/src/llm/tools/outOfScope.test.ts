/**
 * outOfScope.ts tests — ADR-0007 Step 1 (companion to produceAppSpec.test.ts)
 *
 * These tests verify the Zod schemas and the tool definition shape.
 * The Ajv-based input_schema tests live in produceAppSpec.test.ts (T-0007-008..014).
 * This file covers the Zod-side of the same contract.
 */

import {OutOfScopeCapabilitySchema, OutOfScopeInputSchema, outOfScopeTool} from './outOfScope.js'

describe('OutOfScopeCapabilitySchema', () => {
  it('accepts all 6 capability values', () => {
    const values = ['image_gen', 'vision', 'chat', 'transcription', 'classification', 'unknown']
    for (const v of values) {
      expect(() => OutOfScopeCapabilitySchema.parse(v)).not.toThrow()
    }
  })

  it('rejects unknown capability values', () => {
    expect(() => OutOfScopeCapabilitySchema.parse('unicorn')).toThrow()
    expect(() => OutOfScopeCapabilitySchema.parse('')).toThrow()
    expect(() => OutOfScopeCapabilitySchema.parse('ImageGen')).toThrow()
  })
})

describe('OutOfScopeInputSchema', () => {
  it('accepts valid input', () => {
    const result = OutOfScopeInputSchema.safeParse({capability: 'vision', reason: 'identifies plants'})
    expect(result.success).toBe(true)
  })

  it('accepts all capability enum values', () => {
    const caps = ['image_gen', 'vision', 'chat', 'transcription', 'classification', 'unknown']
    for (const cap of caps) {
      expect(OutOfScopeInputSchema.safeParse({capability: cap, reason: 'some reason'}).success).toBe(true)
    }
  })

  it('rejects reason longer than 200 chars', () => {
    const result = OutOfScopeInputSchema.safeParse({
      capability: 'vision',
      reason: 'x'.repeat(201),
    })
    expect(result.success).toBe(false)
    // Verify the error code is too_big (Zod code for max constraint)
    if (!result.success) {
      const codes = result.error.issues.map(i => i.code)
      expect(codes).toContain('too_big')
    }
  })

  it('accepts reason exactly 200 chars', () => {
    const result = OutOfScopeInputSchema.safeParse({
      capability: 'chat',
      reason: 'x'.repeat(200),
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty reason (minLength: 1)', () => {
    const result = OutOfScopeInputSchema.safeParse({capability: 'vision', reason: ''})
    expect(result.success).toBe(false)
  })

  it('rejects unknown capability', () => {
    const result = OutOfScopeInputSchema.safeParse({capability: 'unicorn', reason: 'x'})
    expect(result.success).toBe(false)
  })

  it('is strict — rejects additional properties', () => {
    const result = OutOfScopeInputSchema.safeParse({
      capability: 'vision',
      reason: 'x',
      extra: 'y',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing capability', () => {
    const result = OutOfScopeInputSchema.safeParse({reason: 'some reason'})
    expect(result.success).toBe(false)
  })

  it('rejects missing reason', () => {
    const result = OutOfScopeInputSchema.safeParse({capability: 'vision'})
    expect(result.success).toBe(false)
  })
})

describe('outOfScopeTool', () => {
  it("name is 'out_of_scope'", () => {
    expect(outOfScopeTool.name).toBe('out_of_scope')
  })

  it('description mentions capability and reason constraints', () => {
    expect(outOfScopeTool.description).toContain('200')
    expect(outOfScopeTool.description.length).toBeGreaterThan(10)
  })

  it('input_schema has additionalProperties: false', () => {
    expect((outOfScopeTool.input_schema as Record<string, unknown>).additionalProperties).toBe(false)
  })

  it('input_schema requires capability and reason', () => {
    const schema = outOfScopeTool.input_schema as Record<string, unknown>
    expect(schema.required).toEqual(expect.arrayContaining(['capability', 'reason']))
  })
})
