-- ADR-0008 Step 1: share_link + share_link_clones tables.
--
-- share_links: one row per share action. share_id is a 24-char base62 opaque
--   string (ksuid-style) used as the URL token and primary key.
--   FK to mini_app_versions (immutable — freezes the spec at share time).
--   FK to users (owner, for V0.5 revocation without an extra JOIN).
--   Cover-art identity columns frozen at first share per ADR-0005 §K.
--   revoked_at: nullable, designed for V0.5 revocation without migration.
--
-- share_link_clones: idempotency guard. One row per (share_link_id, cloner_user_id).
--   UNIQUE constraint prevents duplicate clone rows under concurrent insert
--   (T-0008-013). ON CONFLICT DO NOTHING is the race-safety path in the
--   acceptCloneIntent transaction (T-0008-070).
--
-- Dependencies: mini_apps, mini_app_versions, users (all from ADR-0011).
--   If those tables don't exist, this migration fails — by design.
--   ADR-0011 MUST land before this migration (T-0008-020).
--
-- Idempotent: CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS share_links (
  share_id              text        PRIMARY KEY CHECK (length(share_id) = 24),
  mini_app_version_id   uuid        NOT NULL REFERENCES mini_app_versions(id) ON DELETE CASCADE,
  owner_user_id         uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cover_stance          text        NOT NULL CHECK (cover_stance IN ('productive','expressive')),
  cover_palette         text        NOT NULL CHECK (cover_palette IN ('focus','health','money','social','learn','play')),
  cover_icon            text        NOT NULL,
  cover_art_seed        text        NOT NULL CHECK (length(cover_art_seed) = 32),
  created_at            timestamptz NOT NULL DEFAULT now(),
  revoked_at            timestamptz
);

CREATE INDEX IF NOT EXISTS share_links_owner_idx
  ON share_links (owner_user_id);

CREATE INDEX IF NOT EXISTS share_links_version_idx
  ON share_links (mini_app_version_id);

-- CASCADE decision (Cal R2 + Roz PR 1 R1 SECURITY-2):
-- cloner_user_id ON DELETE CASCADE — account deletion removes the clone
--   ownership record. Matches AC-P8 ("source creator's data never exposed")
--   and standard GDPR erase-on-deletion. Alternative (SET NULL) would orphan
--   records for analytics purposes but weakens the privacy guarantee — rejected.
-- cloned_mini_app_id ON DELETE CASCADE — if the cloned mini_app row is deleted
--   (via owner_id cascade from users), the clone record disappears with it.
-- Dual-cascade path (user delete → mini_apps via owner_id → share_link_clones
--   via cloned_mini_app_id AND user delete → share_link_clones via cloner_user_id)
--   is intentional. Postgres deduplicates execution; no double-delete risk.
CREATE TABLE IF NOT EXISTS share_link_clones (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  share_link_id       text        NOT NULL REFERENCES share_links(share_id) ON DELETE CASCADE,
  cloner_user_id      uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cloned_mini_app_id  uuid        NOT NULL REFERENCES mini_apps(id) ON DELETE CASCADE,
  cloned_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (share_link_id, cloner_user_id)
);

-- Down-migration (reverse SQL — apply manually if rolling back):
--
-- DROP TABLE IF EXISTS share_link_clones;
-- DROP INDEX IF EXISTS share_links_version_idx;
-- DROP INDEX IF EXISTS share_links_owner_idx;
-- DROP TABLE IF EXISTS share_links;
