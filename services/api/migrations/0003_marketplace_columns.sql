-- ADR-0002 Step 1: marketplace columns + library partial index.
--
-- Adds:
--   users.handle              — text, UNIQUE, nullable. Populated on first publish.
--   projects.visibility       — text NOT NULL DEFAULT 'private' with CHECK.
--   projects.published_at     — timestamptz, nullable.
--   projects.original_prompt  — text NOT NULL DEFAULT ''.
--   projects_library_idx      — partial index for the /library feed query.
--
-- Idempotent (T-0002-003): every DDL uses IF NOT EXISTS; CHECK is guarded by a
-- DO-block information_schema lookup (Postgres has no "ADD CONSTRAINT IF NOT
-- EXISTS" syntax — emulate via the same pattern as 0002_project_version_fk.sql).

ALTER TABLE users ADD COLUMN IF NOT EXISTS handle text UNIQUE;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS original_prompt text NOT NULL DEFAULT '';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints
                 WHERE constraint_name = 'projects_visibility_chk') THEN
    ALTER TABLE projects ADD CONSTRAINT projects_visibility_chk
      CHECK (visibility IN ('private', 'public'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS projects_library_idx
  ON projects (visibility, published_at DESC, id)
  WHERE visibility = 'public';
