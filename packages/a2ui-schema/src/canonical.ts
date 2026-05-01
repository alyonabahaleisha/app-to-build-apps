import {createHash} from 'node:crypto'

/**
 * Canonical JSON serialization: stable key order, no whitespace.
 * Two specs that produce the same canonical bytes must render identically.
 */
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortKeys(value))
}

export function renderHash(value: unknown): string {
  return createHash('sha256').update(canonicalize(value)).digest('hex')
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value !== null && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortKeys((value as Record<string, unknown>)[key])
        return acc
      }, {})
  }
  return value
}
