/**
 * Step 5 spec tests — T-0005-142..156 + T-0005-150a + T-0005-150b
 * Tests: SpecSchema, SpecScreenSchema, NodeSchema recursive structure
 */
import {SpecSchema, SpecScreenSchema, NodeSchema} from './spec.zod.js'
import {canonicalize} from './canonical.js'

// ---------------------------------------------------------------------------
// Minimal fixture helpers
// ---------------------------------------------------------------------------

/** Minimal valid Heading node — simplest leaf Node for root/children */
const HEADING_NODE = {
  id: 'h1',
  type: 'Heading' as const,
  text: 'Hello',
}

/** Minimal valid SpecScreen */
const SCREEN_1 = {
  id: 'home',
  root: HEADING_NODE,
}

/** Minimal valid collection */
const COLLECTION_1 = {
  id: 'workouts',
  name: 'Workouts',
  fields: [{name: 'name', type: {type: 'string'}, required: true}],
  seedData: [{name: 'Morning Run'}],
  syncMode: 'local' as const,
}

/** Minimal valid Spec — 1 screen, 1 collection, no initialState */
const MINIMAL_SPEC = {
  version: 1 as const,
  archetype: 'ListCRUD' as const,
  stance: 'productive' as const,
  palette: 'focus' as const,
  coverIcon: 'dumbbell',
  navigation: 'none' as const,
  screens: [SCREEN_1],
  initialScreenId: 'home',
  collections: [COLLECTION_1],
}

// ---------------------------------------------------------------------------
// T-0005-142: Minimal valid Spec parses
// ---------------------------------------------------------------------------
describe('SpecSchema — minimal valid spec (T-0005-142)', () => {
  it('parses a minimal valid Spec with 1 screen and 1 collection', () => {
    expect(() => SpecSchema.parse(MINIMAL_SPEC)).not.toThrow()
  })

  it('returns correct version field', () => {
    const spec = SpecSchema.parse(MINIMAL_SPEC)
    expect(spec.version).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// T-0005-143: 4-screen Spec with tabs navigation parses
// ---------------------------------------------------------------------------
describe('SpecSchema — 4-screen tabs navigation (T-0005-143)', () => {
  it('parses a 4-screen Spec with tabs navigation', () => {
    const spec = {
      ...MINIMAL_SPEC,
      navigation: 'tabs' as const,
      screens: [
        {id: 'tab1', root: HEADING_NODE},
        {id: 'tab2', root: {id: 'h2', type: 'Body' as const, text: 'Tab 2'}},
        {id: 'tab3', root: {id: 'h3', type: 'Caption' as const, text: 'Tab 3'}},
        {id: 'tab4', root: {id: 'h4', type: 'Heading' as const, text: 'Tab 4'}},
      ],
      initialScreenId: 'tab1',
    }
    expect(() => SpecSchema.parse(spec)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// T-0005-144: 5-screen Spec fails (max 4)
// ---------------------------------------------------------------------------
describe('SpecSchema — screen count bounds (T-0005-144, T-0005-145)', () => {
  it('fails when Spec has 5 screens (T-0005-144)', () => {
    const spec = {
      ...MINIMAL_SPEC,
      navigation: 'tabs' as const,
      screens: [
        {id: 's1', root: HEADING_NODE},
        {id: 's2', root: HEADING_NODE},
        {id: 's3', root: HEADING_NODE},
        {id: 's4', root: HEADING_NODE},
        {id: 's5', root: HEADING_NODE},
      ],
      initialScreenId: 's1',
    }
    expect(() => SpecSchema.parse(spec)).toThrow()
  })

  // T-0005-145: 0-screen Spec fails
  it('fails when Spec has 0 screens (T-0005-145)', () => {
    const spec = {
      ...MINIMAL_SPEC,
      screens: [],
      initialScreenId: 'home',
    }
    expect(() => SpecSchema.parse(spec)).toThrow()
  })
})

// ---------------------------------------------------------------------------
// T-0005-146: Spec missing version fails
// T-0005-147: Spec with version: 2 fails (V0 is v1)
// ---------------------------------------------------------------------------
describe('SpecSchema — version field (T-0005-146, T-0005-147)', () => {
  it('fails when version is missing (T-0005-146)', () => {
    const {version: _v, ...rest} = MINIMAL_SPEC
    expect(() => SpecSchema.parse(rest)).toThrow()
  })

  it('fails when version is 2 (T-0005-147)', () => {
    expect(() => SpecSchema.parse({...MINIMAL_SPEC, version: 2})).toThrow()
  })
})

// ---------------------------------------------------------------------------
// T-0005-148: Spec with initialScreenId not in screens fails superRefine
// ---------------------------------------------------------------------------
describe('SpecSchema — initialScreenId cross-ref (T-0005-148)', () => {
  it('fails when initialScreenId is not in screens (T-0005-148)', () => {
    const spec = {
      ...MINIMAL_SPEC,
      initialScreenId: 'unknown',
    }
    const result = SpecSchema.safeParse(spec)
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map(i => i.path.join('.'))
      expect(paths).toContain('initialScreenId')
    }
  })

  it('succeeds when initialScreenId matches a screen id', () => {
    expect(() => SpecSchema.parse({...MINIMAL_SPEC, initialScreenId: 'home'})).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// T-0005-149: 8 collections succeeds; 9 fails
// T-0005-150: 0 collections succeeds (Calculator archetype)
// ---------------------------------------------------------------------------
describe('SpecSchema — collection count bounds (T-0005-149, T-0005-150)', () => {
  const makeCollection = (id: string) => ({
    id,
    name: `Collection ${id}`,
    fields: [{name: 'item', type: {type: 'string'}}],
    seedData: [{item: 'value'}],
    syncMode: 'local' as const,
  })

  it('succeeds with 8 collections (T-0005-149)', () => {
    const spec = {
      ...MINIMAL_SPEC,
      collections: Array.from({length: 8}, (_, i) => makeCollection(`col${i}`)),
    }
    expect(() => SpecSchema.parse(spec)).not.toThrow()
  })

  it('fails with 9 collections (T-0005-149)', () => {
    const spec = {
      ...MINIMAL_SPEC,
      collections: Array.from({length: 9}, (_, i) => makeCollection(`col${i}`)),
    }
    expect(() => SpecSchema.parse(spec)).toThrow()
  })

  // T-0005-150: 0 collections is valid at schema level (Calculator archetype).
  // Note: cross-ref validator (Step 6) only checks seed data on collections that exist;
  // 0-collection specs skip that check entirely.
  it('succeeds with 0 collections (T-0005-150)', () => {
    const spec = {
      ...MINIMAL_SPEC,
      archetype: 'Calculator' as const,
      collections: [],
    }
    expect(() => SpecSchema.parse(spec)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// T-0005-150a (MT-1): initialState with non-BindingValue (object) fails
// ---------------------------------------------------------------------------
describe('SpecSchema — initialState BindingValue constraint (T-0005-150a)', () => {
  it('fails when initialState value is a nested object (T-0005-150a)', () => {
    const spec = {
      ...MINIMAL_SPEC,
      // BindingValueSchema is string | number | boolean; an object is rejected.
      initialState: {greeting: {nested: 'object'}},
    }
    expect(() => SpecSchema.parse(spec)).toThrow()
  })
})

// ---------------------------------------------------------------------------
// T-0005-150b (MT-2): initialState with 65-char key fails (SlotNameSchema rejects)
// ---------------------------------------------------------------------------
describe('SpecSchema — initialState SlotNameSchema key constraint (T-0005-150b)', () => {
  it('fails when initialState has a 65-char key (T-0005-150b)', () => {
    // SlotNameSchema: z.string().min(1).max(64).regex(/^[a-z][a-zA-Z0-9_]{0,63}$/)
    // A 65-char key (starting with 'a') exceeds max(64).
    const longKey = 'a' + 'b'.repeat(64) // 65 chars
    const spec = {
      ...MINIMAL_SPEC,
      initialState: {[longKey]: 'value'},
    }
    expect(() => SpecSchema.parse(spec)).toThrow()
  })

  it('succeeds with a valid 64-char SlotNameSchema key', () => {
    // 1 letter start + 63 alphanumeric = 64 chars total — at max
    const maxKey = 'a' + 'b'.repeat(63) // 64 chars
    const spec = {
      ...MINIMAL_SPEC,
      initialState: {[maxKey]: 'value'},
    }
    expect(() => SpecSchema.parse(spec)).not.toThrow()
  })

  it('fails when initialState key does not start with lowercase letter', () => {
    // SlotNameSchema regex: /^[a-z][a-zA-Z0-9_]{0,63}$/
    const spec = {
      ...MINIMAL_SPEC,
      initialState: {'1numericStart': 'value'},
    }
    expect(() => SpecSchema.parse(spec)).toThrow()
  })
})

// ---------------------------------------------------------------------------
// T-0005-151: Recursive Node — Stack containing Stack containing Card succeeds
// ---------------------------------------------------------------------------
describe('NodeSchema — recursive nesting (T-0005-151)', () => {
  it('parses a Stack containing Stack containing Card (T-0005-151)', () => {
    const nestedNode = {
      id: 'outer',
      type: 'Stack' as const,
      children: [
        {
          id: 'middle',
          type: 'Stack' as const,
          children: [
            {
              id: 'inner',
              type: 'Card' as const,
              children: [{id: 'txt', type: 'Heading' as const, text: 'Deep'}],
            },
          ],
        },
      ],
    }
    expect(() => NodeSchema.parse(nestedNode)).not.toThrow()
  })

  // T-0005-151-failure: invalid component type in a child position fails.
  // Closes Roz Step 5 Finding 2: failure-path proof of the .extend() recursive
  // closure. Without this test, the recursive union closure was only verified
  // through the success path. NodeSchema must reject {type: 'NotARealComponent'}
  // when it appears as a child of a container.
  it('rejects an invalid component type in a Stack child position (T-0005-151-failure)', () => {
    const badChild = {
      id: 'outer',
      type: 'Stack' as const,
      children: [{id: 'unknown', type: 'NotARealComponent' as const}],
    }
    expect(() => NodeSchema.parse(badChild)).toThrow()
  })

  // Same failure proof at the SpecSchema level — invalid child reaches NodeSchema
  // via Spec.screens[].root.children and surfaces as a parse error.
  it('rejects a Spec containing an invalid component type in a child position (T-0005-151-failure-spec)', () => {
    const badSpec = {
      ...MINIMAL_SPEC,
      screens: [
        {
          id: 'home',
          root: {
            id: 'outer',
            type: 'Stack' as const,
            children: [{id: 'unknown', type: 'NotARealComponent'}],
          },
        },
      ],
    }
    expect(() => SpecSchema.parse(badSpec)).toThrow()
  })
})

// ---------------------------------------------------------------------------
// T-0005-152 (F-06 rewrite): Spec accepts Node nested 9 levels deep
// Zod imposes no nesting limit at the schema layer — the MAX_NESTING_DEPTH = 8
// cap is enforced by validateCrossRefs() in Step 6 (T-0005-173).
// Step 5 confirms structural acceptance; Step 6 confirms the bound.
// ---------------------------------------------------------------------------
describe('NodeSchema — 9-level nesting accepted by Zod (T-0005-152)', () => {
  /** Build n levels of nested Stacks with a Heading leaf */
  function buildDeepStack(depth: number): object {
    if (depth === 0) return {id: `leaf`, type: 'Heading', text: 'Deep leaf'}
    return {
      id: `stack${depth}`,
      type: 'Stack',
      children: [buildDeepStack(depth - 1)],
    }
  }

  it('Zod accepts 9 levels of nesting (F-06 rewrite — no Zod-level depth cap) (T-0005-152)', () => {
    // 9 levels: Stack(Stack(Stack(Stack(Stack(Stack(Stack(Stack(Stack(Heading)))))))))
    const nineDeepNode = buildDeepStack(9)
    const spec = {
      ...MINIMAL_SPEC,
      screens: [{id: 'home', root: nineDeepNode}],
      initialScreenId: 'home',
    }
    // Must not throw — Zod's NodeSchema accepts arbitrarily deep nesting.
    // The depth-8 cap is validateCrossRefs()'s job (Step 6 T-0005-173).
    expect(() => SpecSchema.parse(spec)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// T-0005-153: coverIcon parameterized over representative icon names from the
// closed 80-name catalog (IconNameSchema). All names are from the canonical set.
// ---------------------------------------------------------------------------
describe('SpecSchema — coverIcon (T-0005-153, T-0005-154)', () => {
  // Representative subset from canvas-v0-ux.md §Iconography — all valid in the closed enum.
  // 'chart-bar' replaced by 'bookmark' (chart-bar is not in the 80-name catalog).
  const REPRESENTATIVE_ICON_NAMES = [
    'dumbbell',
    'list',
    'star',
    'heart',
    'book',
    'calendar',
    'camera',
    'bookmark',
    'check',
    'clock',
  ]

  test.each(REPRESENTATIVE_ICON_NAMES)(
    "coverIcon '%s' parses (T-0005-153 — closed enum accepts all 80 canonical names)",
    iconName => {
      expect(() => SpecSchema.parse({...MINIMAL_SPEC, coverIcon: iconName})).not.toThrow()
    },
  )

  // T-0005-154: closed-enum rejection of coverIcon: 'unknown-icon'.
  // IconNameSchema is z.enum([...80 values]); any name outside the set fails.
  it("coverIcon: 'unknown-icon' fails (T-0005-154 — closed enum)", () => {
    expect(() => SpecSchema.parse({...MINIMAL_SPEC, coverIcon: 'unknown-icon'})).toThrow()
  })
})

// ---------------------------------------------------------------------------
// T-0005-155: SpecSchema.parse() returns spec with Node typing exposed
// ---------------------------------------------------------------------------
describe('SpecSchema — type exposure (T-0005-155)', () => {
  it('returns a parsed Spec with accessible Node-typed root (T-0005-155)', () => {
    const stackSpec = {
      ...MINIMAL_SPEC,
      screens: [
        {
          id: 'home',
          root: {
            id: 'stk',
            type: 'Stack' as const,
            children: [{id: 'lbl', type: 'Heading' as const, text: 'Hello'}],
          },
        },
      ],
    }
    const parsed = SpecSchema.parse(stackSpec)
    // Root is typed as Node; accessing .type proves the shape is accessible.
    // Non-null assertion: the test parses a spec with exactly 1 screen (justified
    // under noUncheckedIndexedAccess: true).
    expect(parsed.screens[0]!.root.type).toBe('Stack')
  })
})

// ---------------------------------------------------------------------------
// T-0005-156: canonicalize(spec) produces sorted-key JSON
// ---------------------------------------------------------------------------
describe('canonicalize — sorted-key JSON (T-0005-156)', () => {
  it('produces sorted-key JSON for a parsed Spec (T-0005-156)', () => {
    const parsed = SpecSchema.parse(MINIMAL_SPEC)
    const canonical = canonicalize(parsed)
    // Canonical JSON has keys sorted alphabetically at every level.
    // Verify by parsing and checking key order for the top-level object.
    const topLevelKeys = Object.keys(JSON.parse(canonical))
    const sorted = [...topLevelKeys].sort()
    expect(topLevelKeys).toEqual(sorted)
  })

  it('nested keys are also sorted', () => {
    const parsed = SpecSchema.parse(MINIMAL_SPEC)
    const canonical = canonicalize(parsed)
    const obj = JSON.parse(canonical)
    // screens[0] keys should be sorted
    const screenKeys = Object.keys(obj.screens[0])
    expect(screenKeys).toEqual([...screenKeys].sort())
  })
})

// ---------------------------------------------------------------------------
// SpecScreenSchema — shape validation
// ---------------------------------------------------------------------------
describe('SpecScreenSchema — shape validation', () => {
  it('accepts a screen with id and root', () => {
    expect(() => SpecScreenSchema.parse({id: 'home', root: HEADING_NODE})).not.toThrow()
  })

  it('accepts optional title', () => {
    expect(() =>
      SpecScreenSchema.parse({id: 'home', title: 'Home', root: HEADING_NODE}),
    ).not.toThrow()
  })

  it('fails when title exceeds 40 chars', () => {
    expect(() =>
      SpecScreenSchema.parse({id: 'home', title: 'a'.repeat(41), root: HEADING_NODE}),
    ).toThrow()
  })

  it('rejects extra props (.strict())', () => {
    expect(() =>
      SpecScreenSchema.parse({id: 'home', root: HEADING_NODE, extra: true}),
    ).toThrow()
  })

  it('fails when root is missing', () => {
    expect(() => SpecScreenSchema.parse({id: 'home'})).toThrow()
  })
})

// ---------------------------------------------------------------------------
// SpecSchema — strict shape (no extra fields)
// ---------------------------------------------------------------------------
describe('SpecSchema — .strict() rejects extra fields', () => {
  it('rejects an extra field on the top-level spec', () => {
    expect(() => SpecSchema.parse({...MINIMAL_SPEC, extraField: true})).toThrow()
  })
})
