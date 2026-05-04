-- ADR-0001 Step 1: initial schema.
--
-- Idempotent (T-0001-005): every DDL uses IF NOT EXISTS.
-- pgvector extension installed first (T-0001-002).
-- The projects ↔ project_versions FK cycle is broken by deferring the
-- projects.current_version_id FK to migration 0002_project_version_fk.sql.

CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id          uuid PRIMARY KEY,
  email       text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- projects
--   current_version_id is intentionally nullable here; FK added in 0002.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title               text NOT NULL,
  current_version_id  uuid,
  parent_project_id   uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS projects_owner_idx
  ON projects (owner_id, updated_at DESC);

-- ---------------------------------------------------------------------------
-- project_versions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_versions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  spec_json    jsonb NOT NULL,
  render_hash  text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_versions_project_idx
  ON project_versions (project_id);

-- ---------------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role            text NOT NULL,
  content         text NOT NULL,
  tool_call_json  jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_project_idx
  ON messages (project_id, created_at);

-- ---------------------------------------------------------------------------
-- facts (Phase 2 memory layer; schema lives here from day 1)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS facts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content            text NOT NULL,
  source_message_id  uuid REFERENCES messages(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS facts_user_idx
  ON facts (user_id, created_at);

-- ---------------------------------------------------------------------------
-- memory_embeddings — vector(1536), one per fact
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS memory_embeddings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fact_id     uuid NOT NULL REFERENCES facts(id) ON DELETE CASCADE,
  embedding   vector(1536) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS memory_embeddings_fact_idx
  ON memory_embeddings (fact_id);

-- ---------------------------------------------------------------------------
-- events — analytics + LLM call audit. Payload is scrubbed (no PII).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
  id            bigserial PRIMARY KEY,
  user_id       uuid REFERENCES users(id) ON DELETE SET NULL,
  project_id    uuid REFERENCES projects(id) ON DELETE SET NULL,
  event_type    text NOT NULL,
  payload_json  jsonb NOT NULL DEFAULT '{}'::jsonb,
  duration_ms   integer,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS events_user_idx
  ON events (user_id, created_at);

CREATE INDEX IF NOT EXISTS events_type_idx
  ON events (event_type, created_at);
