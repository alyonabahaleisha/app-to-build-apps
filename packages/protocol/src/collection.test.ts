import {FieldTypeSchema, CollectionSchema} from './collection.js'

// Minimal valid collection fixture, reused across tests.
const MINIMAL_VALID_COLLECTION = {
  id: 'workouts',
  name: 'Workouts',
  fields: [{name: 'date', type: {type: 'date'}, required: true}],
  seedData: [{date: '2026-05-07'}],
  syncMode: 'local',
} as const

// ---------------------------------------------------------------------------
// FieldTypeSchema — T-0005-055..059
// ---------------------------------------------------------------------------

describe('FieldTypeSchema', () => {
  // T-0005-055
  it('T-0005-055 — parses {type: "string"}', () => {
    expect(FieldTypeSchema.parse({type: 'string'})).toEqual({type: 'string'})
  })

  // T-0005-056 — parameterized: all 6 field types parse
  it('T-0005-056 — all 6 field types parse via discriminated union', () => {
    const FIELD_TYPES = [
      {type: 'string'},
      {type: 'number'},
      {type: 'boolean'},
      {type: 'date'},
      {type: 'image'},
      {type: 'reference', targetCollectionId: 'authors'},
    ] as const

    for (const ft of FIELD_TYPES) {
      expect(() => FieldTypeSchema.parse(ft)).not.toThrow()
    }
  })

  // T-0005-057
  it('T-0005-057 — parses reference type with targetCollectionId', () => {
    expect(FieldTypeSchema.parse({type: 'reference', targetCollectionId: 'authors'})).toEqual({
      type: 'reference',
      targetCollectionId: 'authors',
    })
  })

  // T-0005-058
  it('T-0005-058 — rejects reference type missing targetCollectionId', () => {
    expect(() => FieldTypeSchema.parse({type: 'reference'})).toThrow()
  })

  // T-0005-059
  it('T-0005-059 — rejects {type: "json"} (closed enum)', () => {
    expect(() => FieldTypeSchema.parse({type: 'json'})).toThrow()
  })
})

// ---------------------------------------------------------------------------
// CollectionSchema — T-0005-060..069 + T-0005-057a + T-0005-064a
// ---------------------------------------------------------------------------

describe('CollectionSchema', () => {
  // T-0005-060
  it('T-0005-060 — minimal valid collection parses successfully', () => {
    expect(() => CollectionSchema.parse(MINIMAL_VALID_COLLECTION)).not.toThrow()
  })

  // T-0005-061
  it('T-0005-061 — collection id with uppercase letter fails regex', () => {
    expect(() =>
      CollectionSchema.parse({...MINIMAL_VALID_COLLECTION, id: 'Workouts'}),
    ).toThrow()
  })

  // T-0005-062
  it('T-0005-062 — collection id starting with digit fails regex', () => {
    expect(() =>
      CollectionSchema.parse({...MINIMAL_VALID_COLLECTION, id: '1workouts'}),
    ).toThrow()
  })

  // T-0005-063
  it('T-0005-063 — field name "_private" fails regex (must start with lowercase letter)', () => {
    expect(() =>
      CollectionSchema.parse({
        ...MINIMAL_VALID_COLLECTION,
        fields: [{name: '_private', type: {type: 'string'}}],
        seedData: [{_private: 'x'}],
      }),
    ).toThrow()
  })

  // T-0005-064 (part 1: 20 fields succeeds)
  it('T-0005-064 — collection with exactly 20 fields succeeds', () => {
    const fields = Array.from({length: 20}, (_, i) => ({
      name: `fld${String(i).padStart(2, '0')}`,
      type: {type: 'string' as const},
    }))
    const seedRow: Record<string, string> = {}
    for (const f of fields) seedRow[f.name] = 'x'

    expect(() =>
      CollectionSchema.parse({
        ...MINIMAL_VALID_COLLECTION,
        fields,
        seedData: [seedRow],
      }),
    ).not.toThrow()
  })

  // T-0005-064 (part 2: 21 fields fails)
  it('T-0005-064 — collection with 21 fields fails (max 20)', () => {
    const fields = Array.from({length: 21}, (_, i) => ({
      name: `fld${String(i).padStart(2, '0')}`,
      type: {type: 'string' as const},
    }))
    const seedRow: Record<string, string> = {}
    for (const f of fields) seedRow[f.name] = 'x'

    expect(() =>
      CollectionSchema.parse({
        ...MINIMAL_VALID_COLLECTION,
        fields,
        seedData: [seedRow],
      }),
    ).toThrow()
  })

  // T-0005-065 (part 1: 50 seed rows succeeds)
  it('T-0005-065 — collection with exactly 50 seed rows succeeds', () => {
    const seedData = Array.from({length: 50}, (_, i) => ({
      date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
    }))
    expect(() =>
      CollectionSchema.parse({...MINIMAL_VALID_COLLECTION, seedData}),
    ).not.toThrow()
  })

  // T-0005-065 (part 2: 51 seed rows fails)
  it('T-0005-065 — collection with 51 seed rows fails (max 50)', () => {
    const seedData = Array.from({length: 51}, (_, i) => ({
      date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
    }))
    expect(() =>
      CollectionSchema.parse({...MINIMAL_VALID_COLLECTION, seedData}),
    ).toThrow()
  })

  // T-0005-066
  it('T-0005-066 — collection with 0 fields fails (min 1)', () => {
    expect(() =>
      CollectionSchema.parse({...MINIMAL_VALID_COLLECTION, fields: []}),
    ).toThrow()
  })

  // T-0005-067
  it('T-0005-067 — collection with 0 seed rows fails (min 1)', () => {
    expect(() =>
      CollectionSchema.parse({...MINIMAL_VALID_COLLECTION, seedData: []}),
    ).toThrow()
  })

  // T-0005-068
  it('T-0005-068 — syncMode "cloud-shared" fails (V0: only local + cloud-private)', () => {
    expect(() =>
      CollectionSchema.parse({...MINIMAL_VALID_COLLECTION, syncMode: 'cloud-shared'}),
    ).toThrow()
  })

  // T-0005-069 (part 1: 64-char field name succeeds)
  it('T-0005-069 — field name with exactly 64 chars succeeds', () => {
    // Regex: ^[a-z][a-zA-Z0-9_]{0,63}$ — 1 + 63 = 64 chars total
    const name = 'a' + 'b'.repeat(63)
    expect(() =>
      CollectionSchema.parse({
        ...MINIMAL_VALID_COLLECTION,
        fields: [{name, type: {type: 'string'}}],
        seedData: [{[name]: 'x'}],
      }),
    ).not.toThrow()
  })

  // T-0005-069 (part 2: 65-char field name fails)
  it('T-0005-069 — field name with 65 chars fails', () => {
    // 65 chars: 'a' + 64 'b's — exceeds the max(64) constraint
    const name = 'a' + 'b'.repeat(64)
    expect(() =>
      CollectionSchema.parse({
        ...MINIMAL_VALID_COLLECTION,
        fields: [{name, type: {type: 'string'}}],
        seedData: [{someField: 'x'}],
      }),
    ).toThrow()
  })

  // T-0005-057a — self-referential collection allowed (MT-4 decision)
  it('T-0005-057a — self-referential collection parses (targetCollectionId === own id)', () => {
    // Use case: Workouts collection with a "rep-of" parent-Workout reference.
    // The cross-ref validator (Step 6) also accepts self-reference.
    expect(() =>
      CollectionSchema.parse({
        id: 'workouts',
        name: 'Workouts',
        fields: [
          {name: 'name', type: {type: 'string'}},
          {name: 'repOf', type: {type: 'reference', targetCollectionId: 'workouts'}},
        ],
        seedData: [{name: 'Squat', repOf: 'workouts001'}],
        syncMode: 'local',
      }),
    ).not.toThrow()
  })

  // T-0005-064a — max-size payload parse performance (F-10)
  it('T-0005-064a — max-size collection (50 rows × 20 fields × 64-char strings) parses in <500ms', () => {
    // 20 unique field names, each exactly 64 chars: 'f' + 2-digit index + 61 'x' chars
    const fields = Array.from({length: 20}, (_, i) => ({
      name: `f${String(i).padStart(2, '0')}${'x'.repeat(61)}`,
      type: {type: 'string' as const},
    }))

    // 64-char string value for each field
    const value = 'v'.repeat(64)
    const seedRow: Record<string, string> = {}
    for (const f of fields) seedRow[f.name] = value

    const seedData = Array.from({length: 50}, () => ({...seedRow}))

    const start = Date.now()
    CollectionSchema.parse({
      id: 'maxsize',
      name: 'Max Size Collection',
      fields,
      seedData,
      syncMode: 'local',
    })
    const elapsed = Date.now() - start

    expect(elapsed).toBeLessThan(500)
  })

  // Additional SyncMode boundary tests
  it('accepts syncMode "local"', () => {
    expect(() =>
      CollectionSchema.parse({...MINIMAL_VALID_COLLECTION, syncMode: 'local'}),
    ).not.toThrow()
  })

  it('accepts syncMode "cloud-private"', () => {
    expect(() =>
      CollectionSchema.parse({...MINIMAL_VALID_COLLECTION, syncMode: 'cloud-private'}),
    ).not.toThrow()
  })
})
