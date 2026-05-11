-- ADR-0010 Step 4: add prompt_version column to mini_app_versions.
--
-- Rationale (per ADR-0010 §Decision #5):
--   PROMPT_VERSION is written at insert time from the imported const so
--   that post-launch analytics can join mini_app_versions × prompt_version ×
--   share rate without a separate lookup. The column is nullable so that
--   rows inserted before this migration (pre-v0.1.0) survive without
--   backfill — analytics queries use COALESCE(prompt_version, 'pre-v0.1.0').
--
-- Out-of-scope (per ADR-0010 §Decision #5):
--   out_of_scope_intent does NOT receive this column. OOS detection is
--   not prompt-driven in the sense that generation is; the cardinality /
--   value of grouping OOS detection by prompt version is marginal.
--
-- Idempotent: ALTER TABLE ... ADD COLUMN IF NOT EXISTS.

ALTER TABLE mini_app_versions
  ADD COLUMN IF NOT EXISTS prompt_version text;

-- Down-migration (reverse SQL — apply manually if rolling back):
--
-- ALTER TABLE mini_app_versions DROP COLUMN IF EXISTS prompt_version;
