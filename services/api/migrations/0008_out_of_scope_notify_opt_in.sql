-- ADR-0011 Step 1: add notify_opt_in column to out_of_scope_intent.
--
-- Consumed by Settings sheet's "Coming next update" section (Step 5).
-- PATCH /me/out-of-scope-intents/:capability toggles this flag per capability.
--
-- Idempotent: ALTER TABLE ... ADD COLUMN IF NOT EXISTS.

ALTER TABLE out_of_scope_intent
  ADD COLUMN IF NOT EXISTS notify_opt_in boolean NOT NULL DEFAULT false;

-- Down-migration (NOT auto-executed; documented for Eva/Ellis if rollback needed)
--
-- ALTER TABLE out_of_scope_intent DROP COLUMN IF EXISTS notify_opt_in;
