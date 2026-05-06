/**
 * Drizzle schema — App Creator MVP, ADR-0001 Step 1 + ADR-0002 Step 1.
 *
 * Seven tables: users, projects, project_versions, messages, facts,
 * memory_embeddings (pgvector), events.
 *
 * ADR-0002 Step 1 additions:
 * - `users.handle`              — text, UNIQUE, nullable. Populated lazily on
 *                                 first publish. See 0003_marketplace_columns.sql.
 * - `projects.visibility`       — text NOT NULL DEFAULT 'private'. CHECK
 *                                 constrains to {'private','public'}. Text +
 *                                 CHECK (not pgEnum) for future extensibility
 *                                 (see ADR-0002 §B).
 * - `projects.published_at`     — timestamptz, nullable. Set on first publish;
 *                                 nulled on unpublish. NOT updated on re-publish
 *                                 (represents "first publish time at this
 *                                 visibility cycle").
 * - `projects.original_prompt`  — text NOT NULL DEFAULT ''. Stored verbatim from
 *                                 the user's prompt; never logged at INFO (AC-CG-Q1).
 *
 * Notes for future readers:
 * - Per ARCHITECTURE.md §5, `users` is mirrored from Supabase auth — the row's
 *   `id` matches the Supabase auth.users.id (a uuid). On every sign-in we
 *   upsert (see /auth/sync in ADR-0001 Step 3).
 * - `projects.current_version_id` is intentionally **nullable here** and the
 *   FK constraint is added in `0002_project_version_fk.sql` to break the
 *   `projects ↔ project_versions` cycle (see ADR-0001 §"Notes for Colby" #2).
 * - `memory_embeddings.embedding` uses pgvector dimension 1536
 *   (text-embedding-3-small). The migration must run
 *   `CREATE EXTENSION IF NOT EXISTS vector;` first — handled by hand in
 *   0001_init.sql since drizzle-kit doesn't emit it.
 * - Per retro-lessons.md (`normalizeRow` + passwordHash leak): table column
 *   sets are deliberately tight. Anything that looks PII-ish is called out in
 *   ADR-0001 §Data Sensitivity. Future store methods returning these rows
 *   must specify `auth-only` vs `public-safe` normalization paths.
 */
import {sql} from 'drizzle-orm'
import {
  bigserial,
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
// projects — owned by a user, points at the "current" project_version row.
// ---------------------------------------------------------------------------
export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, {onDelete: 'cascade'}),
    title: text('title').notNull(),
    // Nullable here; FK added in 0002_project_version_fk.sql once
    // project_versions exists. Avoids the chicken/egg cycle on first INSERT.
    currentVersionId: uuid('current_version_id'),
    parentProjectId: uuid('parent_project_id'),
    createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', {withTimezone: true}).notNull().defaultNow(),
    // ADR-0002: visibility + publish state. Text + CHECK (not pgEnum) per §B
    // of ADR-0002 — easier to extend for a future 'unlisted' value.
    visibility: text('visibility').notNull().default('private'),
    // Nullable — null means never published (or unpublished).
    publishedAt: timestamp('published_at', {withTimezone: true}),
    // Stored verbatim; never logged at INFO level (AC-CG-Q1). Populated on
    // /generate; carried to Library remixers via /library/:id (AC-CG-P6).
    originalPrompt: text('original_prompt').notNull().default(''),
  },
  t => ({
    // Library list query: WHERE owner_id = $1 ORDER BY updated_at DESC.
    ownerIdx: index('projects_owner_idx').on(t.ownerId, t.updatedAt.desc()),
    // ADR-0002 §M: partial index for /library feed — only public rows,
    // ordered by published_at DESC then id for stable cursor pagination.
    // Drizzle does not generate SQL for partial indexes; the actual partial
    // index lives in 0003_marketplace_columns.sql. This marker documents
    // the intent and is a no-op at the Drizzle schema level.
    libraryIdx: index('projects_library_idx').on(t.visibility, t.publishedAt.desc(), t.id),
  }),
)

// ---------------------------------------------------------------------------
// project_versions — immutable A2UI specs. One row per generation/edit.
// ---------------------------------------------------------------------------
export const projectVersions = pgTable(
  'project_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, {onDelete: 'cascade'}),
    specJson: jsonb('spec_json').notNull(),
    // sha256(canonicalize(spec_json)) — see packages/a2ui-schema/src/canonical.ts
    renderHash: text('render_hash').notNull(),
    createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
    // ADR-0004 Step 4: nullable plan artifact. NULL = M1 fallback path.
    // Populated by Plan→Build pipeline when PLAN_BUILD_PIPELINE_PERCENT > 0
    // and the planner runs successfully. See migration 0005_plan_json.sql.
    // owner-only field: excluded from public /library/:id response (Step 7).
    planJson: jsonb('plan_json'),
  },
  t => ({
    projectIdx: index('project_versions_project_idx').on(t.projectId),
  }),
)

// ---------------------------------------------------------------------------
// messages — chat history per project (for the LLM call context).
// ---------------------------------------------------------------------------
export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, {onDelete: 'cascade'}),
    role: text('role').notNull(), // 'user' | 'assistant' | 'system'
    content: text('content').notNull(),
    // Tool-call metadata if assistant emitted a structured tool input.
    toolCallJson: jsonb('tool_call_json'),
    createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
  },
  t => ({
    projectIdx: index('messages_project_idx').on(t.projectId, t.createdAt),
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
// ---------------------------------------------------------------------------
export const events = pgTable(
  'events',
  {
    id: bigserial('id', {mode: 'number'}).primaryKey(),
    userId: uuid('user_id').references(() => users.id, {onDelete: 'set null'}),
    projectId: uuid('project_id').references(() => projects.id, {onDelete: 'set null'}),
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
// Type exports — used by services for typed inserts/selects.
// ---------------------------------------------------------------------------
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Project = typeof projects.$inferSelect
export type NewProject = typeof projects.$inferInsert
export type ProjectVersion = typeof projectVersions.$inferSelect
export type NewProjectVersion = typeof projectVersions.$inferInsert
export type Message = typeof messages.$inferSelect
export type NewMessage = typeof messages.$inferInsert
export type Fact = typeof facts.$inferSelect
export type NewFact = typeof facts.$inferInsert
export type MemoryEmbedding = typeof memoryEmbeddings.$inferSelect
export type NewMemoryEmbedding = typeof memoryEmbeddings.$inferInsert
export type Event = typeof events.$inferSelect
export type NewEvent = typeof events.$inferInsert
