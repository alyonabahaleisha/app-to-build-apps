-- ADR-0011 Step 3: add archived_at and deleted_at columns to mini_apps.
--
-- archived_at: set by POST /me/mini-apps/:id/archive. NULL = not archived.
--   Idempotent: calling archive twice keeps the first timestamp.
-- deleted_at:  set by DELETE /me/mini-apps/:id (soft delete). NULL = not deleted.
--   Row is retained for analytics; GET /me/mini-apps excludes deleted rows.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS (no-op on re-run).

ALTER TABLE mini_apps
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at  timestamptz;
