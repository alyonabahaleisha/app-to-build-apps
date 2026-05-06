import {PlanSchema, PlanEditIntentSchema, PLAN_VERSION} from './plan.js'
import {PlanSchema as PlanSchemaFromIndex} from './index.js'

// Minimal valid plan used as a base for most tests.
const VALID_PLAN = {
  version: PLAN_VERSION,
  archetype: 'Calculator',
  screens: [
    {
      id: 'main',
      role: 'home',
      purpose: 'enter inputs',
      key_components: ['Form', 'Button'],
    },
  ],
  navigation: 'none',
} as const

describe('PlanSchema', () => {
  // T-0004-001
  it('parses a minimal valid plan and returns the same shape', () => {
    const result = PlanSchema.parse(VALID_PLAN)
    expect(result).toEqual(VALID_PLAN)
  })

  // T-0004-002
  it('parses a plan with 4 screens and navigation tabs+stack', () => {
    const plan = {
      version: PLAN_VERSION,
      archetype: 'Dashboard',
      screens: [
        {id: 'home', role: 'home', purpose: 'overview', key_components: ['Heading']},
        {id: 'detail', role: 'detail', purpose: 'details', key_components: ['Text']},
        {id: 'settings', role: 'settings', purpose: 'configure', key_components: ['Toggle']},
        {id: 'profile', role: 'profile', purpose: 'user info', key_components: ['Image']},
      ],
      navigation: 'tabs+stack',
    }
    expect(() => PlanSchema.parse(plan)).not.toThrow()
  })

  // T-0004-003
  it('parses a plan with edit_intent containing a valid target path', () => {
    const plan = {
      ...VALID_PLAN,
      edit_intent: {target_paths: ['/views/0/root/children/2']},
    }
    expect(() => PlanSchema.parse(plan)).not.toThrow()
  })

  // T-0004-004
  it('fails when archetype has a typo — closed enum, path [archetype]', () => {
    const plan = {...VALID_PLAN, archetype: 'Calculatr'}
    let error: unknown
    try {
      PlanSchema.parse(plan)
    } catch (e) {
      error = e
    }
    expect(error).toBeDefined()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const issues = (error as any).issues
    expect(issues.some((i: {path: string[]}) => i.path[0] === 'archetype')).toBe(true)
  })

  // T-0004-005
  it('fails when archetype is "Game" (not canonical "SimpleGame") — closed enum', () => {
    const plan = {...VALID_PLAN, archetype: 'Game'}
    expect(() => PlanSchema.parse(plan)).toThrow()
  })

  // T-0004-006
  it('fails when screens array is empty (min 1)', () => {
    const plan = {...VALID_PLAN, screens: []}
    expect(() => PlanSchema.parse(plan)).toThrow()
  })

  // T-0004-007
  it('fails when screens length is 5 (max 4)', () => {
    const screen = {id: 'a', role: 'r', purpose: 'p', key_components: ['X']}
    const plan = {
      version: PLAN_VERSION,
      archetype: 'Dashboard',
      screens: [
        {...screen, id: 'a'},
        {...screen, id: 'b'},
        {...screen, id: 'c'},
        {...screen, id: 'd'},
        {...screen, id: 'e'},
      ],
      navigation: 'tabs',
    }
    expect(() => PlanSchema.parse(plan)).toThrow()
  })

  // T-0004-008
  it('fails when navigation is "sidebar" (closed enum)', () => {
    const plan = {
      version: PLAN_VERSION,
      archetype: 'Dashboard',
      screens: [
        {id: 'home', role: 'r', purpose: 'p', key_components: ['X']},
        {id: 'detail', role: 'r', purpose: 'p', key_components: ['X']},
      ],
      navigation: 'sidebar',
    }
    expect(() => PlanSchema.parse(plan)).toThrow()
  })

  // T-0004-009
  it('fails when screens have duplicate ids (superRefine)', () => {
    const plan = {
      version: PLAN_VERSION,
      archetype: 'Dashboard',
      screens: [
        {id: 'home', role: 'r', purpose: 'p', key_components: ['X']},
        {id: 'home', role: 'r', purpose: 'p', key_components: ['Y']},
      ],
      navigation: 'stack',
    }
    expect(() => PlanSchema.parse(plan)).toThrow(/screen ids must be unique/)
  })

  // T-0004-010
  it('fails when navigation is "none" with 2 screens (superRefine)', () => {
    const plan = {
      version: PLAN_VERSION,
      archetype: 'Dashboard',
      screens: [
        {id: 'home', role: 'r', purpose: 'p', key_components: ['X']},
        {id: 'detail', role: 'r', purpose: 'p', key_components: ['Y']},
      ],
      navigation: 'none',
    }
    expect(() => PlanSchema.parse(plan)).toThrow(/navigation 'none' requires exactly one screen/)
  })

  // T-0004-011
  it('fails when screen id contains uppercase letters', () => {
    const plan = {...VALID_PLAN, screens: [{...VALID_PLAN.screens[0], id: 'Main'}]}
    expect(() => PlanSchema.parse(plan)).toThrow()
  })

  // T-0004-012
  it('fails when screen id starts with a digit', () => {
    const plan = {...VALID_PLAN, screens: [{...VALID_PLAN.screens[0], id: '1main'}]}
    expect(() => PlanSchema.parse(plan)).toThrow()
  })

  // T-0004-013
  it('allows screen id of length 32; rejects length 33', () => {
    // Length 32: 1 leading letter + 31 trailing chars
    const id32 = 'a' + 'b'.repeat(31)
    const id33 = 'a' + 'b'.repeat(32)

    const validPlan = {...VALID_PLAN, screens: [{...VALID_PLAN.screens[0], id: id32}]}
    expect(() => PlanSchema.parse(validPlan)).not.toThrow()

    const invalidPlan = {...VALID_PLAN, screens: [{...VALID_PLAN.screens[0], id: id33}]}
    expect(() => PlanSchema.parse(invalidPlan)).toThrow()
  })

  // T-0004-014
  it('allows purpose of length 200; rejects length 201', () => {
    const purpose200 = 'x'.repeat(200)
    const purpose201 = 'x'.repeat(201)

    const validPlan = {...VALID_PLAN, screens: [{...VALID_PLAN.screens[0], purpose: purpose200}]}
    expect(() => PlanSchema.parse(validPlan)).not.toThrow()

    const invalidPlan = {...VALID_PLAN, screens: [{...VALID_PLAN.screens[0], purpose: purpose201}]}
    expect(() => PlanSchema.parse(invalidPlan)).toThrow()
  })

  // T-0004-015
  it('allows key_components length 8; rejects length 9', () => {
    const components8 = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
    const components9 = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']

    const validPlan = {
      ...VALID_PLAN,
      screens: [{...VALID_PLAN.screens[0], key_components: components8}],
    }
    expect(() => PlanSchema.parse(validPlan)).not.toThrow()

    const invalidPlan = {
      ...VALID_PLAN,
      screens: [{...VALID_PLAN.screens[0], key_components: components9}],
    }
    expect(() => PlanSchema.parse(invalidPlan)).toThrow()
  })

  // T-0004-016
  it('allows edit_intent.target_paths length 20; rejects length 21', () => {
    const paths20 = Array.from({length: 20}, (_, i) => `/views/${i}`)
    const paths21 = Array.from({length: 21}, (_, i) => `/views/${i}`)

    const validPlan = {...VALID_PLAN, edit_intent: {target_paths: paths20}}
    expect(() => PlanSchema.parse(validPlan)).not.toThrow()

    const invalidPlan = {...VALID_PLAN, edit_intent: {target_paths: paths21}}
    expect(() => PlanSchema.parse(invalidPlan)).toThrow()
  })

  // T-0004-017
  it('fails when edit_intent.target_paths entry lacks a leading slash', () => {
    const plan = {...VALID_PLAN, edit_intent: {target_paths: ['views/0']}}
    expect(() => PlanSchema.parse(plan)).toThrow()
  })

  // T-0004-019
  it('strips unknown extra keys silently (Zod default strip mode protects against LLM bonus fields)', () => {
    const planWithExtras = {
      ...VALID_PLAN,
      unexpected_llm_field: 'should be stripped',
      screens: [
        {
          ...VALID_PLAN.screens[0],
          bonus: 'also stripped',
        },
      ],
    }
    // Should not throw; the extra keys should be stripped from the result.
    let result: unknown
    expect(() => {
      result = PlanSchema.parse(planWithExtras)
    }).not.toThrow()
    expect((result as Record<string, unknown>)['unexpected_llm_field']).toBeUndefined()
  })

  // T-0004-020
  it('PlanSchema imported from index.ts resolves and parses the same valid plan', () => {
    expect(() => PlanSchemaFromIndex.parse(VALID_PLAN)).not.toThrow()
  })

  // T-0004-117 (rev-1)
  it('allows screen role of length 40; rejects length 41', () => {
    const role40 = 'r'.repeat(40)
    const role41 = 'r'.repeat(41)

    const validPlan = {...VALID_PLAN, screens: [{...VALID_PLAN.screens[0], role: role40}]}
    expect(() => PlanSchema.parse(validPlan)).not.toThrow()

    const invalidPlan = {...VALID_PLAN, screens: [{...VALID_PLAN.screens[0], role: role41}]}
    expect(() => PlanSchema.parse(invalidPlan)).toThrow()
  })

  // T-0004-118 (rev-1)
  it('fails when key_components contains an empty-string element (element-level .min(1))', () => {
    const plan = {
      ...VALID_PLAN,
      screens: [{...VALID_PLAN.screens[0], key_components: ['']}],
    }
    expect(() => PlanSchema.parse(plan)).toThrow()
  })
})

describe('PlanEditIntentSchema', () => {
  // T-0004-119 (rev-1) — schema-level test for root-pointer rejection
  it('rejects root-only pointer "/" — would disable scope guard', () => {
    expect(() => PlanEditIntentSchema.parse({target_paths: ['/']})).toThrow(
      /root pointer disables scope guard/,
    )
  })
})
