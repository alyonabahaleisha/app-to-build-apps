-- ADR-0011 Step 1: rename projects → mini_apps, project_versions → mini_app_versions.
--
-- Single BEGIN/COMMIT transaction: any failure mid-script rolls back all renames
-- and column additions atomically. Partial states cannot persist (T-0011-014a).
--
-- sync_mode column rationale (Cal R3 Option 1):
--   Added WITHOUT a Postgres DEFAULT clause so existing rows are NULL immediately
--   after ADD COLUMN. The COALESCE UPDATE below then backfills each row to
--   'local' (correct grandfathered semantics — pre-sync rows are local by default,
--   per AC-P10 privacy-safer). If we attached DEFAULT 'cloud-private' here,
--   Postgres would fill every existing row with 'cloud-private' immediately, the
--   WHERE IS NULL clause would never match, and the backfill would silently not
--   fire (see Roz R2 P1 finding). The application-level default for new rows
--   ('cloud-private') is supplied by the Drizzle schema layer, not this migration.

BEGIN;

-- ---------------------------------------------------------------------------
-- Table renames (metadata-only in Postgres; no table rewrite)
-- ---------------------------------------------------------------------------
ALTER TABLE projects             RENAME TO mini_apps;
ALTER TABLE project_versions     RENAME TO mini_app_versions;

-- ---------------------------------------------------------------------------
-- Column renames — embed the new semantic name
-- ---------------------------------------------------------------------------
ALTER TABLE mini_apps        RENAME COLUMN parent_project_id TO parent_mini_app_id;
ALTER TABLE mini_app_versions RENAME COLUMN project_id        TO mini_app_id;

-- ---------------------------------------------------------------------------
-- Index renames (Postgres preserves the old name across table renames;
-- rename explicitly so the name matches the new table)
-- ---------------------------------------------------------------------------
ALTER INDEX IF EXISTS projects_owner_idx         RENAME TO mini_apps_owner_idx;
ALTER INDEX IF EXISTS projects_library_idx        RENAME TO mini_apps_library_idx;
ALTER INDEX IF EXISTS project_versions_project_idx RENAME TO mini_app_versions_mini_app_idx;
ALTER INDEX IF EXISTS messages_project_idx        RENAME TO messages_mini_app_idx;

-- ---------------------------------------------------------------------------
-- New columns on mini_apps — ADD as nullable, backfill sentinels, SET NOT NULL.
-- This sequence is required so pre-existing rows satisfy the NOT NULL constraint
-- after ALTER COLUMN ... SET NOT NULL (T-0011-015a, T-0011-015b).
-- ---------------------------------------------------------------------------
ALTER TABLE mini_apps ADD COLUMN IF NOT EXISTS stance          text;
ALTER TABLE mini_apps ADD COLUMN IF NOT EXISTS accent_palette  text;
ALTER TABLE mini_apps ADD COLUMN IF NOT EXISTS cover_art_seed  text;
ALTER TABLE mini_apps ADD COLUMN IF NOT EXISTS archetype       text;
ALTER TABLE mini_apps ADD COLUMN IF NOT EXISTS sync_mode       text;  -- no DEFAULT — see file header

-- Sentinel backfill: COALESCE so only NULL rows are written (idempotent re-run).
-- cover_art_seed uses gen_random_uuid()::text to guarantee per-row uniqueness
-- (T-0011-015b). All five columns are covered in a single UPDATE pass.
UPDATE mini_apps SET
  stance         = COALESCE(stance,        'productive'),
  accent_palette = COALESCE(accent_palette,'neutral'),
  cover_art_seed = COALESCE(cover_art_seed, gen_random_uuid()::text),
  archetype      = COALESCE(archetype,     'unknown'),
  sync_mode      = COALESCE(sync_mode,     'local')
WHERE stance IS NULL
   OR accent_palette IS NULL
   OR cover_art_seed IS NULL
   OR archetype IS NULL
   OR sync_mode IS NULL;

-- Now safe to enforce NOT NULL (all rows have values).
ALTER TABLE mini_apps ALTER COLUMN stance         SET NOT NULL;
ALTER TABLE mini_apps ALTER COLUMN accent_palette SET NOT NULL;
ALTER TABLE mini_apps ALTER COLUMN cover_art_seed SET NOT NULL;
ALTER TABLE mini_apps ALTER COLUMN archetype      SET NOT NULL;
ALTER TABLE mini_apps ALTER COLUMN sync_mode      SET NOT NULL;

-- ---------------------------------------------------------------------------
-- messages.project_id → messages.mini_app_id column rename
-- (messages still FK-references mini_apps.id; the FK itself is preserved
-- because Postgres renames the referencing column without dropping the constraint)
-- ---------------------------------------------------------------------------
ALTER TABLE messages RENAME COLUMN project_id TO mini_app_id;

-- ---------------------------------------------------------------------------
-- events.project_id — rename to mini_app_id for consistency
-- ---------------------------------------------------------------------------
ALTER TABLE events RENAME COLUMN project_id TO mini_app_id;

COMMIT;

-- ---------------------------------------------------------------------------
-- Down-migration (NOT auto-executed; documented for Eva/Ellis if rollback needed)
-- Execute manually in psql; confirm zero production rows exist first.
--
-- BEGIN;
--   ALTER TABLE events RENAME COLUMN mini_app_id TO project_id;
--   ALTER TABLE messages RENAME COLUMN mini_app_id TO project_id;
--   ALTER TABLE mini_apps ALTER COLUMN sync_mode      DROP NOT NULL;
--   ALTER TABLE mini_apps ALTER COLUMN archetype      DROP NOT NULL;
--   ALTER TABLE mini_apps ALTER COLUMN cover_art_seed DROP NOT NULL;
--   ALTER TABLE mini_apps ALTER COLUMN accent_palette DROP NOT NULL;
--   ALTER TABLE mini_apps ALTER COLUMN stance         DROP NOT NULL;
--   ALTER TABLE mini_apps DROP COLUMN IF EXISTS sync_mode;
--   ALTER TABLE mini_apps DROP COLUMN IF EXISTS archetype;
--   ALTER TABLE mini_apps DROP COLUMN IF EXISTS cover_art_seed;
--   ALTER TABLE mini_apps DROP COLUMN IF EXISTS accent_palette;
--   ALTER TABLE mini_apps DROP COLUMN IF EXISTS stance;
--   ALTER INDEX IF EXISTS messages_mini_app_idx         RENAME TO messages_project_idx;
--   ALTER INDEX IF EXISTS mini_app_versions_mini_app_idx RENAME TO project_versions_project_idx;
--   ALTER INDEX IF EXISTS mini_apps_library_idx          RENAME TO projects_library_idx;
--   ALTER INDEX IF EXISTS mini_apps_owner_idx            RENAME TO projects_owner_idx;
--   ALTER TABLE mini_app_versions RENAME COLUMN mini_app_id TO project_id;
--   ALTER TABLE mini_apps         RENAME COLUMN parent_mini_app_id TO parent_project_id;
--   ALTER TABLE mini_app_versions RENAME TO project_versions;
--   ALTER TABLE mini_apps         RENAME TO projects;
-- COMMIT;
-- ---------------------------------------------------------------------------
