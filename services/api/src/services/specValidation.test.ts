/**
 * Deep validation unit tests — pure-Node, no DB.
 *
 * Three layers of validation that Zod alone cannot enforce:
 *  - validateActionTargets: every set/increment/decrement.targetId must
 *    reference an input/Counter/Toggle id present somewhere in the spec.
 *  - validateNavigateTargets: every navigate(viewId) must reference an
 *    existing views[i].id.
 *  - validateMaxDepth: no path may exceed 8 levels of nesting (per
 *    ARCHITECTURE.md §6 / ADR-0001 T-0001-131).
 *
 * Test IDs covered here are nested under the broader Step 4 IDs:
 *  - T-0001-130 (unresolved targetId)
 *  - T-0001-131 (depth > 8)
 *  - T-0001-138 (unresolved view id)
 * The service-layer tests assert these errors propagate without DB writes;
 * here we assert the validators themselves.
 */
import {A2UI_VERSION, type A2UISpec} from '@app-creator/a2ui-schema'
import type {Plan} from '@app-creator/a2ui-schema'

import {
  ValidationError,
  deepValidateSpec,
  validateActionTargets,
  validateMaxDepth,
  validateNavigateTargets,
  validatePlanConformance,
} from './specValidation.js'

describe('specValidation', () => {
  describe('validateActionTargets', () => {
    it('passes when a Button.set targets an existing TextInput id', () => {
      const spec: A2UISpec = {
        version: A2UI_VERSION,
        initialViewId: 'main',
        views: [
          {
            id: 'main',
            root: {
              type: 'Container',
              direction: 'column',
              children: [
                {type: 'TextInput', id: 'name', label: 'Name'},
                {
                  type: 'Button',
                  label: 'Reset',
                  action: {type: 'set', targetId: 'name', value: ''},
                },
              ],
            },
          },
        ],
      }
      expect(() => validateActionTargets(spec)).not.toThrow()
    })

    it('passes when an action targets a Counter or Toggle id', () => {
      const spec: A2UISpec = {
        version: A2UI_VERSION,
        initialViewId: 'main',
        views: [
          {
            id: 'main',
            root: {
              type: 'Container',
              direction: 'column',
              children: [
                {type: 'Counter', id: 'qty', label: 'Quantity'},
                {type: 'Toggle', id: 'agree', label: 'Agree'},
                {
                  type: 'Button',
                  label: 'Bump',
                  action: {type: 'increment', targetId: 'qty', by: 1},
                },
                {
                  type: 'Button',
                  label: 'Drop',
                  action: {type: 'decrement', targetId: 'qty'},
                },
                {
                  type: 'Button',
                  label: 'Off',
                  action: {type: 'set', targetId: 'agree', value: false},
                },
              ],
            },
          },
        ],
      }
      expect(() => validateActionTargets(spec)).not.toThrow()
    })

    it('throws ValidationError({code: unresolved_target_id}) when set targets a missing id', () => {
      const spec: A2UISpec = {
        version: A2UI_VERSION,
        initialViewId: 'main',
        views: [
          {
            id: 'main',
            root: {
              type: 'Button',
              label: 'Go',
              action: {type: 'set', targetId: 'nope', value: 'x'},
            },
          },
        ],
      }
      try {
        validateActionTargets(spec)
        throw new Error('expected throw')
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError)
        expect((err as ValidationError).code).toBe('unresolved_target_id')
        expect((err as ValidationError).detail).toBe('nope')
      }
    })

    it('ignores toast/navigate actions (they have no targetId)', () => {
      const spec: A2UISpec = {
        version: A2UI_VERSION,
        initialViewId: 'main',
        views: [
          {
            id: 'main',
            root: {
              type: 'Container',
              direction: 'column',
              children: [
                {
                  type: 'Button',
                  label: 'Greet',
                  action: {type: 'toast', message: 'hi'},
                },
              ],
            },
          },
        ],
      }
      expect(() => validateActionTargets(spec)).not.toThrow()
    })

    it('walks Form.fields and Form.submitAction', () => {
      const spec: A2UISpec = {
        version: A2UI_VERSION,
        initialViewId: 'main',
        views: [
          {
            id: 'main',
            root: {
              type: 'Form',
              formId: 'login',
              fields: [{type: 'TextInput', id: 'email', label: 'Email'}],
              submitAction: {type: 'set', targetId: 'email', value: 'x'},
            },
          },
        ],
      }
      expect(() => validateActionTargets(spec)).not.toThrow()
    })
  })

  describe('validateNavigateTargets', () => {
    it('passes when navigate.viewId matches an existing view', () => {
      const spec: A2UISpec = {
        version: A2UI_VERSION,
        initialViewId: 'home',
        views: [
          {
            id: 'home',
            root: {
              type: 'Button',
              label: 'Open settings',
              action: {type: 'navigate', viewId: 'settings'},
            },
          },
          {id: 'settings', root: {type: 'Heading', text: 'Settings'}},
        ],
      }
      expect(() => validateNavigateTargets(spec)).not.toThrow()
    })

    it('throws ValidationError({code: unresolved_view_id}) for an unknown viewId', () => {
      const spec: A2UISpec = {
        version: A2UI_VERSION,
        initialViewId: 'home',
        views: [
          {
            id: 'home',
            root: {
              type: 'Form',
              formId: 'f',
              fields: [],
              submitAction: {type: 'navigate', viewId: 'unknown'},
            },
          },
        ],
      }
      try {
        validateNavigateTargets(spec)
        throw new Error('expected throw')
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError)
        expect((err as ValidationError).code).toBe('unresolved_view_id')
        expect((err as ValidationError).detail).toBe('unknown')
      }
    })
  })

  describe('validateMaxDepth', () => {
    /** Build a Container chain of `levels` deep, each Container holding a Heading at the leaf. */
    function nest(levels: number): A2UISpec {
      type Node = A2UISpec['views'][number]['root']
      let node: Node = {type: 'Heading', text: 'leaf'}
      // levels=1 means root is the Heading (1 level deep). levels=2 wraps it in
      // one Container, etc. The root itself counts as level 1.
      for (let i = 1; i < levels; i++) {
        node = {type: 'Container', direction: 'column', children: [node]}
      }
      return {
        version: A2UI_VERSION,
        initialViewId: 'main',
        views: [{id: 'main', root: node}],
      }
    }

    it('accepts a spec at exactly 8 levels', () => {
      expect(() => validateMaxDepth(nest(8))).not.toThrow()
    })

    it('rejects a spec at 9 levels with code: max_depth_exceeded', () => {
      try {
        validateMaxDepth(nest(9))
        throw new Error('expected throw')
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError)
        expect((err as ValidationError).code).toBe('max_depth_exceeded')
      }
    })

    it('walks List.items as a depth-increasing edge', () => {
      // root List → List → ... 8 levels passes; 9 throws.
      type Node = A2UISpec['views'][number]['root']
      const heading: Node = {type: 'Heading', text: 'leaf'}
      let node: Node = heading
      for (let i = 1; i < 9; i++) node = {type: 'List', items: [node]}
      const tooDeep: A2UISpec = {
        version: A2UI_VERSION,
        initialViewId: 'main',
        views: [{id: 'main', root: node}],
      }
      try {
        validateMaxDepth(tooDeep)
        throw new Error('expected throw')
      } catch (err) {
        expect((err as ValidationError).code).toBe('max_depth_exceeded')
      }
    })
  })

  describe('deepValidateSpec', () => {
    it('runs all three validators and short-circuits on the first failure', () => {
      const spec: A2UISpec = {
        version: A2UI_VERSION,
        initialViewId: 'main',
        views: [
          {
            id: 'main',
            root: {
              type: 'Button',
              label: 'Bad',
              action: {type: 'set', targetId: 'ghost', value: 1},
            },
          },
        ],
      }
      try {
        deepValidateSpec(spec)
        throw new Error('expected throw')
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError)
        expect((err as ValidationError).code).toBe('unresolved_target_id')
      }
    })

    it('passes for a fully valid spec', () => {
      const spec: A2UISpec = {
        version: A2UI_VERSION,
        initialViewId: 'main',
        views: [
          {
            id: 'main',
            root: {
              type: 'Container',
              direction: 'column',
              children: [
                {type: 'Heading', text: 'Hello'},
                {type: 'TextInput', id: 'name', label: 'Name'},
                {
                  type: 'Button',
                  label: 'Clear',
                  action: {type: 'set', targetId: 'name', value: ''},
                },
              ],
            },
          },
        ],
      }
      expect(() => deepValidateSpec(spec)).not.toThrow()
    })
  })
})

// ---------------------------------------------------------------------------
// validatePlanConformance — T-0004-043 through T-0004-050
// ---------------------------------------------------------------------------

/** Minimal single-screen plan for conformance tests. */
const SINGLE_SCREEN_PLAN: Plan = {
  version: 1,
  archetype: 'Calculator',
  screens: [{id: 'main', role: 'home', purpose: 'calculate', key_components: ['Button']}],
  navigation: 'none',
}

/** Two-screen plan for conformance tests. */
const TWO_SCREEN_PLAN: Plan = {
  version: 1,
  archetype: 'ListCRUD',
  screens: [
    {id: 'list', role: 'home', purpose: 'show list', key_components: ['List']},
    {id: 'detail', role: 'detail', purpose: 'show detail', key_components: ['Text']},
  ],
  navigation: 'stack',
}

function makeSpec(
  viewIds: string[],
  initialViewId: string,
  rootOverride?: A2UISpec['views'][number]['root'],
): A2UISpec {
  return {
    version: A2UI_VERSION,
    initialViewId,
    views: viewIds.map((id, i) => ({
      id,
      root: i === 0 && rootOverride ? rootOverride : {type: 'Heading', text: id},
    })),
  }
}

describe('validatePlanConformance', () => {
  // T-0004-043: spec has fewer views than plan screens
  it('T-0004-043: returns view_count_mismatch when spec has fewer views than plan screens', () => {
    const spec = makeSpec(['list'], 'list') // 1 view, plan expects 2
    const result = validatePlanConformance(spec, TWO_SCREEN_PLAN)
    expect(result).toEqual({ok: false, reason: 'view_count_mismatch'})
  })

  // T-0004-044: spec has more views than plan screens
  it('T-0004-044: returns view_count_mismatch when spec has more views than plan screens', () => {
    const spec = makeSpec(['main', 'extra'], 'main') // 2 views, plan expects 1
    const result = validatePlanConformance(spec, SINGLE_SCREEN_PLAN)
    expect(result).toEqual({ok: false, reason: 'view_count_mismatch'})
  })

  // T-0004-045: view ids don't match plan screen ids
  it('T-0004-045: returns view_id_mismatch when a plan screen id is absent from spec view ids', () => {
    // Plan expects 'list' and 'detail'; spec has 'list' and 'wrong_id'
    const spec = makeSpec(['list', 'wrong_id'], 'list')
    const result = validatePlanConformance(spec, TWO_SCREEN_PLAN)
    expect(result).toEqual({ok: false, reason: 'view_id_mismatch:detail'})
  })

  // T-0004-046: initialViewId doesn't match plan.screens[0].id
  it('T-0004-046: returns initial_view_mismatch when spec.initialViewId does not match plan.screens[0].id', () => {
    // Plan says initial should be 'list'; spec sets initial to 'detail'
    const spec = makeSpec(['list', 'detail'], 'detail')
    const result = validatePlanConformance(spec, TWO_SCREEN_PLAN)
    expect(result).toEqual({ok: false, reason: 'initial_view_mismatch'})
  })

  // T-0004-047: navigate action buried deep inside nested Containers
  it('T-0004-047: returns navigation_violation when navigate action is buried inside nested Containers', () => {
    // Navigate action inside Container.children[3] inside Container.children[1]
    // to prove the walker recurses correctly through nested containers.
    const deepNavigate: A2UISpec['views'][number]['root'] = {
      type: 'Container',
      direction: 'column',
      children: [
        {type: 'Heading', text: 'Top'},
        {
          type: 'Container',
          direction: 'row',
          children: [
            {type: 'Text', text: 'a'},
            {type: 'Text', text: 'b'},
            {type: 'Text', text: 'c'},
            {
              // Container.children[3] — the navigate is here
              type: 'Button',
              label: 'Go',
              action: {type: 'navigate', viewId: 'main'},
            },
          ],
        },
      ],
    }
    const spec: A2UISpec = {
      version: A2UI_VERSION,
      initialViewId: 'main',
      views: [{id: 'main', root: deepNavigate}],
    }
    const result = validatePlanConformance(spec, SINGLE_SCREEN_PLAN)
    expect(result).toEqual({ok: false, reason: 'navigation_violation'})
  })

  // T-0004-047b: navigation_violation when navigate is buried inside List.items
  it('T-0004-047b: returns navigation_violation when navigate action is buried inside List.items', () => {
    // List.items contains a Container whose children contains a Button with navigate.
    const listWithNavigate: A2UISpec['views'][number]['root'] = {
      type: 'List',
      items: [
        {type: 'Text', text: 'Entry 1'},
        {
          type: 'Container',
          direction: 'row',
          children: [
            {type: 'Text', text: 'Entry 2'},
            {
              type: 'Button',
              label: 'Open',
              action: {type: 'navigate', viewId: 'main'},
            },
          ],
        },
      ],
    }
    const spec: A2UISpec = {
      version: A2UI_VERSION,
      initialViewId: 'main',
      views: [{id: 'main', root: listWithNavigate}],
    }
    const result = validatePlanConformance(spec, SINGLE_SCREEN_PLAN)
    expect(result).toEqual({ok: false, reason: 'navigation_violation'})
  })

  // T-0004-047c: navigation_violation when navigate is buried inside Form.fields
  it('T-0004-047c: returns navigation_violation when navigate action is buried inside Form.fields', () => {
    // Form.fields contains a Button with a navigate action.
    // Button is not a typical field type but the walker must recurse defensively.
    const formWithNavigate: A2UISpec['views'][number]['root'] = {
      type: 'Form',
      formId: 'f1',
      fields: [
        {type: 'TextInput', id: 'q', label: 'Query'},
        // Button in fields — walker must recurse and detect the navigate action.
        {
          type: 'Button',
          label: 'Cancel',
          action: {type: 'navigate', viewId: 'main'},
        } as unknown as A2UISpec['views'][number]['root'],
      ] as A2UISpec['views'][number]['root'][],
    }
    const spec: A2UISpec = {
      version: A2UI_VERSION,
      initialViewId: 'main',
      views: [{id: 'main', root: formWithNavigate}],
    }
    const result = validatePlanConformance(spec, SINGLE_SCREEN_PLAN)
    expect(result).toEqual({ok: false, reason: 'navigation_violation'})
  })

  // T-0004-050: happy path — single view, single screen, nav 'none', zero navigates
  it('T-0004-050: returns ok:true for a single-view spec matching a single-screen none-nav plan', () => {
    const spec = makeSpec(['main'], 'main')
    const result = validatePlanConformance(spec, SINGLE_SCREEN_PLAN)
    expect(result).toEqual({ok: true})
  })

  // Additional happy path: two-screen plan fully satisfied
  it('returns ok:true for a two-screen spec that matches a stack-nav plan', () => {
    const root: A2UISpec['views'][number]['root'] = {
      type: 'Button',
      label: 'Go to detail',
      action: {type: 'navigate', viewId: 'detail'},
    }
    const spec: A2UISpec = {
      version: A2UI_VERSION,
      initialViewId: 'list',
      views: [
        {id: 'list', root},
        {id: 'detail', root: {type: 'Heading', text: 'Detail'}},
      ],
    }
    const result = validatePlanConformance(spec, TWO_SCREEN_PLAN)
    expect(result).toEqual({ok: true})
  })

  // navigation_violation via Form.submitAction
  it('returns navigation_violation when Form.submitAction is a navigate and plan.navigation is none', () => {
    const spec: A2UISpec = {
      version: A2UI_VERSION,
      initialViewId: 'main',
      views: [
        {
          id: 'main',
          root: {
            type: 'Form',
            formId: 'f',
            fields: [{type: 'TextInput', id: 'q', label: 'Q'}],
            submitAction: {type: 'navigate', viewId: 'main'},
          },
        },
      ],
    }
    const result = validatePlanConformance(spec, SINGLE_SCREEN_PLAN)
    expect(result).toEqual({ok: false, reason: 'navigation_violation'})
  })
})
