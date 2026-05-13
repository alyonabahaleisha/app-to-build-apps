/**
 * Step 2 Tests — ADR-0007
 * Step 1 Tests — ADR-0010 (prompt v0.1.0 additions)
 *
 * T-IDs: T-0007-020 through T-0007-035 (16 tests)
 *         T-0010-001 through T-0010-032 (32 tests)
 *
 * ADR-0007 Counts:
 *   Happy:          T-020, T-021, T-035            (3)
 *   Boundary:       T-027, T-028                   (2)
 *   Regression:     T-022..026, T-032, T-033, T-034 (8)
 *   Breaking change: T-029, T-030, T-031            (3)
 *   Total:                                         16
 *
 * ADR-0010 Step 1 Counts:
 *   Happy:          T-001..015, T-020..022, T-032  (17)
 *   Failure:        T-016..019                      (4)
 *   Boundary:       T-023..025                      (5)  [T-023/T-024 floor/ceiling, T-025 static]
 *   Regression:     T-026..030                      (5)
 *   Breaking change: T-031                          (1)
 *   Total:                                         32
 */

import {PROMPT_VERSION, SYSTEM_PROMPT_STATIC, SYSTEM_PROMPT_CATALOG} from './system.js'

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
// Budget bumped from 25,000 → 40,000 chars per ADR-0009 Step 10 (T-0009-217).
// V1 catalog (53 components) lands ~37,500 chars; 40,000 reserves ~6% headroom.
it('T-0007-027: SYSTEM_PROMPT_CATALOG.length <= 40000 chars', () => {
  expect(SYSTEM_PROMPT_CATALOG.length).toBeLessThanOrEqual(40_000)
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

// =============================================================================
// ADR-0010 Step 1 — Prompt v0.1.0 Tests (T-0010-001 through T-0010-032)
// =============================================================================

// ─── T-0010-001 — Happy ───────────────────────────────────────────────────
// Bumped from v0.2.0 → v0.2.1 per V0 prompt hotfix (inline-add pattern + minimal seedData).
it('T-0010-001: PROMPT_VERSION === "v0.2.1"', () => {
  expect(PROMPT_VERSION).toBe('v0.2.1')
})

// ─── T-0010-002 — Boundary ────────────────────────────────────────────────
it('T-0010-002: PROMPT_VERSION matches semver shape /^v\\d+\\.\\d+\\.\\d+$/', () => {
  expect(PROMPT_VERSION).toMatch(/^v\d+\.\d+\.\d+$/)
})

// ─── T-0010-003 — Boundary ────────────────────────────────────────────────
it('T-0010-003: PROMPT_VERSION is exported as const (literal type preserved)', () => {
  // TypeScript const assertion ensures the literal type "v0.2.1" not widened to string.
  // At runtime we verify the value is a string matching the literal — TS enforces the rest.
  const version: 'v0.2.1' = PROMPT_VERSION
  expect(version).toBe('v0.2.1')
})

// ─── T-0010-004 — Happy ───────────────────────────────────────────────────
it('T-0010-004: SYSTEM_PROMPT_CATALOG contains "## Archetype Recipes" section', () => {
  expect(SYSTEM_PROMPT_CATALOG).toContain('## Archetype Recipes')
})

// ─── T-0010-005 — Happy ───────────────────────────────────────────────────
it('T-0010-005: SYSTEM_PROMPT_CATALOG contains "### ListCRUD recipe"', () => {
  expect(SYSTEM_PROMPT_CATALOG).toContain('### ListCRUD recipe')
})

// ─── T-0010-006 — Happy ───────────────────────────────────────────────────
it('T-0010-006: SYSTEM_PROMPT_CATALOG contains "### Tracker recipe"', () => {
  expect(SYSTEM_PROMPT_CATALOG).toContain('### Tracker recipe')
})

// ─── T-0010-007 — Happy ───────────────────────────────────────────────────
it('T-0010-007: SYSTEM_PROMPT_CATALOG contains "### Journal recipe"', () => {
  expect(SYSTEM_PROMPT_CATALOG).toContain('### Journal recipe')
})

// ─── T-0010-008 — Happy ───────────────────────────────────────────────────
it('T-0010-008: SYSTEM_PROMPT_CATALOG contains "### Calculator recipe"', () => {
  expect(SYSTEM_PROMPT_CATALOG).toContain('### Calculator recipe')
})

// ─── T-0010-009 — Happy ───────────────────────────────────────────────────
it('T-0010-009: Calculator recipe includes both "Section" and "Stat"', () => {
  const calcRecipeStart = SYSTEM_PROMPT_CATALOG.indexOf('### Calculator recipe')
  const calcRecipeEnd = SYSTEM_PROMPT_CATALOG.indexOf('\n###', calcRecipeStart + 1)
  const calcRecipe =
    calcRecipeEnd === -1
      ? SYSTEM_PROMPT_CATALOG.slice(calcRecipeStart)
      : SYSTEM_PROMPT_CATALOG.slice(calcRecipeStart, calcRecipeEnd)
  expect(calcRecipe).toContain('Section')
  expect(calcRecipe).toContain('Stat')
})

// ─── T-0010-010 — Happy ───────────────────────────────────────────────────
it('T-0010-010: Calculator recipe includes NumberField with bounds guidance (min, max, step)', () => {
  const calcRecipeStart = SYSTEM_PROMPT_CATALOG.indexOf('### Calculator recipe')
  const calcRecipeEnd = SYSTEM_PROMPT_CATALOG.indexOf('\n###', calcRecipeStart + 1)
  const calcRecipe =
    calcRecipeEnd === -1
      ? SYSTEM_PROMPT_CATALOG.slice(calcRecipeStart)
      : SYSTEM_PROMPT_CATALOG.slice(calcRecipeStart, calcRecipeEnd)
  expect(calcRecipe).toContain('NumberField')
  expect(calcRecipe).toContain('min')
  expect(calcRecipe).toContain('max')
  expect(calcRecipe).toContain('step')
})

// ─── T-0010-011 — Happy ───────────────────────────────────────────────────
it('T-0010-011: Tracker recipe includes "tabs" nav pattern', () => {
  const trackerStart = SYSTEM_PROMPT_CATALOG.indexOf('### Tracker recipe')
  const trackerEnd = SYSTEM_PROMPT_CATALOG.indexOf('\n###', trackerStart + 1)
  const trackerRecipe =
    trackerEnd === -1
      ? SYSTEM_PROMPT_CATALOG.slice(trackerStart)
      : SYSTEM_PROMPT_CATALOG.slice(trackerStart, trackerEnd)
  expect(trackerRecipe).toContain('tabs')
})

// ─── T-0010-012 — Happy ───────────────────────────────────────────────────
it('T-0010-012: Tracker recipe mentions "streak" or "count"', () => {
  const trackerStart = SYSTEM_PROMPT_CATALOG.indexOf('### Tracker recipe')
  const trackerEnd = SYSTEM_PROMPT_CATALOG.indexOf('\n###', trackerStart + 1)
  const trackerRecipe =
    trackerEnd === -1
      ? SYSTEM_PROMPT_CATALOG.slice(trackerStart)
      : SYSTEM_PROMPT_CATALOG.slice(trackerStart, trackerEnd)
  expect(trackerRecipe.toLowerCase()).toMatch(/streak|count/)
})

// ─── T-0010-013 — Happy ───────────────────────────────────────────────────
it('T-0010-013: Journal recipe specifies "expressive" stance', () => {
  const journalStart = SYSTEM_PROMPT_CATALOG.indexOf('### Journal recipe')
  const journalEnd = SYSTEM_PROMPT_CATALOG.indexOf('\n###', journalStart + 1)
  const journalRecipe =
    journalEnd === -1
      ? SYSTEM_PROMPT_CATALOG.slice(journalStart)
      : SYSTEM_PROMPT_CATALOG.slice(journalStart, journalEnd)
  expect(journalRecipe).toContain('expressive')
})

// ─── T-0010-014 — Happy ───────────────────────────────────────────────────
it('T-0010-014: Journal recipe mentions multiline', () => {
  const journalStart = SYSTEM_PROMPT_CATALOG.indexOf('### Journal recipe')
  const journalEnd = SYSTEM_PROMPT_CATALOG.indexOf('\n###', journalStart + 1)
  const journalRecipe =
    journalEnd === -1
      ? SYSTEM_PROMPT_CATALOG.slice(journalStart)
      : SYSTEM_PROMPT_CATALOG.slice(journalStart, journalEnd)
  expect(journalRecipe).toContain('multiline')
})

// ─── T-0010-015 — Happy ───────────────────────────────────────────────────
it('T-0010-015: ListCRUD recipe includes "EmptyState"', () => {
  const listCrudStart = SYSTEM_PROMPT_CATALOG.indexOf('### ListCRUD recipe')
  const listCrudEnd = SYSTEM_PROMPT_CATALOG.indexOf('\n###', listCrudStart + 1)
  const listCrudRecipe =
    listCrudEnd === -1
      ? SYSTEM_PROMPT_CATALOG.slice(listCrudStart)
      : SYSTEM_PROMPT_CATALOG.slice(listCrudStart, listCrudEnd)
  expect(listCrudRecipe).toContain('EmptyState')
})

// ─── T-0010-016 — Failure ─────────────────────────────────────────────────
it('T-0010-016: Calculator recipe does NOT mention "MoneyField" (it is V1)', () => {
  const calcRecipeStart = SYSTEM_PROMPT_CATALOG.indexOf('### Calculator recipe')
  const calcRecipeEnd = SYSTEM_PROMPT_CATALOG.indexOf('\n### ', calcRecipeStart + 1)
  const calcRecipe =
    calcRecipeEnd === -1
      ? SYSTEM_PROMPT_CATALOG.slice(calcRecipeStart)
      : SYSTEM_PROMPT_CATALOG.slice(calcRecipeStart, calcRecipeEnd)
  // The recipe may mention "no MoneyField" as a disclaimer but must not instruct using it.
  // The recipe should NOT reference MoneyField as a component to use.
  // Verify the disclaimer uses "no MoneyField" form, not "use MoneyField".
  expect(calcRecipe).not.toMatch(/use MoneyField|with MoneyField/i)
})

// ─── T-0010-017 — Failure ─────────────────────────────────────────────────
it('T-0010-017: Calculator recipe does NOT mention "Slider" (V1)', () => {
  const calcRecipeStart = SYSTEM_PROMPT_CATALOG.indexOf('### Calculator recipe')
  const calcRecipeEnd = SYSTEM_PROMPT_CATALOG.indexOf('\n### ', calcRecipeStart + 1)
  const calcRecipe =
    calcRecipeEnd === -1
      ? SYSTEM_PROMPT_CATALOG.slice(calcRecipeStart)
      : SYSTEM_PROMPT_CATALOG.slice(calcRecipeStart, calcRecipeEnd)
  expect(calcRecipe).not.toContain('Slider')
})

// ─── T-0010-018 — Failure ─────────────────────────────────────────────────
it('T-0010-018: Calculator recipe does NOT mention "TimeField" (V1)', () => {
  const calcRecipeStart = SYSTEM_PROMPT_CATALOG.indexOf('### Calculator recipe')
  const calcRecipeEnd = SYSTEM_PROMPT_CATALOG.indexOf('\n### ', calcRecipeStart + 1)
  const calcRecipe =
    calcRecipeEnd === -1
      ? SYSTEM_PROMPT_CATALOG.slice(calcRecipeStart)
      : SYSTEM_PROMPT_CATALOG.slice(calcRecipeStart, calcRecipeEnd)
  expect(calcRecipe).not.toContain('TimeField')
})

// ─── T-0010-019 — Failure ─────────────────────────────────────────────────
const V1_COMPONENTS_IN_RECIPES = [
  'RatingInput', 'MultiPicker', 'SearchBar', 'Chart', 'BarChart', 'LineChart',
]

it.each(V1_COMPONENTS_IN_RECIPES)(
  'T-0010-019: Archetype Recipes section does NOT mention V1 component "%s"',
  (v1Component) => {
    const recipesStart = SYSTEM_PROMPT_CATALOG.indexOf('## Archetype Recipes')
    const recipesEnd = SYSTEM_PROMPT_CATALOG.indexOf('\n## ', recipesStart + 1)
    const recipesSection =
      recipesEnd === -1
        ? SYSTEM_PROMPT_CATALOG.slice(recipesStart)
        : SYSTEM_PROMPT_CATALOG.slice(recipesStart, recipesEnd)
    expect(recipesSection).not.toContain(v1Component)
  },
)

// ─── T-0010-020 — Happy ───────────────────────────────────────────────────
it('T-0010-020: Calculator recipe explicitly states V0 lacks MoneyField', () => {
  const calcRecipeStart = SYSTEM_PROMPT_CATALOG.indexOf('### Calculator recipe')
  const calcRecipeEnd = SYSTEM_PROMPT_CATALOG.indexOf('\n### ', calcRecipeStart + 1)
  const calcRecipe =
    calcRecipeEnd === -1
      ? SYSTEM_PROMPT_CATALOG.slice(calcRecipeStart)
      : SYSTEM_PROMPT_CATALOG.slice(calcRecipeStart, calcRecipeEnd)
  // The recipe must include an explicit V1-component disclaimer for MoneyField
  expect(calcRecipe).toMatch(/no MoneyField|has no MoneyField|V0 has no MoneyField/i)
})

// ─── T-0010-021 — Happy ───────────────────────────────────────────────────
it('T-0010-021: Stat component description includes addendum on derived/computed values', () => {
  const statStart = SYSTEM_PROMPT_CATALOG.indexOf('### Stat\n')
  const statEnd = SYSTEM_PROMPT_CATALOG.indexOf('\n###', statStart + 1)
  const statSection =
    statEnd === -1
      ? SYSTEM_PROMPT_CATALOG.slice(statStart)
      : SYSTEM_PROMPT_CATALOG.slice(statStart, statEnd)
  expect(statSection).toMatch(/derived|computed/)
})

// ─── T-0010-022 — Happy ───────────────────────────────────────────────────
it('T-0010-022: set verb description includes the no-arithmetic-expression caveat', () => {
  const setStart = SYSTEM_PROMPT_CATALOG.indexOf('### set\n')
  const setEnd = SYSTEM_PROMPT_CATALOG.indexOf('\n###', setStart + 1)
  const setSection =
    setEnd === -1
      ? SYSTEM_PROMPT_CATALOG.slice(setStart)
      : SYSTEM_PROMPT_CATALOG.slice(setStart, setEnd)
  expect(setSection).toMatch(/expression|arithmetic|inline/)
})

// ─── T-0010-023 — Boundary ────────────────────────────────────────────────
// Budget bumped from 25,000 → 40,000 chars per ADR-0009 Step 10 (T-0009-217).
it('T-0010-023: SYSTEM_PROMPT_CATALOG.length <= 40000 chars (token budget ceiling, V1)', () => {
  expect(SYSTEM_PROMPT_CATALOG.length).toBeLessThanOrEqual(40_000)
})

// ─── T-0010-024 — Boundary ────────────────────────────────────────────────
// Floor bumped: V1 catalog (53 components) is substantially larger than v0.1.0.
it('T-0010-024: SYSTEM_PROMPT_CATALOG.length >= 35000 chars (v0.2.0 V1 additions sanity floor)', () => {
  expect(SYSTEM_PROMPT_CATALOG.length).toBeGreaterThanOrEqual(35_000)
})

// ─── T-0010-025 — Boundary ────────────────────────────────────────────────
it('T-0010-025: SYSTEM_PROMPT_STATIC.length <= 2000 chars (regression on T-0007-028)', () => {
  expect(SYSTEM_PROMPT_STATIC.length).toBeLessThanOrEqual(2_000)
})

// ─── T-0010-026 — Regression ──────────────────────────────────────────────
it('T-0010-026: SYSTEM_PROMPT_STATIC is byte-equal to its v0.1.0 shipped form (snapshot)', () => {
  // Snapshot guards against unintentional edits to the non-cached static block.
  // To update: run jest --updateSnapshot and include an ADR note explaining why.
  expect(SYSTEM_PROMPT_STATIC).toMatchSnapshot()
})

// ─── T-0010-027 — Regression ──────────────────────────────────────────────
const COMPONENT_NAMES_V0 = [
  'Screen', 'Section', 'Stack', 'Row', 'Card',
  'Heading', 'Body', 'Caption',
  'TextField', 'NumberField', 'DateField', 'Picker', 'Switch',
  'Stat', 'Badge', 'Chip', 'Avatar',
  'List', 'ListItem', 'SwipeableRow', 'EmptyState', 'LoadingState',
  'ConditionalSection', 'ListSummary', 'MediaTray', 'ImagePicker',
  'Button', 'FAB',
]

it.each(COMPONENT_NAMES_V0)(
  'T-0010-027: all 28 V0 component names still appear in catalog — "%s"',
  (componentName) => {
    expect(SYSTEM_PROMPT_CATALOG).toContain(componentName)
  },
)

// ─── T-0010-028 — Regression ──────────────────────────────────────────────
const ACTION_VERB_NAMES_V0 = [
  'set', 'update', 'reset', 'addItem', 'removeItem', 'updateItem',
  'clearCollection', 'navigate', 'back', 'capture', 'toast', 'aiProcess',
]

it.each(ACTION_VERB_NAMES_V0)(
  'T-0010-028: all 12 V0 action verb names still appear in catalog — "%s"',
  (verbName) => {
    expect(SYSTEM_PROMPT_CATALOG).toContain(verbName)
  },
)

// ─── T-0010-029 — Regression ──────────────────────────────────────────────
const OOS_CAPABILITIES_V0 = ['image_gen', 'vision', 'chat', 'transcription', 'classification']

it.each(OOS_CAPABILITIES_V0)(
  'T-0010-029: all 5 OOS capabilities still appear in catalog — "%s"',
  (capability) => {
    expect(SYSTEM_PROMPT_CATALOG).toContain(capability)
  },
)

// ─── T-0010-030 — Regression ──────────────────────────────────────────────
const ARCHETYPES_V0 = ['ListCRUD', 'Tracker', 'Journal', 'Calculator']

it.each(ARCHETYPES_V0)(
  'T-0010-030: all 4 V0 archetype names still appear in catalog — "%s"',
  (archetype) => {
    expect(SYSTEM_PROMPT_CATALOG).toContain(archetype)
  },
)

// ─── T-0010-031 — Breaking change ─────────────────────────────────────────
// ADR-0009 Step 10: MoneyField IS now a documented V1 catalog component.
// The breaking-change guard is now that MoneyField appears in the V1 section,
// NOT in the V0 Component Catalog (28 components) section.
// The static block still must not reference MoneyField as an always-available V0 component.
it('T-0010-031: MoneyField appears in the V1 catalog section (not as a V0 component)', () => {
  // V1 catalog section must document MoneyField.
  expect(SYSTEM_PROMPT_CATALOG).toContain('### MoneyField')
  // The V0 28-component section header must not claim MoneyField is a V0 component.
  const v0SectionEnd = SYSTEM_PROMPT_CATALOG.indexOf('## V1 Component Catalog')
  const v0Section = v0SectionEnd !== -1
    ? SYSTEM_PROMPT_CATALOG.slice(0, v0SectionEnd)
    : SYSTEM_PROMPT_CATALOG
  expect(v0Section).not.toContain('### MoneyField')
  // Static block should not independently document MoneyField as a V0 rule.
  expect(SYSTEM_PROMPT_STATIC).not.toContain('### MoneyField')
})

// ─── T-0010-032 — Happy ───────────────────────────────────────────────────
it('T-0010-032: PROMPT_VERSION is exported alongside SYSTEM_PROMPT_STATIC and SYSTEM_PROMPT_CATALOG', () => {
  // Verify all three exports are accessible from the module
  expect(typeof PROMPT_VERSION).toBe('string')
  expect(typeof SYSTEM_PROMPT_STATIC).toBe('string')
  expect(typeof SYSTEM_PROMPT_CATALOG).toBe('string')
  expect(PROMPT_VERSION.length).toBeGreaterThan(0)
})

// =============================================================================
// ADR-0009 Step 10 — V1 Catalog Tests (T-0009-213 through T-0009-220)
// =============================================================================

// ─── T-0009-213 — Happy ───────────────────────────────────────────────────
const ALL_53_COMPONENTS = [
  // V0 — 28 components
  'Screen', 'Section', 'Stack', 'Row', 'Card',
  'Heading', 'Body', 'Caption',
  'TextField', 'NumberField', 'DateField', 'Picker', 'Switch',
  'Stat', 'Badge', 'Chip', 'Avatar',
  'List', 'ListItem', 'SwipeableRow', 'EmptyState', 'LoadingState',
  'ConditionalSection', 'ListSummary', 'MediaTray', 'ImagePicker',
  'Button', 'FAB',
  // V1 — 25 components
  'Divider', 'Image', 'IconButton',
  'MoneyField', 'TimeField', 'MultiPicker', 'Slider', 'RatingInput', 'SearchBar',
  'AvatarGroup', 'Callout',
  'GridList', 'Carousel', 'Timeline', 'ErrorState',
  'TransactionRow', 'Receipt', 'MetricTile', 'StepList',
  'Calendar', 'Heatmap',
  'Gallery', 'CommerceCard', 'BeforeAfter', 'DocumentPicker',
]

it.each(ALL_53_COMPONENTS)(
  'T-0009-213: SYSTEM_PROMPT_CATALOG mentions all 53 component names — "%s"',
  (componentName) => {
    expect(SYSTEM_PROMPT_CATALOG).toContain(componentName)
  },
)

// ─── T-0009-214 — Happy ───────────────────────────────────────────────────
it('T-0009-214: catalog includes stance affinity cheat-sheet section', () => {
  expect(SYSTEM_PROMPT_CATALOG).toContain('Stance Affinity Cheat-Sheet')
  // Must mention both stances explicitly
  const stanceSection = (() => {
    const start = SYSTEM_PROMPT_CATALOG.indexOf('Stance Affinity Cheat-Sheet')
    const end = SYSTEM_PROMPT_CATALOG.indexOf('\n---', start)
    return end !== -1
      ? SYSTEM_PROMPT_CATALOG.slice(start, end)
      : SYSTEM_PROMPT_CATALOG.slice(start, start + 2000)
  })()
  expect(stanceSection).toContain('Productive stance')
  expect(stanceSection).toContain('Expressive stance')
})

// ─── T-0009-215 — Happy ───────────────────────────────────────────────────
it('T-0009-215: catalog includes domain compound usage hints (TransactionRow, MetricTile, Calendar)', () => {
  expect(SYSTEM_PROMPT_CATALOG).toContain('Domain Compound Usage Hints')
  const hintsSection = (() => {
    const start = SYSTEM_PROMPT_CATALOG.indexOf('Domain Compound Usage Hints')
    const end = SYSTEM_PROMPT_CATALOG.indexOf('\n---', start)
    return end !== -1
      ? SYSTEM_PROMPT_CATALOG.slice(start, end)
      : SYSTEM_PROMPT_CATALOG.slice(start, start + 3000)
  })()
  expect(hintsSection).toContain('TransactionRow')
  expect(hintsSection).toContain('MetricTile')
  expect(hintsSection).toContain('Calendar')
})

// ─── T-0009-216 — Happy ───────────────────────────────────────────────────
it('T-0009-216: catalog includes re-prompt continuity instruction', () => {
  expect(SYSTEM_PROMPT_CATALOG).toContain('Re-Prompt Continuity')
  const continuitySection = (() => {
    const start = SYSTEM_PROMPT_CATALOG.indexOf('Re-Prompt Continuity')
    return SYSTEM_PROMPT_CATALOG.slice(start, start + 1000)
  })()
  // Must instruct on what NOT to do on re-prompts
  expect(continuitySection.toLowerCase()).toMatch(/do not|don't/)
})

// ─── T-0009-217 — Boundary ────────────────────────────────────────────────
it('T-0009-217: SYSTEM_PROMPT_CATALOG.length <= 40000 chars (~10000 tokens)', () => {
  expect(SYSTEM_PROMPT_CATALOG.length).toBeLessThanOrEqual(40_000)
})

// ─── T-0009-218 — Boundary (tool JSON Schema — see produceAppSpec.test.ts) ──
// Verified by produceAppSpec.test.ts T-0007-018. The ADR target was 40,000 chars;
// the measured V1 schema is ~42,245 chars; the actual gate is 50,000 chars.
// T-0009-218 is the ADR reference; produceAppSpec.test.ts carries the assertion.

// ─── T-0009-219 — Regression ──────────────────────────────────────────────
it('T-0009-219: T-0007-022..026 regression — archetypes, components, verbs, bindings, capabilities', () => {
  const archetypes = ['ListCRUD', 'Tracker', 'Journal', 'Calculator']
  for (const a of archetypes) {
    expect(SYSTEM_PROMPT_CATALOG).toContain(a)
  }
  const v0Components = [
    'Screen', 'Section', 'Stack', 'Row', 'Card', 'Heading', 'Body', 'Caption',
    'TextField', 'NumberField', 'DateField', 'Picker', 'Switch',
    'Stat', 'Badge', 'Chip', 'Avatar',
    'List', 'ListItem', 'SwipeableRow', 'EmptyState', 'LoadingState',
    'ConditionalSection', 'ListSummary', 'MediaTray', 'ImagePicker', 'Button', 'FAB',
  ]
  for (const c of v0Components) {
    expect(SYSTEM_PROMPT_CATALOG).toContain(c)
  }
  const verbs = ['set', 'update', 'reset', 'addItem', 'removeItem', 'updateItem',
    'clearCollection', 'navigate', 'back', 'capture', 'toast', 'aiProcess']
  for (const v of verbs) {
    expect(SYSTEM_PROMPT_CATALOG).toContain(v)
  }
  const bindings = ['literal', 'state', 'collectionField', 'image', 'date']
  for (const b of bindings) {
    expect(SYSTEM_PROMPT_CATALOG).toContain(b)
  }
  const capabilities = ['image_gen', 'vision', 'chat', 'transcription', 'classification']
  for (const cap of capabilities) {
    expect(SYSTEM_PROMPT_CATALOG).toContain(cap)
  }
})

// ─── T-0009-220 — Failure (M1-only names absent, Image correctly present) ──
const M1_ONLY_ABSENT = ['Container', 'Counter', 'Toggle', 'TextInput', 'Form']

it.each(M1_ONLY_ABSENT)(
  'T-0009-220: catalog does NOT contain M1-only component name "%s"',
  (m1Name) => {
    // Check catalog without examples section to avoid false positives
    const catalogWithoutExamples = SYSTEM_PROMPT_CATALOG.split('## Examples')[0] ?? SYSTEM_PROMPT_CATALOG
    expect(catalogWithoutExamples).not.toContain(m1Name)
  },
)

it('T-0009-220b: catalog DOES contain "Image" (V1 Image component is real)', () => {
  expect(SYSTEM_PROMPT_CATALOG).toContain('Image')
})

it('T-0009-220c: catalog does NOT contain "M1 catalog" or "M1-only" substring', () => {
  expect(SYSTEM_PROMPT_CATALOG).not.toContain('M1 catalog')
  expect(SYSTEM_PROMPT_CATALOG).not.toContain('M1-only')
})
