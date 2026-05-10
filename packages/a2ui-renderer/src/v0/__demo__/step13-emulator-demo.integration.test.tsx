/**
 * Step 13 — Emulator demo integration test (ADR-0006 §Step 13).
 *
 * T-0006-238: Each of the 4 demo specs renders without crash.
 * T-0006-239: Demo specs map — all 4 archetypes present, cycle between them.
 * T-0006-241: src/legacy/ does not exist; package.json has no legacy entries.
 *
 * T-0006-237 (iOS Simulator boot) is a manual acceptance criterion — the
 * iOS Simulator cannot be automated from Jest. Roz validates it via
 * `pnpm --filter @app-creator/mobile ios` on the dev machine.
 *
 * These tests use the full <Renderer> (not just NodeRenderer) so that the
 * SpecSchema.parse() validation path introduced in Step 13 is also exercised.
 */
import React from 'react'
import {render} from '@testing-library/react-native'
import {SpecSchema} from '@app-creator/protocol'
import {
  DEMO_SPEC_LIST_CRUD,
  DEMO_SPEC_TRACKER,
  DEMO_SPEC_JOURNAL,
  DEMO_SPEC_CALCULATOR,
  DEMO_SPECS,
} from '@app-creator/protocol/test/fixtures.demo'
import {Renderer} from '../Renderer'
import type {HostCallbacks} from '../state/hostCallbacks'
import * as fs from 'fs'
import * as path from 'path'

// ---------------------------------------------------------------------------
// Shared host callbacks — all no-op for demo rendering
// ---------------------------------------------------------------------------

const HOST: HostCallbacks = {
  onToast: jest.fn(),
  onAIError: jest.fn(),
  onNavigationError: jest.fn(),
  onUnknownNodeType: jest.fn(),
}

// ---------------------------------------------------------------------------
// T-0006-238: Each demo spec validates against SpecSchema
// ---------------------------------------------------------------------------

describe('T-0006-238: Demo specs are valid V0 specs', () => {
  it.each([
    ['ListCRUD', DEMO_SPEC_LIST_CRUD],
    ['Tracker', DEMO_SPEC_TRACKER],
    ['Journal', DEMO_SPEC_JOURNAL],
    ['Calculator', DEMO_SPEC_CALCULATOR],
  ])('%s archetype spec validates against SpecSchema', (_archetype, spec) => {
    const result = SpecSchema.safeParse(spec)
    if (!result.success) {
      throw new Error(
        `SpecSchema.parse failed for ${_archetype}:\n${JSON.stringify(result.error.issues, null, 2)}`,
      )
    }
    expect(result.success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// T-0006-238: Each demo spec renders without crash via <Renderer>
// ---------------------------------------------------------------------------

// Suppress React's console.error for expected error boundary warnings in tests.
let consoleSpy: jest.SpyInstance

describe('T-0006-238: Demo specs render without crash', () => {
  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.clearAllMocks()
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  it.each([
    ['ListCRUD', DEMO_SPEC_LIST_CRUD],
    ['Tracker', DEMO_SPEC_TRACKER],
    ['Journal', DEMO_SPEC_JOURNAL],
    ['Calculator', DEMO_SPEC_CALCULATOR],
  ])('%s archetype spec renders via <Renderer> without throwing', (_archetype, spec) => {
    // This will throw synchronously if SpecSchema.parse fails or if a component
    // throws during render. The test fails if render() throws.
    expect(() => {
      render(<Renderer spec={spec} host={HOST} />)
    }).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// T-0006-239: DEMO_SPECS map contains all 4 archetypes
// ---------------------------------------------------------------------------

describe('T-0006-239: DEMO_SPECS map — all 4 archetypes present', () => {
  it('DEMO_SPECS contains exactly 4 archetypes', () => {
    expect(Object.keys(DEMO_SPECS).sort()).toEqual(
      ['Calculator', 'Journal', 'ListCRUD', 'Tracker'],
    )
  })

  it('DEMO_SPECS values are all valid V0 specs', () => {
    for (const [archetype, spec] of Object.entries(DEMO_SPECS)) {
      const result = SpecSchema.safeParse(spec)
      expect(result.success).toBe(true)
      if (!result.success) {
        throw new Error(
          `DEMO_SPECS[${archetype}] failed SpecSchema:\n${JSON.stringify(result.error.issues, null, 2)}`,
        )
      }
    }
  })

  it('cycling through DEMO_SPECS renders each spec without crash', () => {
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    for (const [, spec] of Object.entries(DEMO_SPECS)) {
      expect(() => {
        render(<Renderer spec={spec} host={HOST} />)
      }).not.toThrow()
    }
    consoleSpy.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// T-0006-241: src/legacy/ does not exist; package.json has no legacy entries
// ---------------------------------------------------------------------------

describe('T-0006-241: Legacy directory and exports are deleted', () => {
  it('src/legacy/ directory does not exist', () => {
    const legacyDir = path.resolve(__dirname, '../../../../src/legacy')
    expect(fs.existsSync(legacyDir)).toBe(false)
  })

  it('package.json exports do not include a ./legacy entry', () => {
    const pkgPath = path.resolve(__dirname, '../../../../../package.json')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require(pkgPath) as {exports?: Record<string, unknown>}
    const exports = pkg.exports ?? {}
    expect(Object.keys(exports)).not.toContain('./legacy')
  })
})
