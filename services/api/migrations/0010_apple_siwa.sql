-- ADR-0013 Step 1: Sign in with Apple — new columns on users + apple_refresh_tokens table.
--
-- users.apple_user_id: stable Apple-issued per-app user identifier (the "sub" claim).
--   UNIQUE NULL — magic-link users coexist with apple_user_id = NULL.
--   Identity model: sub-keyed, not email-keyed. See ADR-0013 §Decision 2.
--
-- users.display_name: display name captured on first sign-in only. Apple emits
--   the user's name exactly once (first consent grant); subsequent sign-ins send
--   no name. NULL = not captured yet or user skipped name scope.
--
-- users.apple_refresh_at: timestamp of the last Apple refresh token rotation.
--   NULL = no rotation has occurred. Used by the background token-rotation job
--   (V0.5+). Nullable intentionally — not used in V0.
--
-- apple_refresh_tokens: per-session SIWA refresh tokens, stored as sha256 hashes.
--   Plaintext token issued once to the client; only the hash is persisted.
--   ON DELETE CASCADE: when a user row is deleted, their tokens are purged.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS + CREATE TABLE IF NOT EXISTS (no-op on re-run).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS apple_user_id  text,
  ADD COLUMN IF NOT EXISTS display_name   text,
  ADD COLUMN IF NOT EXISTS apple_refresh_at timestamptz;

-- UNIQUE constraint on apple_user_id (allows NULLs — each NULL is distinct).
-- Idempotent: CREATE UNIQUE INDEX IF NOT EXISTS.
CREATE UNIQUE INDEX IF NOT EXISTS users_apple_user_id_idx
  ON users (apple_user_id)
  WHERE apple_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS apple_refresh_tokens (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  text        NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  revoked_at  timestamptz,
  expires_at  timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS apple_refresh_tokens_user_idx
  ON apple_refresh_tokens (user_id, created_at DESC);

-- Down-migration (reverse SQL — apply manually if rolling back):
--
-- DROP TABLE IF EXISTS apple_refresh_tokens;
-- DROP INDEX IF EXISTS users_apple_user_id_idx;
-- ALTER TABLE users
--   DROP COLUMN IF EXISTS apple_refresh_at,
--   DROP COLUMN IF EXISTS display_name,
--   DROP COLUMN IF EXISTS apple_user_id;
