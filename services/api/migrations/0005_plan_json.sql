-- ADR-0004 Step 4: plan_json column on project_versions.
--
-- Adds:
--   project_versions.plan_json — jsonb, nullable. No default.
--
-- Idempotent (T-0004-056): uses ADD COLUMN IF NOT EXISTS.
--
-- Why nullable?
--   NULL is the explicit signal that this project_versions row came from the
--   M1 single-call fallback path (PLAN_BUILD_PIPELINE_PERCENT=0, or any of
--   the fallback triggers in §F-3). Pre-migration rows remain NULL; no
--   backfill. See ADR-0004 §G.

ALTER TABLE project_versions
  ADD COLUMN IF NOT EXISTS plan_json jsonb;
