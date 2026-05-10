-- ADR-0007 Step 5: out_of_scope_intent table.
--
-- Stores out-of-scope detection captures:
--   1. Detection fires from /generate (telemetry only; no row yet).
--   2. Capture fires from /out-of-scope-intent (row inserted here).
--
-- prompt_hash: sha256 hex of the user prompt, computed server-side.
--   Length-64 CHECK enforces the canonical sha256 hex form.
--   Lowercase-only is enforced at the API layer (Zod regex /^[a-f0-9]{64}$/).
--   The DB CHECK uses character_length(prompt_hash) = 64; hex-char
--   enforcement lives in the route's Zod body schema (T-0007-185).
--
-- reason: model-supplied reason string; ≤200 chars enforced by CHECK.
--
-- email: optional email for "notify me" capture; ≤320 chars (RFC 5321 max).
--   NULL = user dismissed without entering email.
--
-- user_id: ON DELETE SET NULL — row retained for analytics even if the
--   user deletes their account (ownership disassociated, not dropped).
--
-- Indexes:
--   capability + created_at DESC — for per-capability trend queries.
--   user_id + created_at DESC    — for per-user intent queries.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS (T-0007-102 migration smoke).

CREATE TABLE IF NOT EXISTS out_of_scope_intent (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        REFERENCES users(id) ON DELETE SET NULL,
  capability  text        NOT NULL
                          CHECK (capability IN (
                            'image_gen', 'vision', 'chat',
                            'transcription', 'classification', 'unknown'
                          )),
  prompt_hash text        NOT NULL
                          CHECK (length(prompt_hash) = 64),
  reason      text        NOT NULL
                          CHECK (length(reason) <= 200),
  email       text        CHECK (email IS NULL OR length(email) <= 320),
  created_at  timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS out_of_scope_intent_capability_idx
  ON out_of_scope_intent (capability, created_at DESC);

CREATE INDEX IF NOT EXISTS out_of_scope_intent_user_idx
  ON out_of_scope_intent (user_id, created_at DESC);
