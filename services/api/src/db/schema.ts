/**
 * Drizzle schema — App Creator MVP, ADR-0001 Step 1 + ADR-0002 Step 1.
 *
 * ADR-0011 Step 1: renamed tables.
 *   `projects`         → `mini_apps`        (TS export: miniApps)
 *   `project_versions` → `mini_app_versions` (TS export: miniAppVersions)
 *   Column renames:
 *     mini_apps.parent_mini_app_id    (was parent_project_id)
 *     mini_app_versions.mini_app_id   (was project_id)
 *     messages.mini_app_id            (was project_id)
 *     events.mini_app_id              (was project_id)
 *   New columns on mini_apps:
 *     stance, accent_palette, cover_art_seed, archetype — all text NOT NULL
 *     sync_mode — text NOT NULL, app-level default 'cloud-private' for new rows
 *                (NO Postgres-level DEFAULT; migration backfills pre-existing rows
 *                 with 'local' via COALESCE — see migration 0007 for rationale)
 *     archived_at, deleted_at — timestamptz nullable (migration 0009)
 *
 * The Project* / NewProject* / ProjectVersion* type names are DELETED, not
 * aliased — per Cal's hard-cutover directive. Any caller that still uses the
 * old names will fail typecheck (that's the point).
 *
 * Other tables: users, messages, facts, memory_embeddings, events,
 * out_of_scope_intent — unchanged except column renames noted above.
 *
 * Notes for future readers:
 * - Per ARCHITECTURE.md §5, `users` is mirrored from Supabase auth — the row's
 *   `id` matches the Supabase auth.users.id (a uuid). On every sign-in we
 *   upsert (see /auth/sync in ADR-0001 Step 3).
 * - `mini_apps.current_version_id` is intentionally **nullable here** and the
 *   FK constraint is added in `0002_project_version_fk.sql` to break the
 *   `mini_apps ↔ mini_app_versions` cycle.
 * - `memory_embeddings.embedding` uses pgvector dimension 1536
 *   (text-embedding-3-small).
 * - Per retro-lessons.md (`normalizeRow` + passwordHash leak): table column
 *   sets are deliberately tight. Anything that looks PII-ish is called out in
 *   ADR-0001 §Data Sensitivity. Future store methods returning these rows
 *   must specify `auth-only` vs `public-safe` normalization paths.
 */
import {sql} from 'drizzle-orm'
import {
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  vector,
} from 'drizzle-orm/pg-core'

// ---------------------------------------------------------------------------
// users — mirror of Supabase auth.users. PII (email) lives here.
// ---------------------------------------------------------------------------
export const users = pgTable('users', {
  // Matches Supabase auth.users.id. We don't generate UUIDs server-side.
  id: uuid('id').primaryKey(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
  // ADR-0002: nullable; populated lazily on first publish. DB-level UNIQUE
  // catches handle races between simultaneous first-publishes (AC-CG-P3).
  handle: text('handle').unique(),
})

// ---------------------------------------------------------------------------
// mini_apps — owned by a user, points at the "current" mini_app_versions row.
// (ADR-0011: renamed from `projects`)
// ---------------------------------------------------------------------------
export const miniApps = pgTable(
  'mini_apps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, {onDelete: 'cascade'}),
    title: text('title').notNull(),
    // Nullable here; FK carried from 0002_project_version_fk.sql.
    // The FK now references mini_app_versions.id (Postgres updated the FK
    // target automatically when we renamed the table in migration 0007).
    currentVersionId: uuid('current_version_id'),
    parentMiniAppId: uuid('parent_mini_app_id'),
    createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', {withTimezone: true}).notNull().defaultNow(),
    // ADR-0002: visibility + publish state (text + CHECK, not pgEnum).
    visibility: text('visibility').notNull().default('private'),
    // Nullable — null means never published (or unpublished).
    publishedAt: timestamp('published_at', {withTimezone: true}),
    // Stored verbatim; never logged at INFO level (AC-CG-Q1).
    originalPrompt: text('original_prompt').notNull().default(''),
    // ADR-0011: new V0 columns.
    // App-level defaults (no Postgres-level DEFAULT for sync_mode — see migration 0007).
    stance: text('stance').notNull(),
    accentPalette: text('accent_palette').notNull(),
    coverArtSeed: text('cover_art_seed').notNull(),
    archetype: text('archetype').notNull(),
    // New-row default is 'cloud-private'; existing rows backfilled to 'local' in migration.
    syncMode: text('sync_mode').notNull().default('cloud-private'),
    // ADR-0011 Step 3: soft-delete + archive timestamps.
    archivedAt: timestamp('archived_at', {withTimezone: true}),
    deletedAt: timestamp('deleted_at', {withTimezone: true}),
  },
  t => ({
    // Library list query: WHERE owner_id = $1 ORDER BY updated_at DESC.
    ownerIdx: index('mini_apps_owner_idx').on(t.ownerId, t.updatedAt.desc()),
    // Partial index for /library feed — only public rows.
    // Actual partial index created in 0003_marketplace_columns.sql (renamed in 0007).
    // This marker is a Drizzle schema hint; the partial WHERE clause lives in the SQL.
    libraryIdx: index('mini_apps_library_idx').on(t.visibility, t.publishedAt.desc(), t.id),
  }),
)

// ---------------------------------------------------------------------------
// mini_app_versions — immutable A2UI specs. One row per generation/edit.
// (ADR-0011: renamed from `project_versions`)
// ---------------------------------------------------------------------------
export const miniAppVersions = pgTable(
  'mini_app_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    miniAppId: uuid('mini_app_id')
      .notNull()
      .references(() => miniApps.id, {onDelete: 'cascade'}),
    specJson: jsonb('spec_json').notNull(),
    // sha256(canonicalize(spec_json)) — see packages/a2ui-schema/src/canonical.ts
    renderHash: text('render_hash').notNull(),
    createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
    // ADR-0004 Step 4: nullable plan artifact. NULL = M1 fallback path.
    // V0: always NULL (plan concept removed per ADR-0007 §G).
    planJson: jsonb('plan_json'),
  },
  t => ({
    miniAppIdx: index('mini_app_versions_mini_app_idx').on(t.miniAppId),
  }),
)

// ---------------------------------------------------------------------------
// messages — chat history per mini_app (for the LLM call context).
// (ADR-0011: mini_app_id renamed from project_id)
// ---------------------------------------------------------------------------
export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    miniAppId: uuid('mini_app_id')
      .notNull()
      .references(() => miniApps.id, {onDelete: 'cascade'}),
    role: text('role').notNull(), // 'user' | 'assistant' | 'system'
    content: text('content').notNull(),
    // Tool-call metadata if assistant emitted a structured tool input.
    toolCallJson: jsonb('tool_call_json'),
    createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
  },
  t => ({
    miniAppIdx: index('messages_mini_app_idx').on(t.miniAppId, t.createdAt),
  }),
)

// ---------------------------------------------------------------------------
// facts — extracted memory items per user (Phase 2 memory layer).
// ---------------------------------------------------------------------------
export const facts = pgTable(
  'facts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, {onDelete: 'cascade'}),
    content: text('content').notNull(),
    sourceMessageId: uuid('source_message_id').references(() => messages.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
  },
  t => ({
    userIdx: index('facts_user_idx').on(t.userId, t.createdAt),
  }),
)

// ---------------------------------------------------------------------------
// memory_embeddings — pgvector(1536). Foreign-key to facts.
// ---------------------------------------------------------------------------
export const memoryEmbeddings = pgTable(
  'memory_embeddings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    factId: uuid('fact_id')
      .notNull()
      .references(() => facts.id, {onDelete: 'cascade'}),
    // text-embedding-3-small — 1536 dims. Hard-coded here; if we change models
    // we add a new column rather than mutating this one.
    embedding: vector('embedding', {dimensions: 1536}).notNull(),
    createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
  },
  t => ({
    factIdx: index('memory_embeddings_fact_idx').on(t.factId),
  }),
)

// ---------------------------------------------------------------------------
// events — analytics + LLM call audit. Payload is scrubbed (no PII).
// (ADR-0011: mini_app_id renamed from project_id)
// ---------------------------------------------------------------------------
export const events = pgTable(
  'events',
  {
    id: bigserial('id', {mode: 'number'}).primaryKey(),
    userId: uuid('user_id').references(() => users.id, {onDelete: 'set null'}),
    miniAppId: uuid('mini_app_id').references(() => miniApps.id, {onDelete: 'set null'}),
    eventType: text('event_type').notNull(),
    // Per ARCHITECTURE.md §9: scrubbed of PII before write.
    payloadJson: jsonb('payload_json')
      .notNull()
      .default(sql`'{}'::jsonb`),
    durationMs: integer('duration_ms'),
    createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
  },
  t => ({
    userIdx: index('events_user_idx').on(t.userId, t.createdAt),
    typeIdx: index('events_type_idx').on(t.eventType, t.createdAt),
  }),
)

// ---------------------------------------------------------------------------
// out_of_scope_intent — ADR-0007 Step 5.
// ADR-0011 Step 1 (migration 0008): adds notify_opt_in column.
// ---------------------------------------------------------------------------
export const outOfScopeIntent = pgTable(
  'out_of_scope_intent',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // ON DELETE SET NULL — row retained for analytics after account deletion.
    userId: uuid('user_id').references(() => users.id, {onDelete: 'set null'}),
    capability: text('capability').notNull(),
    // sha256 hex, 64 chars. Lowercase enforcement is at the API layer.
    promptHash: text('prompt_hash').notNull(),
    reason: text('reason').notNull(),
    // NULL = user dismissed without submitting email.
    email: text('email'),
    // ADR-0011 Step 1 (migration 0008): opt-in for V0.5 notifications.
    notifyOptIn: boolean('notify_opt_in').notNull().default(false),
    createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
  },
  t => ({
    // Per-capability trend queries.
    capabilityIdx: index('out_of_scope_intent_capability_idx').on(t.capability, t.createdAt.desc()),
    // Per-user intent queries.
    userIdx: index('out_of_scope_intent_user_idx').on(t.userId, t.createdAt.desc()),
  }),
)

// ---------------------------------------------------------------------------
// Type exports — used by services for typed inserts/selects.
// Old Project* / ProjectVersion* names are DELETED (not aliased) per
// ADR-0011 Cal hard-cutover directive. TypeCheck fails on any caller that
// still uses the old names — that's the refactor safety net.
// ---------------------------------------------------------------------------
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type MiniApp = typeof miniApps.$inferSelect
export type NewMiniApp = typeof miniApps.$inferInsert
export type MiniAppVersion = typeof miniAppVersions.$inferSelect
export type NewMiniAppVersion = typeof miniAppVersions.$inferInsert
export type Message = typeof messages.$inferSelect
export type NewMessage = typeof messages.$inferInsert
export type Fact = typeof facts.$inferSelect
export type NewFact = typeof facts.$inferInsert
export type MemoryEmbedding = typeof memoryEmbeddings.$inferSelect
export type NewMemoryEmbedding = typeof memoryEmbeddings.$inferInsert
export type Event = typeof events.$inferSelect
export type NewEvent = typeof events.$inferInsert
export type OutOfScopeIntent = typeof outOfScopeIntent.$inferSelect
export type NewOutOfScopeIntent = typeof outOfScopeIntent.$inferInsert
