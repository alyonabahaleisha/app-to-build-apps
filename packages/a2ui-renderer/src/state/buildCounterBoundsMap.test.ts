/**
 * Unit tests for buildCounterBoundsMap — Step 5 Note 2 + Note 3 cleanup.
 *
 * Roz Step 5 QA Note 2: List.item walk and Form.field walk branches were
 * uncovered in the step integration tests. buildCounterBoundsMap is exported
 * from useA2UIState.ts; these three tests directly exercise:
 *
 *   (a) Counter inside List items
 *   (b) Counter inside Form fields
 *   (c) Counter nested 3 levels deep: Container > Container > Form > Counter
 *       (closes Note 3 — deep-nesting recursion)
 *
 * Each asserts the returned Map has the Counter's id as a key with the
 * correct {min, max, step} shape.
 */
import type {A2UISpec} from '@app-creator/a2ui-schema'

import {buildCounterBoundsMap} from './useA2UIState'

// -- (a) Counter inside List items -------------------------------------------

describe('buildCounterBoundsMap — Counter inside List items', () => {
  it('finds a Counter nested directly inside a List.items array', () => {
    const spec: A2UISpec = {
      version: 1,
      views: [
        {
          id: 'main',
          root: {
            type: 'List',
            items: [
              {type: 'Counter', id: 'qty', label: 'Quantity', min: 0, max: 99, step: 1},
            ],
          },
        },
      ],
      initialViewId: 'main',
    }

    const map = buildCounterBoundsMap(spec)

    expect(map.has('qty')).toBe(true)
    const bounds = map.get('qty')
    expect(bounds).toEqual({min: 0, max: 99, step: 1})
  })

  it('finds multiple Counters across List items', () => {
    const spec: A2UISpec = {
      version: 1,
      views: [
        {
          id: 'main',
          root: {
            type: 'List',
            items: [
              {type: 'Counter', id: 'a', label: 'A', min: 1, max: 5},
              {type: 'Counter', id: 'b', label: 'B', min: 0, max: 10, step: 2},
            ],
          },
        },
      ],
      initialViewId: 'main',
    }

    const map = buildCounterBoundsMap(spec)

    expect(map.has('a')).toBe(true)
    expect(map.get('a')).toEqual({min: 1, max: 5, step: undefined})
    expect(map.has('b')).toBe(true)
    expect(map.get('b')).toEqual({min: 0, max: 10, step: 2})
  })
})

// -- (b) Counter inside Form fields ------------------------------------------

describe('buildCounterBoundsMap — Counter inside Form fields', () => {
  it('finds a Counter nested directly inside a Form.fields array', () => {
    const spec: A2UISpec = {
      version: 1,
      views: [
        {
          id: 'main',
          root: {
            type: 'Form',
            formId: 'checkout',
            fields: [
              {type: 'Counter', id: 'guests', label: 'Guests', min: 1, max: 20, step: 1},
            ],
          },
        },
      ],
      initialViewId: 'main',
    }

    const map = buildCounterBoundsMap(spec)

    expect(map.has('guests')).toBe(true)
    expect(map.get('guests')).toEqual({min: 1, max: 20, step: 1})
  })

  it('finds Counter alongside TextInput and Toggle in Form.fields', () => {
    const spec: A2UISpec = {
      version: 1,
      views: [
        {
          id: 'main',
          root: {
            type: 'Form',
            formId: 'settings',
            fields: [
              {type: 'TextInput', id: 'name', label: 'Name'},
              {type: 'Toggle', id: 'subscribe', label: 'Subscribe'},
              {type: 'Counter', id: 'limit', label: 'Limit', max: 50},
            ],
          },
        },
      ],
      initialViewId: 'main',
    }

    const map = buildCounterBoundsMap(spec)

    // Only the Counter should be in the map; other node types are ignored.
    expect(map.size).toBe(1)
    expect(map.has('limit')).toBe(true)
    expect(map.get('limit')).toEqual({min: undefined, max: 50, step: undefined})
  })
})

// -- (c) Counter nested 3 levels: Container > Container > Form > Counter -----

describe('buildCounterBoundsMap — Counter nested 3 levels deep (Note 3)', () => {
  /**
   * Test scenario: Container { Container { Form { Counter } } }
   * This proves the recursive walk descends through nested Containers
   * and then into the Form's fields array — three recursion levels.
   */
  it('finds Counter nested 3 levels deep: Container > Container > Form > Counter', () => {
    const spec: A2UISpec = {
      version: 1,
      views: [
        {
          id: 'main',
          root: {
            type: 'Container',
            direction: 'column',
            children: [
              {
                type: 'Container',
                direction: 'row',
                children: [
                  {
                    type: 'Form',
                    formId: 'nested',
                    fields: [
                      {
                        type: 'Counter',
                        id: 'deep',
                        label: 'Deep Counter',
                        min: 0,
                        max: 100,
                        step: 5,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
      ],
      initialViewId: 'main',
    }

    const map = buildCounterBoundsMap(spec)

    expect(map.has('deep')).toBe(true)
    expect(map.get('deep')).toEqual({min: 0, max: 100, step: 5})
    // No other entries — only the one Counter was in the spec.
    expect(map.size).toBe(1)
  })

  it('finds Counters in sibling branches at different nesting depths', () => {
    const spec: A2UISpec = {
      version: 1,
      views: [
        {
          id: 'main',
          root: {
            type: 'Container',
            direction: 'column',
            children: [
              // Shallow Counter (level 1)
              {type: 'Counter', id: 'shallow', label: 'Shallow', min: 0, max: 5},
              // Deep Counter (level 3: Container > Form > Counter)
              {
                type: 'Container',
                direction: 'column',
                children: [
                  {
                    type: 'Form',
                    formId: 'deep',
                    fields: [
                      {type: 'Counter', id: 'deep', label: 'Deep', min: 10, max: 20, step: 2},
                    ],
                  },
                ],
              },
            ],
          },
        },
      ],
      initialViewId: 'main',
    }

    const map = buildCounterBoundsMap(spec)

    expect(map.size).toBe(2)
    expect(map.get('shallow')).toEqual({min: 0, max: 5, step: undefined})
    expect(map.get('deep')).toEqual({min: 10, max: 20, step: 2})
  })
})
