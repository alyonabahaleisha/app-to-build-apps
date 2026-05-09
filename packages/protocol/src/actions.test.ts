import {ActionSchema, ACTION_VERB_COUNT} from './actions.js'

// ---------------------------------------------------------------------------
// T-0005-038 — All 12 action verb literals parse with valid params
// ---------------------------------------------------------------------------

describe('T-0005-038 — all 12 verbs parse with valid params', () => {
  const VALID_ACTIONS = [
    {type: 'set', target: 'slot1', value: 'hello'},
    {type: 'update', collection: 'workouts', itemId: 'item1', patch: {name: 'Run'}},
    {type: 'reset', target: 'slot1'},
    {type: 'addItem', collection: 'workouts', item: {name: 'Swim'}},
    {type: 'removeItem', collection: 'workouts', itemId: 'item1'},
    {type: 'updateItem', collection: 'workouts', itemId: 'item1', patch: {name: 'Bike'}},
    {type: 'clearCollection', collection: 'workouts'},
    {type: 'navigate', target: 'screen2'},
    {type: 'back'},
    {type: 'capture', target: 'photoSlot'},
    {type: 'toast', message: 'Saved!'},
    {
      type: 'aiProcess',
      task: 'summarize',
      collection: 'mood',
      prompt: 'sum it up',
      target: 'summary',
    },
  ] as const

  it.each(VALID_ACTIONS)('$type action parses successfully', action => {
    expect(() => ActionSchema.parse(action)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// T-0005-039 — 'share' verb fails (F-4 cut — regression for the brief)
// ---------------------------------------------------------------------------

describe('T-0005-039 — share verb is absent (F-4 cut)', () => {
  it('ActionSchema.parse({type: "share"}) fails', () => {
    expect(() => ActionSchema.parse({type: 'share'})).toThrow()
  })
})

// ---------------------------------------------------------------------------
// T-0005-040 — Action verb union has exactly 12 members (cardinality tripwire)
// ---------------------------------------------------------------------------

describe('T-0005-040 — action verb union has exactly 12 members', () => {
  it('ACTION_VERB_COUNT equals 12', () => {
    expect(ACTION_VERB_COUNT).toBe(12)
  })

  it('ActionSchema options array has exactly 12 entries', () => {
    // z.discriminatedUnion exposes .options
    expect((ActionSchema as {options: unknown[]}).options).toHaveLength(12)
  })
})

// ---------------------------------------------------------------------------
// T-0005-041 — set action missing 'value' fails
// ---------------------------------------------------------------------------

describe('T-0005-041 — set action requires value', () => {
  it('fails when value is missing', () => {
    expect(() => ActionSchema.parse({type: 'set', target: 'slot1'})).toThrow()
  })
})

// ---------------------------------------------------------------------------
// T-0005-042 — set action with invalid nested value structure fails
// ---------------------------------------------------------------------------

describe('T-0005-042 — set action value must be BindingValue (string|number|boolean)', () => {
  it('fails when value is an object (not a BindingValue)', () => {
    // {kind: 'literal'} is a Binding shape, not a BindingValue (which is string|number|boolean)
    expect(() =>
      ActionSchema.parse({type: 'set', target: 'slot1', value: {kind: 'literal'}}),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// T-0005-043 — aiProcess with task: 'summarize' succeeds
// ---------------------------------------------------------------------------

describe('T-0005-043 — aiProcess with summarize task succeeds', () => {
  it('parses correctly', () => {
    const result = ActionSchema.parse({
      type: 'aiProcess',
      task: 'summarize',
      collection: 'mood',
      prompt: 'sum it',
      target: 'summary',
    })
    expect(result).toMatchObject({type: 'aiProcess', task: 'summarize'})
  })
})

// ---------------------------------------------------------------------------
// T-0005-044 — aiProcess with task: 'translate' fails (only 'summarize' in V0)
// ---------------------------------------------------------------------------

describe('T-0005-044 — aiProcess task "translate" fails (not in V0)', () => {
  it('rejects task: translate', () => {
    expect(() =>
      ActionSchema.parse({
        type: 'aiProcess',
        task: 'translate',
        collection: 'text',
        prompt: 'translate this',
        target: 'result',
      }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// T-0005-045 — navigate action missing 'target' fails
// ---------------------------------------------------------------------------

describe('T-0005-045 — navigate action requires target', () => {
  it('fails when target is missing', () => {
    expect(() => ActionSchema.parse({type: 'navigate'})).toThrow()
  })
})

// ---------------------------------------------------------------------------
// T-0005-046 — back action succeeds (no params required)
// ---------------------------------------------------------------------------

describe('T-0005-046 — back action with no params succeeds', () => {
  it('parses {type: "back"} successfully', () => {
    expect(ActionSchema.parse({type: 'back'})).toEqual({type: 'back'})
  })
})

// ---------------------------------------------------------------------------
// T-0005-047 — back action with extra param fails (.strict() enforcement)
// ---------------------------------------------------------------------------

describe('T-0005-047 — extra params rejected via .strict()', () => {
  it('{type: "back", target: "home"} fails', () => {
    expect(() => ActionSchema.parse({type: 'back', target: 'home'})).toThrow()
  })

  it('{type: "reset", target: "slot1", extra: true} fails', () => {
    expect(() =>
      ActionSchema.parse({type: 'reset', target: 'slot1', extra: true}),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// T-0005-048 — toast with empty message fails (min 1)
// ---------------------------------------------------------------------------

describe('T-0005-048 — toast message requires min 1 character', () => {
  it('fails with empty message', () => {
    expect(() => ActionSchema.parse({type: 'toast', message: ''})).toThrow()
  })
})

// ---------------------------------------------------------------------------
// T-0005-049 — toast with 200-char message and tone succeeds (max)
// ---------------------------------------------------------------------------

describe('T-0005-049 — toast accepts long message with valid tone', () => {
  it('succeeds at max message length with tone: success', () => {
    const message = 'a'.repeat(200)
    expect(() => ActionSchema.parse({type: 'toast', message, tone: 'success'})).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// T-0005-050 — toast with invalid tone fails (closed Tone enum)
// ---------------------------------------------------------------------------

describe('T-0005-050 — toast tone must be in closed Tone enum', () => {
  it('rejects tone: "fancy"', () => {
    expect(() => ActionSchema.parse({type: 'toast', message: 'hi', tone: 'fancy'})).toThrow()
  })
})

// ---------------------------------------------------------------------------
// T-0005-051 — toast with script-injection string succeeds
// (renderer escapes; schema allows arbitrary string content)
// ---------------------------------------------------------------------------

describe('T-0005-051 — toast message allows arbitrary string (renderer escapes)', () => {
  it('parses <script>alert(1)</script> as a message string', () => {
    expect(() =>
      ActionSchema.parse({type: 'toast', message: '<script>alert(1)</script>'}),
    ).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// T-0005-052 — legacy M1 'increment' verb fails (breaking change)
// ---------------------------------------------------------------------------

describe('T-0005-052 — legacy M1 "increment" verb is removed', () => {
  it('ActionSchema.parse({type: "increment", targetId: "foo"}) fails', () => {
    expect(() => ActionSchema.parse({type: 'increment', targetId: 'foo'})).toThrow()
  })
})

// ---------------------------------------------------------------------------
// T-0005-053 — legacy M1 'decrement' verb fails (breaking change)
// ---------------------------------------------------------------------------

describe('T-0005-053 — legacy M1 "decrement" verb is removed', () => {
  it('ActionSchema.parse({type: "decrement", targetId: "foo"}) fails', () => {
    expect(() => ActionSchema.parse({type: 'decrement', targetId: 'foo'})).toThrow()
  })
})

// ---------------------------------------------------------------------------
// T-0005-054 — Concurrency: parsing 1000 times in parallel produces identical results
// ---------------------------------------------------------------------------

describe('T-0005-054 — action parsing is pure (concurrency check)', () => {
  it('parsing the same action 1000 times in parallel produces identical results', async () => {
    const action = {
      type: 'aiProcess',
      task: 'summarize',
      collection: 'mood',
      prompt: 'sum it',
      target: 'summary',
    } as const

    const results = await Promise.all(
      Array.from({length: 1000}, () => Promise.resolve(ActionSchema.parse(action))),
    )

    const first = JSON.stringify(results[0])
    for (const r of results) {
      expect(JSON.stringify(r)).toBe(first)
    }
  })
})
