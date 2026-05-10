/**
 * Step 2 Tests — ADR-0007
 *
 * T-IDs: T-0007-020 through T-0007-035 (16 tests)
 *
 * Counts:
 *   Happy:          T-020, T-021, T-035            (3)
 *   Boundary:       T-027, T-028                   (2)
 *   Regression:     T-022..026, T-032, T-033, T-034 (8)
 *   Breaking change: T-029, T-030, T-031            (3)
 *   Total:                                         16
 */

import {SYSTEM_PROMPT_STATIC, SYSTEM_PROMPT_CATALOG} from './system.js'

// ─── T-0007-020 — Happy ────────────────────────────────────────────────────
it('T-0007-020: SYSTEM_PROMPT_STATIC mentions produce_app_spec and out_of_scope tool names', () => {
  expect(SYSTEM_PROMPT_STATIC).toContain('produce_app_spec')
  expect(SYSTEM_PROMPT_STATIC).toContain('out_of_scope')
})

// ─── T-0007-021 — Happy ────────────────────────────────────────────────────
it('T-0007-021: SYSTEM_PROMPT_STATIC instructs choice between the two tools', () => {
  // Must tell the model to call out_of_scope instead of produce_app_spec
  expect(SYSTEM_PROMPT_STATIC).toMatch(/call out_of_scope instead/i)
})

// ─── T-0007-022 — Regression ───────────────────────────────────────────────
it('T-0007-022: SYSTEM_PROMPT_CATALOG mentions all 4 archetypes at least once each', () => {
  const archetypes = ['ListCRUD', 'Tracker', 'Journal', 'Calculator']
  for (const archetype of archetypes) {
    expect(SYSTEM_PROMPT_CATALOG).toContain(archetype)
  }
})

// ─── T-0007-023 — Regression ───────────────────────────────────────────────
const COMPONENT_NAMES = [
  'Screen', 'Section', 'Stack', 'Row', 'Card',
  'Heading', 'Body', 'Caption',
  'TextField', 'NumberField', 'DateField', 'Picker', 'Switch',
  'Stat', 'Badge', 'Chip', 'Avatar',
  'List', 'ListItem', 'SwipeableRow', 'EmptyState', 'LoadingState',
  'ConditionalSection', 'ListSummary', 'MediaTray', 'ImagePicker',
  'Button', 'FAB',
]

it.each(COMPONENT_NAMES)(
  'T-0007-023: SYSTEM_PROMPT_CATALOG mentions component "%s"',
  (componentName) => {
    expect(SYSTEM_PROMPT_CATALOG).toContain(componentName)
  },
)

// ─── T-0007-024 — Regression ───────────────────────────────────────────────
const ACTION_VERB_NAMES = [
  'set', 'update', 'reset', 'addItem', 'removeItem', 'updateItem',
  'clearCollection', 'navigate', 'back', 'capture', 'toast', 'aiProcess',
]

it.each(ACTION_VERB_NAMES)(
  'T-0007-024: SYSTEM_PROMPT_CATALOG mentions action verb "%s"',
  (verbName) => {
    expect(SYSTEM_PROMPT_CATALOG).toContain(verbName)
  },
)

// ─── T-0007-025 — Regression ───────────────────────────────────────────────
it('T-0007-025: SYSTEM_PROMPT_CATALOG mentions all 5 binding kinds', () => {
  const bindingKinds = ['literal', 'state', 'collectionField', 'image', 'date']
  for (const kind of bindingKinds) {
    expect(SYSTEM_PROMPT_CATALOG).toContain(kind)
  }
})

// ─── T-0007-026 — Regression ───────────────────────────────────────────────
it('T-0007-026: SYSTEM_PROMPT_CATALOG mentions all 5 out-of-scope capabilities', () => {
  const capabilities = ['image_gen', 'vision', 'chat', 'transcription', 'classification']
  for (const cap of capabilities) {
    expect(SYSTEM_PROMPT_CATALOG).toContain(cap)
  }
})

// ─── T-0007-027 — Boundary ─────────────────────────────────────────────────
it('T-0007-027: SYSTEM_PROMPT_CATALOG.length <= 25000 chars', () => {
  expect(SYSTEM_PROMPT_CATALOG.length).toBeLessThanOrEqual(25_000)
})

// ─── T-0007-028 — Boundary ─────────────────────────────────────────────────
it('T-0007-028: SYSTEM_PROMPT_STATIC.length <= 2000 chars', () => {
  expect(SYSTEM_PROMPT_STATIC.length).toBeLessThanOrEqual(2_000)
})

// ─── T-0007-029 — Breaking change ──────────────────────────────────────────
const M1_ONLY_COMPONENTS = ['TextInput', 'Toggle', 'Counter', 'Form', 'Container']

it.each(M1_ONLY_COMPONENTS)(
  'T-0007-029: SYSTEM_PROMPT_CATALOG does NOT mention M1-only component "%s"',
  (m1Component) => {
    // The component name should not appear as a component header (### ComponentName)
    // or as an inline reference to the M1 component type
    // Allow it to appear in examples only if absolutely needed, but our catalog
    // should not document them. Check the catalog section explicitly.
    const catalogWithoutExamples = SYSTEM_PROMPT_CATALOG.split('## Examples')[0] ?? SYSTEM_PROMPT_CATALOG
    expect(catalogWithoutExamples).not.toContain(m1Component)
  },
)

// ─── T-0007-030 — Breaking change ──────────────────────────────────────────
it('T-0007-030: SYSTEM_PROMPT_CATALOG does NOT mention Plan or produce_plan', () => {
  expect(SYSTEM_PROMPT_CATALOG).not.toContain('Plan\n')
  expect(SYSTEM_PROMPT_CATALOG).not.toContain('produce_plan')
  // Check neither static nor catalog mention the old planner
  expect(SYSTEM_PROMPT_STATIC).not.toContain('produce_plan')
})

// ─── T-0007-031 — Breaking change ──────────────────────────────────────────
it('T-0007-031: SYSTEM_PROMPT_CATALOG does NOT contain the stale "Until ADR-0005 ships" comment', () => {
  expect(SYSTEM_PROMPT_CATALOG).not.toContain('Until ADR-0005 ships')
  expect(SYSTEM_PROMPT_STATIC).not.toContain('Until ADR-0005 ships')
})

// ─── T-0007-032 — Regression ───────────────────────────────────────────────
it('T-0007-032: SYSTEM_PROMPT_CATALOG mentions all 4 nav patterns', () => {
  const navPatterns = ['none', 'stack', 'tabs', 'modal-overlay']
  for (const pattern of navPatterns) {
    expect(SYSTEM_PROMPT_CATALOG).toContain(pattern)
  }
})

// ─── T-0007-033 — Regression ───────────────────────────────────────────────
it('T-0007-033: SYSTEM_PROMPT_CATALOG mentions both stances', () => {
  expect(SYSTEM_PROMPT_CATALOG).toContain('productive')
  expect(SYSTEM_PROMPT_CATALOG).toContain('expressive')
})

// ─── T-0007-034 — Regression ───────────────────────────────────────────────
it('T-0007-034: SYSTEM_PROMPT_CATALOG mentions all 6 palettes', () => {
  const palettes = ['focus', 'health', 'money', 'social', 'learn', 'play']
  for (const palette of palettes) {
    expect(SYSTEM_PROMPT_CATALOG).toContain(palette)
  }
})

// ─── T-0007-035 — Happy ────────────────────────────────────────────────────
it('T-0007-035: SYSTEM_PROMPT_CATALOG includes at least 4 example specs (4 occurrences of "type":"Screen")', () => {
  // The examples section embeds condensed specs; count Screen occurrences as a heuristic
  const screenOccurrences = (SYSTEM_PROMPT_CATALOG.match(/"type":"Screen"/g) ?? []).length
  expect(screenOccurrences).toBeGreaterThanOrEqual(4)
})
