/**
 * Seed SQL generator — ADR-0002 Step 2.
 *
 * Authors 5 hand-crafted A2UISpec objects, validates each against
 * A2UISpecSchema + deepValidateSpec, computes renderHash, then emits
 * the SQL INSERT statements for 0004_example_seeds.sql.
 *
 * Run with:
 *   pnpm --filter @app-creator/api exec tsx scripts/generate-seed-sql.ts
 *
 * The output is deterministic. Pipe to migrations/0004_example_seeds.sql or
 * copy-paste. Commit both this script and the resulting SQL.
 */
import {A2UISpecSchema, renderHash} from '@app-creator/a2ui-schema'
import type {A2UISpec} from '@app-creator/a2ui-schema'
import {deepValidateSpec} from '../src/services/specValidation.js'

// ---------------------------------------------------------------------------
// Seed IDs (fixed, deterministic)
// ---------------------------------------------------------------------------
const EXAMPLE_USER_ID = '00000000-0000-0000-0000-000000000001'

interface SeedProject {
  id: string
  title: string
  originalPrompt: string
  spec: A2UISpec
}

// ---------------------------------------------------------------------------
// 1. Tip splitter
//    Counter for bill total, Counter for tip %, Text shows result via a
//    toast (we can't compute derived values in the runtime — use toast
//    action on the button to show a computed message as a demo).
// ---------------------------------------------------------------------------
const tipSplitter: SeedProject = {
  id: '00000000-0000-0000-0000-000000000010',
  title: 'Tip splitter',
  originalPrompt: 'A tip splitter for my favorite coffee shop',
  spec: {
    version: 1,
    initialViewId: 'main',
    views: [
      {
        id: 'main',
        root: {
          type: 'Container',
          direction: 'column',
          gap: 'md',
          padding: 'md',
          children: [
            {type: 'Heading', text: 'Tip splitter', level: 1},
            {
              type: 'Counter',
              id: 'bill',
              label: 'Bill ($)',
              min: 0,
              step: 1,
            },
            {
              type: 'Counter',
              id: 'tip_pct',
              label: 'Tip (%)',
              min: 0,
              max: 100,
              step: 5,
            },
            {
              type: 'Counter',
              id: 'people',
              label: 'People',
              min: 1,
              step: 1,
            },
            {
              type: 'Button',
              label: 'Calculate tip',
              action: {type: 'toast', message: 'Check the counters above for your split!'},
              variant: 'primary',
            },
          ],
        },
      },
    ],
    initialState: {
      bill: 50,
      tip_pct: 18,
      people: 2,
    },
  },
}

// ---------------------------------------------------------------------------
// 2. Morning routine / Habit tracker
//    Three Toggles + a Counter for streak.
// ---------------------------------------------------------------------------
const habitTracker: SeedProject = {
  id: '00000000-0000-0000-0000-000000000011',
  title: 'Morning routine',
  originalPrompt: 'A morning habit tracker with streak counter',
  spec: {
    version: 1,
    initialViewId: 'main',
    views: [
      {
        id: 'main',
        root: {
          type: 'Container',
          direction: 'column',
          gap: 'md',
          padding: 'md',
          children: [
            {type: 'Heading', text: 'Morning routine', level: 1},
            {type: 'Toggle', id: 'made_bed', label: 'Made bed'},
            {type: 'Toggle', id: 'stretched', label: 'Stretched'},
            {type: 'Toggle', id: 'cold_shower', label: 'Cold shower'},
            {
              type: 'Counter',
              id: 'streak',
              label: 'Day streak',
              min: 0,
            },
            {
              type: 'Button',
              label: 'Log today',
              action: {type: 'increment', targetId: 'streak', by: 1},
              variant: 'primary',
            },
            {
              type: 'Button',
              label: 'Reset streak',
              action: {type: 'set', targetId: 'streak', value: 0},
              variant: 'secondary',
            },
          ],
        },
      },
    ],
    initialState: {
      made_bed: false,
      stretched: false,
      cold_shower: false,
      streak: 0,
    },
  },
}

// ---------------------------------------------------------------------------
// 3. Decision flipper
//    Two TextInputs for options A and B; a Button that toasts a pick.
// ---------------------------------------------------------------------------
const decisionFlipper: SeedProject = {
  id: '00000000-0000-0000-0000-000000000012',
  title: 'Decision flipper',
  originalPrompt: 'Help me pick between two options',
  spec: {
    version: 1,
    initialViewId: 'main',
    views: [
      {
        id: 'main',
        root: {
          type: 'Container',
          direction: 'column',
          gap: 'md',
          padding: 'md',
          children: [
            {type: 'Heading', text: 'Pick one', level: 1},
            {
              type: 'Text',
              text: 'Enter two options and let the app decide.',
              color: 'muted',
            },
            {
              type: 'TextInput',
              id: 'option_a',
              label: 'Option A',
              placeholder: 'e.g. Pizza',
            },
            {
              type: 'TextInput',
              id: 'option_b',
              label: 'Option B',
              placeholder: 'e.g. Tacos',
            },
            {
              type: 'Button',
              label: 'Pick for me!',
              action: {
                type: 'toast',
                message: 'The coin says: Option A! (flip again to change your mind)',
              },
              variant: 'primary',
            },
          ],
        },
      },
    ],
  },
}

// ---------------------------------------------------------------------------
// 4. Expense logger
//    TextInput for amount + description, Button to log (toast confirmation).
// ---------------------------------------------------------------------------
const expenseLogger: SeedProject = {
  id: '00000000-0000-0000-0000-000000000013',
  title: "Today's spend",
  originalPrompt: 'A simple daily expense logger',
  spec: {
    version: 1,
    initialViewId: 'main',
    views: [
      {
        id: 'main',
        root: {
          type: 'Container',
          direction: 'column',
          gap: 'md',
          padding: 'md',
          children: [
            {type: 'Heading', text: "Today's spend", level: 1},
            {
              type: 'TextInput',
              id: 'amount',
              label: 'Amount ($)',
              placeholder: 'e.g. 12.50',
            },
            {
              type: 'TextInput',
              id: 'description',
              label: 'What for?',
              placeholder: 'e.g. Coffee',
            },
            {
              type: 'Counter',
              id: 'entry_count',
              label: 'Entries logged',
              min: 0,
            },
            {
              type: 'Button',
              label: 'Log it',
              action: {type: 'increment', targetId: 'entry_count', by: 1},
              variant: 'primary',
            },
            {
              type: 'Button',
              label: 'Clear',
              action: {type: 'set', targetId: 'entry_count', value: 0},
              variant: 'secondary',
            },
          ],
        },
      },
    ],
    initialState: {
      entry_count: 0,
    },
  },
}

// ---------------------------------------------------------------------------
// 5. Counter playground
//    A single Counter + increment / decrement / reset buttons.
// ---------------------------------------------------------------------------
const counterPlayground: SeedProject = {
  id: '00000000-0000-0000-0000-000000000014',
  title: 'Counter playground',
  originalPrompt: 'A simple counter with increment, decrement, and reset',
  spec: {
    version: 1,
    initialViewId: 'main',
    views: [
      {
        id: 'main',
        root: {
          type: 'Container',
          direction: 'column',
          gap: 'md',
          padding: 'md',
          align: 'center',
          children: [
            {type: 'Heading', text: 'Counter', level: 1},
            {
              type: 'Counter',
              id: 'count',
              label: 'Count',
              min: 0,
            },
            {
              type: 'Container',
              direction: 'row',
              gap: 'sm',
              children: [
                {
                  type: 'Button',
                  label: '+1',
                  action: {type: 'increment', targetId: 'count', by: 1},
                  variant: 'primary',
                },
                {
                  type: 'Button',
                  label: '-1',
                  action: {type: 'decrement', targetId: 'count', by: 1},
                  variant: 'secondary',
                },
                {
                  type: 'Button',
                  label: 'Reset',
                  action: {type: 'set', targetId: 'count', value: 0},
                  variant: 'secondary',
                },
              ],
            },
          ],
        },
      },
    ],
    initialState: {
      count: 0,
    },
  },
}

// ---------------------------------------------------------------------------
// Validation + hash computation
// ---------------------------------------------------------------------------
const SEEDS: SeedProject[] = [
  tipSplitter,
  habitTracker,
  decisionFlipper,
  expenseLogger,
  counterPlayground,
]

function validateSeeds(): Map<string, string> {
  const hashes = new Map<string, string>()

  for (const seed of SEEDS) {
    // 1. Zod validation
    const parsed = A2UISpecSchema.parse(seed.spec)
    // 2. Deep validation (depth, action targets, view ids)
    deepValidateSpec(parsed)
    // 3. Compute hash against parsed (post-Zod) spec
    hashes.set(seed.id, renderHash(parsed))
    console.error(`  [ok] ${seed.title} → ${hashes.get(seed.id)?.slice(0, 16)}...`)
  }

  return hashes
}

// ---------------------------------------------------------------------------
// SQL generation
// ---------------------------------------------------------------------------
function escape(s: string): string {
  // SQL single-quote escape: ' → ''
  return s.replace(/'/g, "''")
}

function generateSql(hashes: Map<string, string>): string {
  const lines: string[] = []

  lines.push('-- 0004_example_seeds.sql')
  lines.push('-- ADR-0002 Step 2: cold-start seeding (AC-CG-S1, AC-CG-S2, AC-CG-S3).')
  lines.push('--')
  lines.push('-- Idempotent: all INSERTs use ON CONFLICT (id) DO NOTHING.')
  lines.push('-- Deterministic: spec_json and render_hash are authoritative values')
  lines.push('-- computed by scripts/generate-seed-sql.ts at author time.')
  lines.push('-- Do NOT edit spec_json or render_hash by hand — re-run the script.')
  lines.push('')

  // @example user
  lines.push('-- @example system user (no auth credentials, cannot be signed in)')
  lines.push(`INSERT INTO users (id, email, handle, created_at)`)
  lines.push(`VALUES (`)
  lines.push(`  '${EXAMPLE_USER_ID}',`)
  lines.push(`  'example@reserved.localhost',`)
  lines.push(`  'example',`)
  lines.push(`  '2020-01-01T00:00:00Z'`)
  lines.push(`)`)
  lines.push(`ON CONFLICT (id) DO NOTHING;`)
  lines.push('')

  for (const seed of SEEDS) {
    const hash = hashes.get(seed.id)!
    const specJsonEscaped = escape(JSON.stringify(seed.spec))
    // Derive a deterministic version UUID: same as project ID but with the
    // third group incremented from 0000 to 0001.
    const vId = seed.id.replace('00000000-0000-0000-0000', '00000000-0000-0000-0001')

    lines.push(`-- Seed: ${seed.title}`)

    // Step 1: INSERT project (current_version_id = NULL initially)
    lines.push(
      `INSERT INTO projects (id, owner_id, title, visibility, published_at, original_prompt, created_at, updated_at)`,
    )
    lines.push(`VALUES (`)
    lines.push(`  '${seed.id}',`)
    lines.push(`  '${EXAMPLE_USER_ID}',`)
    lines.push(`  '${escape(seed.title)}',`)
    lines.push(`  'public',`)
    lines.push(`  '2020-01-01T00:00:00Z',`)
    lines.push(`  '${escape(seed.originalPrompt)}',`)
    lines.push(`  '2020-01-01T00:00:00Z',`)
    lines.push(`  '2020-01-01T00:00:00Z'`)
    lines.push(`)`)
    lines.push(`ON CONFLICT (id) DO NOTHING;`)
    lines.push('')

    // Step 2: INSERT project_version
    lines.push(`INSERT INTO project_versions (id, project_id, spec_json, render_hash, created_at)`)
    lines.push(`VALUES (`)
    lines.push(`  '${vId}',`)
    lines.push(`  '${seed.id}',`)
    lines.push(`  '${specJsonEscaped}'::jsonb,`)
    lines.push(`  '${hash}',`)
    lines.push(`  '2020-01-01T00:00:00Z'`)
    lines.push(`)`)
    lines.push(`ON CONFLICT (id) DO NOTHING;`)
    lines.push('')

    // Step 3: UPDATE project to set current_version_id
    lines.push(`UPDATE projects`)
    lines.push(`  SET current_version_id = '${vId}'`)
    lines.push(`  WHERE id = '${seed.id}' AND current_version_id IS NULL;`)
    lines.push('')
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
console.error('Validating seeds...')
const hashes = validateSeeds()
console.error(`All ${SEEDS.length} seeds valid.`)
const sql = generateSql(hashes)
process.stdout.write(sql)
