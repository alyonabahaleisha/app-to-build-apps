/**
 * Documentation lint tests — ADR-0010 Step 7.
 *
 * These tests assert structural and content invariants on the docs produced
 * by Step 7. They use fs.existsSync / fs.readFileSync + toContain assertions.
 * No mocking, no network, no DB. Pure filesystem reads.
 *
 * T-0010-130 through T-0010-139, T-0010-159, T-0010-160, T-0010-161.
 *
 * T-0010-136 (ADR index not modified) is a coordination note enforced by
 * process (Ellis owns the insertion post-commit). It is represented here as
 * a static documentation assertion — the adr-index.md file must NOT contain
 * an ADR-0010 row that references this step's commit, which would indicate
 * an unauthorized edit. In practice this test verifies that adr-index.md
 * does not contain the specific insertion text Cal would have added.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const REPO_ROOT = path.join(__dirname, '..', '..', '..')

const LOOP_DOC = path.join(
  REPO_ROOT,
  'docs',
  'product',
  'canvas-v0-prompt-quality-loop.md',
)

const CANVAS_V0_DOC = path.join(REPO_ROOT, 'docs', 'product', 'canvas-v0.md')

const ADR_INDEX = path.join(REPO_ROOT, '.claude', 'references', 'adr-index.md')

// ---------------------------------------------------------------------------
// Prohibited App Review phrases per §AC-AR3 of canvas-v0.md
// ---------------------------------------------------------------------------

const PROHIBITED_PHRASES = [
  'app builder',
  'AI app generator',
  'code generation',
  'no-code',
]

// ---------------------------------------------------------------------------
// Required section headings per ADR-0010 Step 7 spec
// ---------------------------------------------------------------------------

const REQUIRED_SECTIONS = [
  'Why this loop exists',
  'The four parts',
  'The cadence',
  'Who owns what',
  'What "good" looks like',
  'V0.5 extensions',
]

// ---------------------------------------------------------------------------
// Describe block
// ---------------------------------------------------------------------------

describe('Documentation lint — ADR-0010 Step 7', () => {
  let loopDoc: string
  let canvasV0: string

  beforeAll(() => {
    loopDoc = fs.existsSync(LOOP_DOC) ? fs.readFileSync(LOOP_DOC, 'utf-8') : ''
    canvasV0 = fs.existsSync(CANVAS_V0_DOC)
      ? fs.readFileSync(CANVAS_V0_DOC, 'utf-8')
      : ''
  })

  // -------------------------------------------------------------------------
  // T-0010-130: Loop doc exists
  // -------------------------------------------------------------------------
  it('T-0010-130: file docs/product/canvas-v0-prompt-quality-loop.md exists', () => {
    expect(fs.existsSync(LOOP_DOC)).toBe(true)
  })

  // -------------------------------------------------------------------------
  // T-0010-131: Loop doc references the eval baseline file
  // -------------------------------------------------------------------------
  it('T-0010-131: loop doc references services/api/eval/baseline.json', () => {
    expect(loopDoc).toContain('services/api/eval/baseline.json')
  })

  // -------------------------------------------------------------------------
  // T-0010-132: Loop doc references the grading template
  // -------------------------------------------------------------------------
  it('T-0010-132: loop doc references docs/pipeline/prompt-grading-template.md', () => {
    expect(loopDoc).toContain('docs/pipeline/prompt-grading-template.md')
  })

  // -------------------------------------------------------------------------
  // T-0010-133: Loop doc contains all 6 required sections (parametrized)
  // -------------------------------------------------------------------------
  it.each(REQUIRED_SECTIONS)(
    'T-0010-133: loop doc contains required section "%s"',
    section => {
      expect(loopDoc).toContain(section)
    },
  )

  // -------------------------------------------------------------------------
  // T-0010-134: canvas-v0.md §AC-G9 references ADR-0010
  // -------------------------------------------------------------------------
  it('T-0010-134: canvas-v0.md §AC-G9 references ADR-0010', () => {
    expect(canvasV0).toContain('ADR-0010')
  })

  // -------------------------------------------------------------------------
  // T-0010-135: canvas-v0.md §Success Metrics contains prompt_grading_primary_avg
  // with target ≥3.5
  // -------------------------------------------------------------------------
  it('T-0010-135: canvas-v0.md §Success Metrics contains prompt_grading_primary_avg diagnostic row with target ≥3.5', () => {
    expect(canvasV0).toContain('prompt_grading_primary_avg')
    expect(canvasV0).toContain('3.5')
  })

  // -------------------------------------------------------------------------
  // T-0010-136: adr-index.md NOT modified by this ADR's commit
  //
  // Ellis owns the ADR-0010 insertion post-commit. Cal does not touch this
  // file. We verify that adr-index.md does not contain the specific
  // insertion text that would indicate an unauthorized Cal-authored edit.
  // The test asserts the file does not contain the exact row Cal would have
  // written (keyed to the ADR-0010 loop doc path as the "Step 7" artifact).
  // -------------------------------------------------------------------------
  it('T-0010-136: adr-index.md is NOT modified — does not contain an ADR-0010 row authored by Cal', () => {
    if (!fs.existsSync(ADR_INDEX)) {
      // Index doesn't exist at all — certainly not modified.
      return
    }
    const adrIndex = fs.readFileSync(ADR_INDEX, 'utf-8')
    // The insertion Ellis will make includes the loop doc path. If Cal had
    // written the row, it would reference the loop doc filename. A row
    // authored by Cal during this ADR's commit would have been premature.
    // We assert the file does not contain a row that Cal would add.
    // (Ellis's post-commit insertion is outside the scope of this ADR.)
    //
    // This assertion is intentionally written to be satisfiable by not
    // touching adr-index.md at all. If the row IS present, it is a sign
    // that the coordination agreement was violated.
    const calAuthoredRow = 'ADR-0010 | Prompt Engineering Eval Grading Loop'
    expect(adrIndex).not.toContain(calAuthoredRow)
  })

  // -------------------------------------------------------------------------
  // T-0010-137: canvas-v0.md §AC-G9 still includes the original numeric bars
  // -------------------------------------------------------------------------
  it('T-0010-137: canvas-v0.md §AC-G9 still contains original ≥90% threshold', () => {
    expect(canvasV0).toContain('≥90%')
  })

  it('T-0010-137: canvas-v0.md §AC-G9 still contains original ≥80% threshold', () => {
    expect(canvasV0).toContain('≥80%')
  })

  // -------------------------------------------------------------------------
  // T-0010-138: Loop doc length ≤ 6,000 chars
  // -------------------------------------------------------------------------
  it('T-0010-138: loop doc is ≤ 6,000 chars', () => {
    expect(loopDoc.length).toBeLessThanOrEqual(6000)
  })

  // -------------------------------------------------------------------------
  // T-0010-139: Loop doc length ≥ 2,000 chars
  // -------------------------------------------------------------------------
  it('T-0010-139: loop doc is ≥ 2,000 chars', () => {
    expect(loopDoc.length).toBeGreaterThanOrEqual(2000)
  })

  // -------------------------------------------------------------------------
  // T-0010-159: The AC-G9 paragraph that mentions ADR-0010 also contains
  // ≥90% AND ≥80% in the same paragraph (reference adds context, does not
  // replace the numeric bar)
  // -------------------------------------------------------------------------
  it('T-0010-159: the AC-G9 paragraph that contains ADR-0010 also contains ≥90% AND ≥80% in the same paragraph', () => {
    // Split on double-newline to get paragraphs / list items. The AC-G9 entry
    // is a single block because it is a multi-line list item that does not
    // have an empty line in the middle.
    const blocks = canvasV0.split(/\n\n+/)
    const adr0010Block = blocks.find(b => b.includes('ADR-0010') && b.includes('AC-G9'))
    expect(adr0010Block).toBeDefined()
    expect(adr0010Block).toContain('≥90%')
    expect(adr0010Block).toContain('≥80%')
  })

  // -------------------------------------------------------------------------
  // T-0010-160: Loop doc references ADR-0007 by name or filename
  // -------------------------------------------------------------------------
  it('T-0010-160: loop doc references ADR-0007', () => {
    const referencesAdr0007 =
      loopDoc.includes('ADR-0007') || loopDoc.includes('ADR-0007-llm-v0-cutover')
    expect(referencesAdr0007).toBe(true)
  })

  // -------------------------------------------------------------------------
  // T-0010-161: Loop doc does NOT contain App Review prohibited phrases
  // (case-insensitive; parametrized)
  // -------------------------------------------------------------------------
  it.each(PROHIBITED_PHRASES)(
    'T-0010-161: loop doc does NOT contain prohibited phrase "%s" (case-insensitive)',
    phrase => {
      expect(loopDoc.toLowerCase()).not.toContain(phrase.toLowerCase())
    },
  )
})
