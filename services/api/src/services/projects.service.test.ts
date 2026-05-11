/**
 * ADR-0001 Step 4 — projects.service unit tests.
 *
 * Service-layer assertions only; route-layer concerns (auth gating, status
 * codes, response shape) live in `routes/projects.test.ts`.
 *
 * T-IDs covered here:
 *   Happy:       T-0001-049, 050, 051, 052
 *   Failure:     T-0001-055
 *   Boundary:    T-0001-059 (V0: 40-char title truncation), T-0001-121
 *   Error:       T-0001-062 (mid-tx rollback)
 *   Concurrency: T-0001-067, 068
 *   Regression:  T-0001-069, 070
 *
 * ADR-0004 Step 4 additions (V0 update):
 *   Happy:    T-0004-057 (V0: plan_json always NULL), T-0004-058
 *   Stable:   T-0004-125
 *
 * ADR-0007 V0 cutover:
 *   - plan param removed from create()
 *   - deepValidateSpec removed (validateCrossRefs used in V0; service boundary)
 *   - T-0001-130/131/138 removed (M1 deepValidateSpec era — no longer applies)
 *   - T-0004-059 removed (invalid plan — concept gone in V0)
 *   - T-0001-059 boundary: 40 chars + '…' (V0), not 60
 *
 * The route file covers list-shape / get-shape / 404-not-403 / cross-user
 * isolation / audit log / fork roundtrip (T-0001-053, 054, 056, 057, 058,
 * 060, 061, 063, 064, 065, 066, 120, 122).
 */
import {randomUUID} from 'node:crypto'

import {eq} from 'drizzle-orm'
import type {NodePgDatabase} from 'drizzle-orm/node-postgres'

import * as schema from '../db/schema.js'
import {projects, projectVersions, messages, users} from '../db/schema.js'
import {createProjectsService, type ProjectsService} from './projects.service.js'
import {
  specWithFork,
  specWithHeading,
  specWithLongHeading,
  specWithoutHeading,
  uniqueEmail,
  validSpec,
} from '../../test/factories.js'
import {closeTestPool, getTestDb, getTestPool, truncateAll} from '../../test/setup.js'

type Db = NodePgDatabase<typeof schema>

async function makeUser(db: Db, email = uniqueEmail()): Promise<string> {
  const id = randomUUID()
  await db.insert(users).values({id, email})
  return id
}

describe('ADR-0001 Step 4 — projectsService (unit)', () => {
  let db: Db
  let service: ProjectsService

  beforeAll(async () => {
    db = await getTestDb()
    service = createProjectsService(db)
  })

  afterEach(async () => {
    await truncateAll()
  })

  afterAll(async () => {
    await closeTestPool()
  })

  // -------------------------------------------------------------------------
  // T-0001-049 — Happy: create writes 1 project + 1 version, returns ProjectDetail
  // -------------------------------------------------------------------------
  it('T-0001-049: create writes one project + one version row, returns ProjectDetail with current_version_id populated', async () => {
    const ownerId = await makeUser(db)

    const detail = await service.create({ownerId, spec: specWithHeading('My App')})

    expect(detail.project.ownerId).toBe(ownerId)
    expect(detail.project.title).toBe('My App')
    expect(detail.project.currentVersionId).toBe(detail.currentVersion.id)
    expect(detail.currentVersion.projectId).toBe(detail.project.id)
    expect(detail.currentVersion.renderHash).toMatch(/^[0-9a-f]{64}$/)

    const projectRows = await db.select().from(projects).where(eq(projects.id, detail.project.id))
    expect(projectRows).toHaveLength(1)
    expect(projectRows[0]?.currentVersionId).toBe(detail.currentVersion.id)

    const versionRows = await db
      .select()
      .from(projectVersions)
      .where(eq(projectVersions.projectId, detail.project.id))
    expect(versionRows).toHaveLength(1)
    expect(versionRows[0]?.id).toBe(detail.currentVersion.id)
  })

  // -------------------------------------------------------------------------
  // T-0001-050 — Happy: title auto-derives from first Heading text
  // -------------------------------------------------------------------------
  it('T-0001-050: title auto-derives from the first Heading text in the first screen', async () => {
    const ownerId = await makeUser(db)
    const detail = await service.create({ownerId, spec: specWithHeading('Recipe Box')})
    expect(detail.project.title).toBe('Recipe Box')
  })

  // -------------------------------------------------------------------------
  // T-0001-051 — Happy: title falls back to "Untitled" when no Heading
  // -------------------------------------------------------------------------
  it('T-0001-051: title falls back to "Untitled" when the spec contains no Heading and no originalPrompt', async () => {
    const ownerId = await makeUser(db)
    const detail = await service.create({ownerId, spec: specWithoutHeading()})
    expect(detail.project.title).toBe('Untitled')
  })

  // -------------------------------------------------------------------------
  // T-0001-052 — Happy: list returns user's projects sorted by updatedAt DESC
  // -------------------------------------------------------------------------
  it("T-0001-052: list returns the user's projects sorted by updatedAt DESC", async () => {
    const ownerId = await makeUser(db)

    const a = await service.create({ownerId, spec: specWithHeading('Alpha')})
    // Force a measurable updated_at gap so DESC ordering is deterministic.
    await db
      .update(projects)
      .set({updatedAt: new Date(Date.now() - 10_000)})
      .where(eq(projects.id, a.project.id))
    const b = await service.create({ownerId, spec: specWithHeading('Bravo')})
    const c = await service.create({ownerId, spec: specWithHeading('Charlie')})

    const list = await service.list(ownerId)
    expect(list.map(p => p.id)).toEqual([c.project.id, b.project.id, a.project.id])
    expect(list.map(p => p.title)).toEqual(['Charlie', 'Bravo', 'Alpha'])
  })

  // -------------------------------------------------------------------------
  // T-0001-055 — Failure: invalid spec throws before any DB write
  // -------------------------------------------------------------------------
  it('T-0001-055: create with an invalid spec throws before writing any row', async () => {
    const ownerId = await makeUser(db)
    const malformed = {version: 999, screens: []} as unknown as Parameters<
      typeof service.create
    >[0]['spec']

    await expect(service.create({ownerId, spec: malformed})).rejects.toThrow()

    // Defense: no rows leaked from the failed validation.
    const projectRows = await db.select().from(projects)
    const versionRows = await db.select().from(projectVersions)
    expect(projectRows).toHaveLength(0)
    expect(versionRows).toHaveLength(0)
  })

  // -------------------------------------------------------------------------
  // T-0001-059 — Boundary: title heading > 40 chars → 40 + ellipsis (total 41)
  // V0 title derivation truncates at 40 chars (vs M1's 60 chars).
  // -------------------------------------------------------------------------
  it('T-0001-059: title heading >40 chars → truncated to 40 + ellipsis; resulting length is exactly 41', async () => {
    const ownerId = await makeUser(db)
    const detail = await service.create({ownerId, spec: specWithLongHeading()})
    expect(detail.project.title).toHaveLength(41)
    expect(detail.project.title.endsWith('…')).toBe(true)
    expect(detail.project.title.slice(0, 40)).toBe('A'.repeat(40))
  })

  // -------------------------------------------------------------------------
  // T-0001-121 — Boundary: whitespace-only Heading text → "Untitled"
  // -------------------------------------------------------------------------
  it('T-0001-121: whitespace-only first Heading text falls back to "Untitled" (trim happens before fallback decision)', async () => {
    const ownerId = await makeUser(db)
    const detail = await service.create({ownerId, spec: specWithHeading('   ')})
    expect(detail.project.title).toBe('Untitled')
  })

  // -------------------------------------------------------------------------
  // T-0001-062 — Error handling: mid-tx failure rolls back both rows
  // -------------------------------------------------------------------------
  it('T-0001-062: mid-transaction failure leaves zero project + zero version rows in the DB', async () => {
    const ownerId = await makeUser(db)

    // Wrap db.transaction so the `tx` handed to our service has its `update`
    // method replaced with a thrower. The proxy at the top level alone is
    // insufficient because the service uses `tx.update` inside the
    // transaction, not `db.update`.
    const sabotaged: Db = new Proxy(db, {
      get(target, prop, receiver) {
        if (prop === 'transaction') {
          return async (cb: (tx: Db) => Promise<unknown>) =>
            // Cast through unknown: Drizzle's tx type isn't trivially named
            // here; the structural Db shape is the only surface we use.
            (target as Db).transaction(async innerTx => {
              const wrapped = new Proxy(innerTx as unknown as Db, {
                get(t, k, r) {
                  if (k === 'update') {
                    return () => {
                      throw new Error('forced_mid_tx_failure')
                    }
                  }
                  return Reflect.get(t, k, r)
                },
              })
              return cb(wrapped)
            })
        }
        return Reflect.get(target, prop, receiver)
      },
    })

    const failingService = createProjectsService(sabotaged)

    await expect(
      failingService.create({ownerId, spec: specWithHeading('Will fail')}),
    ).rejects.toThrow(/forced_mid_tx_failure/)

    const pool = await getTestPool()
    const projCount = await pool.query<{count: string}>(
      'SELECT COUNT(*)::text AS count FROM projects WHERE owner_id = $1',
      [ownerId],
    )
    const verCount = await pool.query<{count: string}>(
      'SELECT COUNT(*)::text AS count FROM project_versions',
    )
    expect(projCount.rows[0]?.count).toBe('0')
    expect(verCount.rows[0]?.count).toBe('0')
  })

  // -------------------------------------------------------------------------
  // T-0001-067 — Concurrency: two concurrent create() → 2 distinct projects
  // -------------------------------------------------------------------------
  it('T-0001-067: two concurrent create() calls for the same user produce 2 distinct projects + 2 distinct versions; no FK violation', async () => {
    const ownerId = await makeUser(db)
    const [a, b] = await Promise.all([
      service.create({ownerId, spec: specWithHeading('Race A')}),
      service.create({ownerId, spec: specWithHeading('Race B')}),
    ])
    expect(a.project.id).not.toBe(b.project.id)
    expect(a.currentVersion.id).not.toBe(b.currentVersion.id)

    const list = await service.list(ownerId)
    expect(list).toHaveLength(2)
    expect(list.every(p => p.currentVersionId !== null)).toBe(true)
  })

  // -------------------------------------------------------------------------
  // T-0001-068 — Concurrency: list during create never sees a half-formed row
  // -------------------------------------------------------------------------
  it('T-0001-068: concurrent list + create never returns a project with current_version_id = null', async () => {
    const ownerId = await makeUser(db)
    // Pre-seed one project so list is non-empty in the racing snapshot.
    await service.create({ownerId, spec: specWithHeading('Pre-existing')})

    const results = await Promise.all([
      service.create({ownerId, spec: specWithHeading('Created during race')}),
      service.list(ownerId),
      service.list(ownerId),
      service.list(ownerId),
    ])
    const lists = results.slice(1) as Awaited<ReturnType<typeof service.list>>[]

    for (const list of lists) {
      for (const row of list) {
        // The list excludes specJson (T-0001-064) but currentVersionId is on
        // the list-item shape and must be present + non-null.
        expect(row.currentVersionId).toBeTruthy()
      }
    }
  })

  // -------------------------------------------------------------------------
  // T-0001-069 — Regression: current_version_id always points at a real version
  // -------------------------------------------------------------------------
  it('T-0001-069: after create, current_version_id always points at a real project_versions.id', async () => {
    const ownerId = await makeUser(db)
    const detail = await service.create({ownerId, spec: specWithHeading('FK check')})

    const pool = await getTestPool()
    const {rows} = await pool.query<{exists: boolean}>(
      `SELECT EXISTS(
         SELECT 1 FROM project_versions v
         JOIN projects p ON p.current_version_id = v.id
         WHERE p.id = $1
       ) AS exists`,
      [detail.project.id],
    )
    expect(rows[0]?.exists).toBe(true)
  })

  // -------------------------------------------------------------------------
  // T-0001-070 — Regression: created_at == updated_at on a fresh project
  // -------------------------------------------------------------------------
  it('T-0001-070: on a fresh project, updated_at equals created_at', async () => {
    const ownerId = await makeUser(db)
    const detail = await service.create({ownerId, spec: specWithHeading('Timestamps')})
    expect(detail.project.updatedAt.toISOString()).toBe(detail.project.createdAt.toISOString())
  })

  // -------------------------------------------------------------------------
  // Sanity: get() returns null for a non-owner
  // -------------------------------------------------------------------------
  it('get returns null when the project is not owned by the requested user', async () => {
    const ownerA = await makeUser(db)
    const ownerB = await makeUser(db)
    const detail = await service.create({ownerId: ownerA, spec: validSpec()})

    const asA = await service.get(ownerA, detail.project.id)
    expect(asA?.project.id).toBe(detail.project.id)

    const asB = await service.get(ownerB, detail.project.id)
    expect(asB).toBeNull()
  })

  it('get returns null when the project does not exist', async () => {
    const ownerId = await makeUser(db)
    const phantom = randomUUID()
    expect(await service.get(ownerId, phantom)).toBeNull()
  })

  // -------------------------------------------------------------------------
  // Sanity: parentProjectId roundtrip on the service layer
  // -------------------------------------------------------------------------
  it('create persists parentProjectId when supplied', async () => {
    const ownerId = await makeUser(db)
    const parent = await service.create({ownerId, spec: validSpec()})
    const child = await service.create({
      ownerId,
      spec: specWithFork(parent.project.id),
      parentProjectId: parent.project.id,
    })
    expect(child.project.parentProjectId).toBe(parent.project.id)
  })

  // -------------------------------------------------------------------------
  // ADR-0002 Step 4 extensions — originalPrompt + messages insert
  // -------------------------------------------------------------------------

  it('ADR-0002: create stores originalPrompt on the project row when provided', async () => {
    const ownerId = await makeUser(db)
    const prompt = 'Build me a recipe app'
    const detail = await service.create({
      ownerId,
      spec: specWithHeading('Recipe'),
      originalPrompt: prompt,
    })

    const projectRows = await db.select().from(projects).where(eq(projects.id, detail.project.id))
    expect(projectRows[0]?.originalPrompt).toBe(prompt)
  })

  it('ADR-0002: create stores empty string originalPrompt when not provided (backward compat)', async () => {
    const ownerId = await makeUser(db)
    const detail = await service.create({ownerId, spec: specWithHeading('No prompt')})

    const projectRows = await db.select().from(projects).where(eq(projects.id, detail.project.id))
    expect(projectRows[0]?.originalPrompt).toBe('')
  })

  it('ADR-0002: create inserts a messages row with role=user and content=originalPrompt when prompt is non-empty', async () => {
    const ownerId = await makeUser(db)
    const prompt = 'Build me a fitness tracker'
    const detail = await service.create({
      ownerId,
      spec: specWithHeading('Fitness'),
      originalPrompt: prompt,
    })

    const msgRows = await db
      .select()
      .from(messages)
      .where(eq(messages.projectId, detail.project.id))
    expect(msgRows).toHaveLength(1)
    expect(msgRows[0]?.role).toBe('user')
    expect(msgRows[0]?.content).toBe(prompt)
  })

  it('ADR-0002: create does NOT insert a messages row when originalPrompt is empty string', async () => {
    const ownerId = await makeUser(db)
    const detail = await service.create({ownerId, spec: specWithHeading('No Prompt')})

    const msgRows = await db
      .select()
      .from(messages)
      .where(eq(messages.projectId, detail.project.id))
    expect(msgRows).toHaveLength(0)
  })

  // -------------------------------------------------------------------------
  // T-0004-057 — V0 update: plan_json is ALWAYS NULL (V0 drops plan)
  // The M1 test asserted plan_json was populated; V0 asserts it is always NULL.
  // -------------------------------------------------------------------------
  it('T-0004-057: V0 create always writes plan_json: NULL regardless of input (plan concept removed)', async () => {
    const ownerId = await makeUser(db)
    const detail = await service.create({
      ownerId,
      spec: specWithHeading('Tip Calculator'),
    })

    const pool = await getTestPool()
    const {rows} = await pool.query<{plan_json: unknown}>(
      `SELECT plan_json FROM project_versions WHERE id = $1`,
      [detail.currentVersion.id],
    )
    expect(rows).toHaveLength(1)
    // V0: plan_json must always be NULL (ADR-0007 §G).
    expect(rows[0]?.plan_json).toBeNull()
  })

  // -------------------------------------------------------------------------
  // T-0004-058 — Happy: create without plan writes plan_json as NULL (unchanged)
  // -------------------------------------------------------------------------
  it('T-0004-058: create without plan argument writes plan_json: NULL', async () => {
    const ownerId = await makeUser(db)
    const detail = await service.create({
      ownerId,
      spec: specWithHeading('No Plan App'),
    })

    const pool = await getTestPool()
    const {rows} = await pool.query<{plan_json: unknown}>(
      `SELECT plan_json FROM project_versions WHERE id = $1`,
      [detail.currentVersion.id],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.plan_json).toBeNull()
  })

  // -------------------------------------------------------------------------
  // T-0004-125 — Negative: getVersion with a valid-format UUID that has no
  // matching row returns null, not throws.
  // -------------------------------------------------------------------------
  it('T-0004-125: getVersion with a valid UUID that has no matching row returns null (not throws, not undefined)', async () => {
    const phantomVersionId = randomUUID()
    const result = await service.getVersion(phantomVersionId)
    // Explicit null — not undefined, not an empty row.
    expect(result).toBeNull()
  })

  it('ADR-0002: messages insert is part of the transaction — rolls back on failure', async () => {
    const ownerId = await makeUser(db)

    // Sabotage the transaction so the messages INSERT triggers rollback.
    // Wrap the outer db.transaction to intercept `insert` calls inside the tx.
    const sabotaged: Db = new Proxy(db, {
      get(target, prop, receiver) {
        if (prop === 'transaction') {
          return async (cb: (tx: Db) => Promise<unknown>) =>
            (target as Db).transaction(async innerTx => {
              let insertCount = 0
              const wrapped = new Proxy(innerTx as unknown as Db, {
                get(t, k, r) {
                  if (k === 'insert') {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    return (...args: any[]) => {
                      insertCount++
                      // On the 3rd insert (the messages insert), throw.
                      // Order: 1=projects, 2=project_versions, (update not insert),
                      //        3=messages.
                      if (insertCount === 3) {
                        throw new Error('forced_messages_insert_failure')
                      }
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      return (Reflect.get(t, k, r) as (...a: any[]) => unknown)(...args)
                    }
                  }
                  return Reflect.get(t, k, r)
                },
              })
              return cb(wrapped)
            })
        }
        return Reflect.get(target, prop, receiver)
      },
    })

    const failingService = createProjectsService(sabotaged)
    await expect(
      failingService.create({
        ownerId,
        spec: specWithHeading('Rollback'),
        originalPrompt: 'some prompt',
      }),
    ).rejects.toThrow(/forced_messages_insert_failure/)

    // Neither project nor messages should exist after the rollback
    const projectRows = await db.select().from(projects).where(eq(projects.ownerId, ownerId))
    expect(projectRows).toHaveLength(0)
    const msgRows = await db.select().from(messages)
    expect(msgRows).toHaveLength(0)
  })
})
