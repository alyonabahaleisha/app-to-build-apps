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

import {
  ValidationError,
  deepValidateSpec,
  validateActionTargets,
  validateMaxDepth,
  validateNavigateTargets,
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
