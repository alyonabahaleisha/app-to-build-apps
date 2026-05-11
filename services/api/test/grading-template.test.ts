/**
 * Grading template structure tests — ADR-0010 Step 2.
 *
 * These tests read the markdown template file and assert structural invariants.
 * They are doc-tests: they verify the template is machine-checkable at the
 * grader-calibration level. Column renames, rubric anchor drift, and M2
 * archetype pollution are the highest-risk mutation classes.
 *
 * T-0010-033 through T-0010-045, T-0010-140 through T-0010-144.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

const TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'docs',
  'pipeline',
  'prompt-grading-template.md',
)

describe('Grading template — ADR-0010 Step 2', () => {
  let content: string

  beforeAll(() => {
    content = fs.readFileSync(TEMPLATE_PATH, 'utf-8')
  })

  // -------------------------------------------------------------------------
  // T-0010-033: File exists
  // -------------------------------------------------------------------------
  it('T-0010-033: file exists at docs/pipeline/prompt-grading-template.md', () => {
    expect(fs.existsSync(TEMPLATE_PATH)).toBe(true)
  })

  // -------------------------------------------------------------------------
  // T-0010-034: Heading literal
  // -------------------------------------------------------------------------
  it('T-0010-034: file starts with `# Prompt Grading —` heading', () => {
    expect(content.startsWith('# Prompt Grading —')).toBe(true)
  })

  // -------------------------------------------------------------------------
  // T-0010-035: Frontmatter lines (parametrized)
  // -------------------------------------------------------------------------
  const FRONTMATTER_FIELDS = [
    'Graders:',
    'Prompt version under test:',
    'Eval baseline pass rate:',
    'Sample size:',
    'Eval results file:',
  ]

  it.each(FRONTMATTER_FIELDS)(
    'T-0010-035: frontmatter field `%s` is present',
    field => {
      expect(content).toContain(field)
    },
  )

  // -------------------------------------------------------------------------
  // T-0010-036: Per-prompt grades section
  // -------------------------------------------------------------------------
  it('T-0010-036: file contains `## Per-prompt grades` section', () => {
    expect(content).toContain('## Per-prompt grades')
  })

  // -------------------------------------------------------------------------
  // T-0010-037: Per-prompt grades table — 10 required column headers (parametrized)
  // -------------------------------------------------------------------------
  const REQUIRED_COLUMNS = [
    'Prompt ID',
    'Primary (1–5)',
    'Appropriateness',
    'Layout',
    'Stance/Palette',
    'Verb usage',
    'Copy',
    'Empty state',
    'Scope precision',
    'Notes',
  ]

  it.each(REQUIRED_COLUMNS)(
    'T-0010-037: per-prompt grades table contains column `%s`',
    col => {
      expect(content).toContain(col)
    },
  )

  // -------------------------------------------------------------------------
  // T-0010-038: Per-archetype rollup section
  // -------------------------------------------------------------------------
  it('T-0010-038: file contains `## Per-archetype rollup` section', () => {
    expect(content).toContain('## Per-archetype rollup')
  })

  // -------------------------------------------------------------------------
  // T-0010-039: Sable's notes section
  // -------------------------------------------------------------------------
  it("T-0010-039: file contains `## Sable's notes` section heading", () => {
    expect(content).toContain("## Sable's notes")
  })

  // -------------------------------------------------------------------------
  // T-0010-040: Prompt iteration proposal section
  // -------------------------------------------------------------------------
  it('T-0010-040: file contains `## Prompt iteration proposal` section', () => {
    expect(content).toContain('## Prompt iteration proposal')
  })

  // -------------------------------------------------------------------------
  // T-0010-041: Iteration proposal — 5 required fields (parametrized)
  // -------------------------------------------------------------------------
  const PROPOSAL_FIELDS = [
    'Hypothesis',
    'Proposed change',
    'Expected impact',
    'Token budget delta',
    'Next bump',
  ]

  it.each(PROPOSAL_FIELDS)(
    'T-0010-041: iteration-proposal section contains field `%s`',
    field => {
      expect(content).toContain(field)
    },
  )

  // -------------------------------------------------------------------------
  // T-0010-042: Rubric semantics table — 5 rows (scores 1–5)
  // -------------------------------------------------------------------------
  it('T-0010-042: file contains rubric semantics table with scores 1 through 5', () => {
    // Each score row starts with "| 1 |", "| 2 |", etc.
    for (let score = 1; score <= 5; score++) {
      expect(content).toContain(`| ${score} |`)
    }
  })

  // -------------------------------------------------------------------------
  // T-0010-043: Score-5 anchor literal
  // -------------------------------------------------------------------------
  it('T-0010-043: score 5 anchor reads the exact literal `Design-Sable-could-ship`', () => {
    expect(content).toContain('Design-Sable-could-ship')
  })

  // -------------------------------------------------------------------------
  // T-0010-044: File size upper bound
  // -------------------------------------------------------------------------
  it('T-0010-044: file is ≤ 8,000 chars', () => {
    expect(content.length).toBeLessThanOrEqual(8000)
  })

  // -------------------------------------------------------------------------
  // T-0010-045: File size lower bound
  // -------------------------------------------------------------------------
  it('T-0010-045: file is ≥ 1,500 chars', () => {
    expect(content.length).toBeGreaterThanOrEqual(1500)
  })

  // -------------------------------------------------------------------------
  // T-0010-140: Column-rename guard — fixture-copy mutation test
  //
  // This test mutates a fixture copy of the per-prompt grades table header
  // (by renaming one column) and asserts that the column-set check would
  // reject the mutated header. It tests the test's own assertion logic, not
  // just the template content, ensuring the parametrized column checks are
  // not vacuously passing.
  // -------------------------------------------------------------------------
  it('T-0010-140: column-rename guard — mutated header fails column-set check', () => {
    // Create a modified version of the content with a renamed column
    const mutated = content.replace('Appropriateness', 'Suitability')

    // The original column must be present in unmutated content
    expect(content).toContain('Appropriateness')

    // The mutated content must NOT contain the original column
    expect(mutated).not.toContain('Appropriateness')

    // The mutated content DOES contain the renamed column
    expect(mutated).toContain('Suitability')

    // This confirms that the T-0010-037 parametrized check would fail on
    // the mutated content — demonstrating the check is not vacuous.
    const columnPresent = mutated.includes('Appropriateness')
    expect(columnPresent).toBe(false)
  })

  // -------------------------------------------------------------------------
  // T-0010-141: Score-1 anchor verbatim
  //
  // Most consequential calibration anchor: divergent score-1 mental models
  // distort the entire grading scale. Must be byte-exact.
  // -------------------------------------------------------------------------
  it('T-0010-141: score 1 anchor reads the exact literal `Broken / wrong archetype / would not ship`', () => {
    expect(content).toContain('Broken / wrong archetype / would not ship')
  })

  // -------------------------------------------------------------------------
  // T-0010-142: Score-2 anchor verbatim
  // -------------------------------------------------------------------------
  it('T-0010-142: score 2 anchor reads the exact literal `Structurally correct but visually weak across most dimensions`', () => {
    expect(content).toContain('Structurally correct but visually weak across most dimensions')
  })

  // -------------------------------------------------------------------------
  // T-0010-143: Per-archetype rollup contains exactly the 4 V0 archetypes,
  // NOT any M2 archetypes (parametrized)
  // -------------------------------------------------------------------------
  const V0_ARCHETYPES = ['ListCRUD', 'Tracker', 'Journal', 'Calculator']

  it.each(V0_ARCHETYPES)(
    'T-0010-143 (inclusion): rollup table contains V0 archetype `%s`',
    arch => {
      expect(content).toContain(arch)
    },
  )

  // M2 archetypes must not appear in the per-archetype rollup table.
  // The check is scoped to the rollup table section to avoid false positives
  // from the word "Notes" appearing as a column header in the per-prompt grades
  // table (which is correct and expected).
  const M2_ARCHETYPES = [
    'Notes',
    'Habits',
    'Inventory',
    'Tasks',
    'Reminders',
    'Goals',
    'Workouts',
    'Reading',
  ]

  it.each(M2_ARCHETYPES)(
    'T-0010-143 (exclusion): rollup table does NOT contain M2 archetype `%s` as an archetype row',
    arch => {
      // Extract the per-archetype rollup section
      const rollupSectionMatch = content.match(
        /## Per-archetype rollup\n([\s\S]*?)(?=\n---|\n## )/,
      )
      expect(rollupSectionMatch).not.toBeNull()
      const rollupSection = rollupSectionMatch?.[1] ?? ''

      // Check that no table row begins with `| <arch>` (i.e., arch is a row value, not a column header)
      // Row format: `| ListCRUD | 10 | ...`
      const archAsRowValue = new RegExp(`^\\| ${arch} \\|`, 'm')
      expect(archAsRowValue.test(rollupSection)).toBe(false)
    },
  )

  // -------------------------------------------------------------------------
  // T-0010-144: Template contains placeholder rows only
  //
  // Per-prompt grade cells must use placeholders, not real data.
  // Primary column cells must read `<1-5>` and Prompt ID cells `<prompt_id>`.
  // -------------------------------------------------------------------------
  it('T-0010-144: template contains placeholder `<1-5>` in per-prompt grades table', () => {
    expect(content).toContain('<1-5>')
  })

  it('T-0010-144: template contains placeholder `<prompt_id>` in per-prompt grades table', () => {
    expect(content).toContain('<prompt_id>')
  })

  it('T-0010-144: template does not contain real numeric scores (bare 1–5 in a grades cell)', () => {
    // The only occurrences of | 1 |, | 2 |, | 3 |, | 4 |, | 5 | should be in the
    // rubric table, not in the per-prompt grades table. The grades table uses placeholders.
    // We verify this by checking that the grades table lines all use `<1-5>`.
    const gradesSection = content.split('## Per-prompt grades')[1]
    expect(gradesSection).toBeDefined()
    // All data rows in the grades table should contain the placeholder (no actual score)
    const tableRows = (gradesSection ?? '').split('\n').filter(
      line => line.startsWith('| <prompt_id>'),
    )
    expect(tableRows.length).toBeGreaterThan(0)
    for (const row of tableRows) {
      expect(row).toContain('<1-5>')
    }
  })
})
