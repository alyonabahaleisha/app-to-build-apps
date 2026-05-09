/**
 * render.test.tsx — Step 8 determinism tests.
 *
 * Two test families per ADR-0003 §G:
 *
 * 1. Render-stability (T-0003-113a, T-0003-113b):
 *    Same fixture spec rendered twice into separate react-test-renderer hosts
 *    produces byte-equal toJSON() output. Catches accidental entropy or
 *    non-deterministic React internals.
 *
 * 2. Spec-canonicalization (T-0003-114a, T-0003-114b):
 *    renderHash(spec) matches the committed .hash fixture. Catches changes to
 *    how we canonicalize specs (sort order, whitespace, etc.).
 *
 * These test DIFFERENT things:
 *   - T-0003-113: render output determinism
 *   - T-0003-114: spec canonicalization stability
 *
 * Both must hold for AC-R4 to be locked.
 *
 * Doc-presence tests (T-0003-120, T-0003-121) are co-located here because
 * they belong to Step 8 scope and this is the Step 8 test file.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

import React from 'react'
import {create} from 'react-test-renderer'

import type {A2UISpec} from '@app-creator/a2ui-schema'
// Import renderHash directly from the canonical subpath to avoid the ESM
// `.js`-extension re-export in a2ui-schema/src/index.ts that Jest's resolver
// cannot handle (it's only valid under Node16+ moduleResolution / bundler).
// The subpath export '@app-creator/a2ui-schema/canonical' points at
// `packages/a2ui-schema/src/canonical.ts` directly (no `.js` extension).
import {renderHash} from '@app-creator/a2ui-schema/canonical'

import {RendererLoggerProvider} from './logger/RendererLoggerProvider'
import {render} from './render'
import {DEFAULT_LIGHT_THEME, RendererThemeProvider} from './theme/RendererThemeProvider'
import type {Dispatch, RenderState} from './types'

// -- Helpers -----------------------------------------------------------------

const FIXTURES_DIR = path.join(__dirname, 'test/fixtures/specs')

function loadSpec(name: string): A2UISpec {
  const content = fs.readFileSync(path.join(FIXTURES_DIR, `${name}.json`), 'utf-8')
  return JSON.parse(content) as A2UISpec
}

function loadHash(name: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, `${name}.hash`), 'utf-8').trim()
}

const NO_OP_LOGGER = {
  warn: jest.fn(),
  error: jest.fn(),
}

function noop(): void {}
const dispatch: Dispatch = noop
const state: RenderState = {}

/**
 * Render a spec twice into separate react-test-renderer hosts and return both
 * toJSON() outputs as JSON strings.
 */
function renderSpecTwice(spec: A2UISpec): [string, string] {
  function mountOnce(): string {
    const tree = create(
      <RendererThemeProvider value={DEFAULT_LIGHT_THEME}>
        <RendererLoggerProvider logger={NO_OP_LOGGER}>
          {render({spec, state, dispatch})}
        </RendererLoggerProvider>
      </RendererThemeProvider>,
    )
    return JSON.stringify(tree.toJSON())
  }

  const first = mountOnce()
  const second = mountOnce()
  return [first, second]
}

// -- T-0003-113a: Render-stability — Pomodoro --------------------------------

describe('T-0003-113a: render-stability (Pomodoro)', () => {
  it('renders the Pomodoro spec identically on two separate mounts', () => {
    const spec = loadSpec('pomodoro')
    const [first, second] = renderSpecTwice(spec)
    expect(first).toBe(second)
  })
})

// -- T-0003-113b: Render-stability — Tip Splitter ----------------------------

describe('T-0003-113b: render-stability (Tip Splitter)', () => {
  it('renders the Tip Splitter spec identically on two separate mounts', () => {
    const spec = loadSpec('tipsplitter')
    const [first, second] = renderSpecTwice(spec)
    expect(first).toBe(second)
  })
})

// -- T-0003-114a: Spec-canonicalization — Pomodoro ---------------------------

describe('T-0003-114a: spec-canonicalization (Pomodoro)', () => {
  it('renderHash(pomodoroSpec) matches the committed .hash fixture', () => {
    const spec = loadSpec('pomodoro')
    const expected = loadHash('pomodoro')
    const actual = renderHash(spec)
    expect(actual).toBe(expected)
  })
})

// -- T-0003-114b: Spec-canonicalization — Tip Splitter -----------------------

describe('T-0003-114b: spec-canonicalization (Tip Splitter)', () => {
  it('renderHash(tipSplitterSpec) matches the committed .hash fixture', () => {
    const spec = loadSpec('tipsplitter')
    const expected = loadHash('tipsplitter')
    const actual = renderHash(spec)
    expect(actual).toBe(expected)
  })
})

// -- T-0003-120: Doc — pipeline-state.md -------------------------------------

describe('T-0003-120: pipeline-state.md row 27 updated for ADR-0003', () => {
  it('pipeline-state.md row points to ADR-0003-renderer.md and has ADR-0004 row', () => {
    const pipelineStatePath = path.join(__dirname, '../../../../docs/pipeline/pipeline-state.md')
    const content = fs.readFileSync(pipelineStatePath, 'utf-8')

    // Row 27 must reference ADR-0003-renderer.md
    expect(content).toMatch(/ADR-0003-renderer\.md/)

    // ADR-0004 row must exist
    expect(content).toMatch(/ADR-0004/)
  })
})

// -- T-0003-121: Doc — adr-index.md ------------------------------------------

describe('T-0003-121: adr-index.md has ADR-0003 row with correct tags', () => {
  it('adr-index.md includes ADR-0003 row with tags a2ui, mobile-shell', () => {
    const adrIndexPath = path.join(__dirname, '../../../../.claude/references/adr-index.md')
    const content = fs.readFileSync(adrIndexPath, 'utf-8')

    // Must have ADR-0003 row
    expect(content).toMatch(/0003/)

    // Must have the required tags
    expect(content).toMatch(/a2ui/)
    expect(content).toMatch(/mobile-shell/)
  })
})
