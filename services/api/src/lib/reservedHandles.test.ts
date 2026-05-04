/**
 * Unit tests for reservedHandles — ADR-0002 Step 2.
 *
 * T-0002-018: RESERVED_HANDLES membership.
 * T-0002-019: isReservedHandle is case-insensitive.
 * T-0002-020: empty string is not reserved.
 *
 * No testcontainers needed — pure module.
 */
import {RESERVED_HANDLES, isReservedHandle} from './reservedHandles.js'

describe('reservedHandles', () => {
  // -------------------------------------------------------------------------
  // T-0002-018 — Happy: RESERVED_HANDLES contains all 7 expected entries
  // -------------------------------------------------------------------------
  it('T-0002-018: RESERVED_HANDLES includes admin, system, official, support, app, creator, example', () => {
    const required = ['admin', 'system', 'official', 'support', 'app', 'creator', 'example']
    for (const handle of required) {
      expect(RESERVED_HANDLES).toContain(handle)
    }
    // The list should have at least 7 entries — no silent shrinkage.
    expect(RESERVED_HANDLES.length).toBeGreaterThanOrEqual(7)
  })

  // -------------------------------------------------------------------------
  // T-0002-019 — Boundary: case-insensitive matching
  // -------------------------------------------------------------------------
  it('T-0002-019: isReservedHandle("admin") is true; isReservedHandle("Admin") is true; isReservedHandle("admin1") is false', () => {
    expect(isReservedHandle('admin')).toBe(true)
    expect(isReservedHandle('Admin')).toBe(true)
    expect(isReservedHandle('ADMIN')).toBe(true)
    expect(isReservedHandle('admin1')).toBe(false)
  })

  // -------------------------------------------------------------------------
  // T-0002-020 — Negative: empty string is not reserved
  // -------------------------------------------------------------------------
  it('T-0002-020: isReservedHandle("") returns false (empty is invalid, not reserved)', () => {
    expect(isReservedHandle('')).toBe(false)
  })

  // Additional coverage — every reserved entry matches when uppercased
  it('every reserved handle matches when passed in upper-case', () => {
    for (const handle of RESERVED_HANDLES) {
      expect(isReservedHandle(handle.toUpperCase())).toBe(true)
    }
  })

  // Handles outside the reserved list are not reserved
  it('handles not in the reserved list return false', () => {
    expect(isReservedHandle('alice')).toBe(false)
    expect(isReservedHandle('maker42')).toBe(false)
    expect(isReservedHandle('jane-doe')).toBe(false)
  })
})
