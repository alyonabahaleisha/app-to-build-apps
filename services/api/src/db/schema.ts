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
  uniqueIndex,
  uuid,
  vector,
} from 'drizzle-orm/pg-core'

// ---------------------------------------------------------------------------
// users — mirror of Supabase auth.users. PII (email) lives here.
// ADR-0013: added apple_user_id (stable SIWA sub), display_name, apple_refresh_at.
// ---------------------------------------------------------------------------
export const users = pgTable('users', {
  // Matches Supabase auth.users.id. We don't generate UUIDs server-side.
  id: uuid('id').primaryKey(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
  // ADR-0002: nullable; populated lazily on first publish. DB-level UNIQUE
  // catches handle races between simultaneous first-publishes (AC-CG-P3).
  handle: text('handle').unique(),
  // ADR-0013: Apple "sub" claim — stable per-app-per-user identifier.
  // Unique via a partial index (see migration 0010; NULLs are not equal).
  // NULL for magic-link users; set on first SIWA sign-in.
  appleUserId: text('apple_user_id'),
  // ADR-0013: captured on first sign-in only (Apple emits name once). NULL if
  // the user skipped the name scope or this is a magic-link account.
  displayName: text('display_name'),
  // ADR-0013: timestamp of the last Apple refresh-token rotation (V0.5+ usage).
  appleRefreshAt: timestamp('apple_refresh_at', {withTimezone: true}),
})

// ---------------------------------------------------------------------------
// apple_refresh_tokens — SIWA session refresh tokens (sha256 hash only).
// ADR-0013 Step 1. Hashing rationale: §Decision Step 1 — high-entropy random
// input (32 bytes), so SHA-256 provides sufficient security; password-hashing
// KDFs add CPU cost with no marginal security benefit (T-0013-040).
// ---------------------------------------------------------------------------
export const appleRefreshTokens = pgTable(
  'apple_refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, {onDelete: 'cascade'}),
    // sha256 hex of the 32-byte random token. Unique — collision impossible.
    tokenHash: text('token_hash').notNull().unique(),
    createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', {withTimezone: true}),
    expiresAt: timestamp('expires_at', {withTimezone: true}).notNull(),
  },
  t => ({
    userIdx: index('apple_refresh_tokens_user_idx').on(t.userId, t.createdAt.desc()),
  }),
)

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
    // ADR-0010 Step 4: prompt version at the time this version was generated.
    // Nullable — rows inserted before migration 0012 have null; analytics
    // queries use COALESCE(prompt_version, 'pre-v0.1.0'). Written at insert
    // time from the PROMPT_VERSION const; never derived from user input.
    promptVersion: text('prompt_version'),
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
// share_links — one row per share action. share_id is a 24-char base62 opaque
// string used as the Universal Link token. FK to mini_app_versions (immutable
// source — share freezes the version at share time). ADR-0008 Step 1.
// ---------------------------------------------------------------------------
export const shareLinks = pgTable(
  'share_links',
  {
    // 24-char base62 string, generated server-side. PRIMARY KEY = public URL token.
    shareId: text('share_id').primaryKey(),
    // Immutable source — share_link points at the version current at share time.
    miniAppVersionId: uuid('mini_app_version_id')
      .notNull()
      .references(() => miniAppVersions.id, {onDelete: 'cascade'}),
    // Owner — for V0.5 owner-only revoke without extra JOIN.
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, {onDelete: 'cascade'}),
    // Cover-art identity frozen at first share — ADR-0005 §K.
    coverStance: text('cover_stance').notNull(),
    coverPalette: text('cover_palette').notNull(),
    coverIcon: text('cover_icon').notNull(),
    coverArtSeed: text('cover_art_seed').notNull(),
    createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
    // V0.5 revocation: nullable; never written in V0. Column present for no-migration revoke.
    revokedAt: timestamp('revoked_at', {withTimezone: true}),
  },
  t => ({
    ownerIdx: index('share_links_owner_idx').on(t.ownerUserId),
    versionIdx: index('share_links_version_idx').on(t.miniAppVersionId),
  }),
)

// ---------------------------------------------------------------------------
// share_link_clones — idempotency guard. One row per (share_link_id, cloner_user_id).
// UNIQUE constraint is the DB-level idempotency guarantee (T-0008-011, T-0008-013).
// ON CONFLICT DO NOTHING in acceptCloneIntent's transaction handles concurrent taps.
// ADR-0008 Step 1.
// ---------------------------------------------------------------------------
export const shareLinkClones = pgTable(
  'share_link_clones',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shareLinkId: text('share_link_id')
      .notNull()
      .references(() => shareLinks.shareId, {onDelete: 'cascade'}),
    clonerUserId: uuid('cloner_user_id')
      .notNull()
      .references(() => users.id, {onDelete: 'cascade'}),
    // FK to the clone the user created. ON DELETE CASCADE handles
    // a user deleting their clone — the lookup row goes too.
    clonedMiniAppId: uuid('cloned_mini_app_id')
      .notNull()
      .references(() => miniApps.id, {onDelete: 'cascade'}),
    clonedAt: timestamp('cloned_at', {withTimezone: true}).notNull().defaultNow(),
  },
  t => ({
    // Idempotency guard — one clone per (link, user). T-0008-011, T-0008-013.
    uniqueClone: uniqueIndex('share_link_clones_unique_idx').on(t.shareLinkId, t.clonerUserId),
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
export type AppleRefreshToken = typeof appleRefreshTokens.$inferSelect
export type NewAppleRefreshToken = typeof appleRefreshTokens.$inferInsert
export type ShareLink = typeof shareLinks.$inferSelect
export type NewShareLink = typeof shareLinks.$inferInsert
export type ShareLinkClone = typeof shareLinkClones.$inferSelect
export type NewShareLinkClone = typeof shareLinkClones.$inferInsert

// ---------------------------------------------------------------------------
// T-0013-133: Compile-time assertion — Drizzle $inferSelect shape includes
// the ADR-0013 columns. If the Drizzle definition omits a column (or types it
// incorrectly), this constant fails to type-check, catching schema drift early.
// Direction: `users.$inferSelect extends {field: T}` — fails if required fields absent.
// ---------------------------------------------------------------------------
const _assertUsersShape: typeof users.$inferSelect extends {
  appleUserId: string | null
  displayName: string | null
  appleRefreshAt: Date | null
}
  ? true
  : never = true
void _assertUsersShape

const _assertAppleRefreshTokensShape: typeof appleRefreshTokens.$inferSelect extends {
  id: string
  userId: string
  tokenHash: string
  createdAt: Date
  expiresAt: Date
}
  ? true
  : never = true
void _assertAppleRefreshTokensShape

// ---------------------------------------------------------------------------
// T-0008-001 / T-0008-002: Compile-time assertion — Drizzle $inferSelect shapes
// include all ADR-0008 columns. Fails typecheck if column omitted / mistyped.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// T-0010-089 / T-0010-090: Compile-time assertion — miniAppVersions includes
// the ADR-0010 Step 4 prompt_version column (nullable text).
// ---------------------------------------------------------------------------
const _assertMiniAppVersionsPromptVersionShape: typeof miniAppVersions.$inferSelect extends {
  promptVersion: string | null
}
  ? true
  : never = true
void _assertMiniAppVersionsPromptVersionShape

const _assertShareLinksShape: typeof shareLinks.$inferSelect extends {
  shareId: string
  miniAppVersionId: string
  ownerUserId: string
  coverStance: string
  coverPalette: string
  coverIcon: string
  coverArtSeed: string
  createdAt: Date
  revokedAt: Date | null
}
  ? true
  : never = true
void _assertShareLinksShape

const _assertShareLinkClonesShape: typeof shareLinkClones.$inferSelect extends {
  id: string
  shareLinkId: string
  clonerUserId: string
  clonedMiniAppId: string
  clonedAt: Date
}
  ? true
  : never = true
void _assertShareLinkClonesShape
