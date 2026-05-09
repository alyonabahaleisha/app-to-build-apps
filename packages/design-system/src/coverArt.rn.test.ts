// coverArt.rn.test.ts — RN-runtime test suite.
// Covers T-0005-245..256: 12 RN golden snapshots (same 12 fixtures as Node).
//
// This file runs under jest.rn.config.cjs which stores snapshots in
// __rn-snapshots__/coverArt.rn.test.ts.snap (separate from Node snapshots).
//
// The SVG strings produced here must be byte-identical to the Node runtime
// outputs for the same inputs — T-0005-256a verifies this cross-file equality.
//
// coverArt.ts uses only pure-JS dependencies (seedrandom, js-sha256, theme,
// ICON_PATHS) with no RN-specific native bindings, so the output is
// deterministically identical across both Jest environments.

import {coverArt} from './coverArt.js'
import {COVER_ART_FIXTURES} from '../test/coverArtFixtures.js'

// ---------------------------------------------------------------------------
// T-0005-245..256: 12 RN golden snapshots (parameterized)
// ---------------------------------------------------------------------------

describe('coverArt — 12 RN-runtime golden snapshots (T-0005-245..256)', () => {
  it.each(COVER_ART_FIXTURES)('$name produces stable SVG snapshot', fixture => {
    const {name: _name, ...input} = fixture
    const svg = coverArt(input)
    expect(svg).toMatchSnapshot()
  })
})
