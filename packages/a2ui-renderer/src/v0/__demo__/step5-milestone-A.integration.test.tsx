/**
 * Step 5 Integration test — Milestone A
 * T-0006-086: Sample spec with Layout + Typography + Display only renders
 * the expected React tree on jest-expo without throwing; visual snapshot
 * at productive×focus matches a hand-curated golden.
 *
 * This is the "Milestone A receipt":
 *   1. SpecSchema.parse(SAMPLE_SPEC) succeeds — the spec is structurally valid.
 *   2. <NodeRenderer node={spec.screens[0].root}> wrapped in providers renders
 *      without throwing and produces a non-null React tree.
 *   3. The tree matches a snapshot (golden visual proof for Roz's review).
 *
 * No dispatcher, no state mutations — Step 5 components are all read-only
 * display primitives. The state model from Step 2 is not exercised here.
 */
import React from 'react'
import {SpecSchema} from '@app-creator/protocol'
import {renderWithTheme} from '../__test-utils__/renderWithTheme'
import {NodeRenderer} from '../components/NodeRenderer'
import {SAMPLE_SPEC_MILESTONE_A as SAMPLE_SPEC} from './sampleSpec'

// ---------------------------------------------------------------------------
// T-0006-086: Milestone A integration test
// ---------------------------------------------------------------------------

describe('Milestone A integration (T-0006-086)', () => {
  it('SAMPLE_SPEC validates against SpecSchema', () => {
    const result = SpecSchema.safeParse(SAMPLE_SPEC)
    if (!result.success) {
      // Fail with a readable error message showing what Zod rejected.
      throw new Error(
        `SpecSchema.parse(SAMPLE_SPEC) failed:\n${JSON.stringify(result.error.issues, null, 2)}`,
      )
    }
    expect(result.success).toBe(true)
  })

  it('renders the sample spec root node without throwing', () => {
    const screen = SAMPLE_SPEC.screens[0]
    // screen is guaranteed by sampleSpec construction; explicit guard satisfies TS.
    if (screen === undefined) throw new Error('SAMPLE_SPEC must have at least one screen')
    const {toJSON} = renderWithTheme(<NodeRenderer node={screen.root} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('renders the sample spec root node at productive×focus — Milestone A golden snapshot', () => {
    const screen = SAMPLE_SPEC.screens[0]
    if (screen === undefined) throw new Error('SAMPLE_SPEC must have at least one screen')
    const {toJSON} = renderWithTheme(<NodeRenderer node={screen.root} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).toMatchSnapshot()
  })
})
