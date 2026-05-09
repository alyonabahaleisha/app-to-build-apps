/**
 * Step 1 canonicalization regression tests.
 * Tests: T-0005-025, T-0005-026, T-0005-027
 *
 * T-0005-026 verifies byte-identical output with the legacy a2ui-schema package
 * by comparing against the pre-computed hash of a 100-key fixture.
 * The expected hash was derived by running the same algorithm on Node 20
 * with the verbatim canonical.ts logic.
 */
import {canonicalize, renderHash} from './canonical.js'

describe('canonicalize', () => {
  // T-0005-025
  it('sorts keys at the top level', () => {
    expect(canonicalize({z: 1, a: 2})).toBe('{"a":2,"z":1}')
  })

  // T-0005-027
  it('sorts keys at every level of a nested object', () => {
    const input = {z: {b: 1, a: 2}, a: {z: 3, m: 4}}
    expect(canonicalize(input)).toBe('{"a":{"m":4,"z":3},"z":{"a":2,"b":1}}')
  })

  it('handles arrays by preserving element order', () => {
    expect(canonicalize([3, 1, 2])).toBe('[3,1,2]')
  })

  it('handles arrays of objects by sorting object keys', () => {
    expect(canonicalize([{z: 1, a: 2}, {b: 3, a: 4}])).toBe('[{"a":2,"z":1},{"a":4,"b":3}]')
  })

  it('handles primitives', () => {
    expect(canonicalize(42)).toBe('42')
    expect(canonicalize('hello')).toBe('"hello"')
    expect(canonicalize(true)).toBe('true')
    expect(canonicalize(null)).toBe('null')
  })
})

describe('renderHash', () => {
  // T-0005-026: byte-identical output to legacy a2ui-schema on a 100-key fixture.
  // Expected hash computed from the verbatim canonical.ts algorithm on Node 20.
  it('produces the same hash as the legacy a2ui-schema package on a 100-key fixture', () => {
    const fixture: Record<string, number> = {}
    for (let i = 0; i < 100; i++) {
      fixture[`key${String(i).padStart(3, '0')}`] = i
    }
    // This hash was computed using the identical 26-line canonical.ts from a2ui-schema.
    // If this test fails after a copy, the verbatim-copy invariant has been violated.
    expect(renderHash(fixture)).toBe(
      '299ce8ddb74ff60f06007b46e34e7b1f2853bb988b349f138c728266752acff6',
    )
  })

  it('produces a consistent hash for the same value across multiple calls', () => {
    const obj = {name: 'test', value: 42}
    expect(renderHash(obj)).toBe(renderHash(obj))
  })

  it('produces different hashes for objects that differ only in value', () => {
    expect(renderHash({a: 1})).not.toBe(renderHash({a: 2}))
  })

  it('produces the same hash regardless of key insertion order', () => {
    const a = {z: 1, a: 2}
    const b = {a: 2, z: 1}
    expect(renderHash(a)).toBe(renderHash(b))
  })
})
