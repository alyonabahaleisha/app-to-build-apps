-- 0004_example_seeds.sql
-- ADR-0002 Step 2: cold-start seeding (AC-CG-S1, AC-CG-S2, AC-CG-S3).
--
-- Idempotent: all INSERTs use ON CONFLICT (id) DO NOTHING.
-- Deterministic: spec_json and render_hash are authoritative values
-- computed by scripts/generate-seed-sql.ts at author time.
-- Do NOT edit spec_json or render_hash by hand — re-run the script.

-- @example system user (no auth credentials, cannot be signed in)
INSERT INTO users (id, email, handle, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'example@reserved.localhost',
  'example',
  '2020-01-01T00:00:00Z'
)
ON CONFLICT (id) DO NOTHING;

-- Seed: Tip splitter
INSERT INTO projects (id, owner_id, title, visibility, published_at, original_prompt, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  'Tip splitter',
  'public',
  '2020-01-01T00:00:00Z',
  'A tip splitter for my favorite coffee shop',
  '2020-01-01T00:00:00Z',
  '2020-01-01T00:00:00Z'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO project_versions (id, project_id, spec_json, render_hash, created_at)
VALUES (
  '00000000-0000-0000-0001-000000000010',
  '00000000-0000-0000-0000-000000000010',
  '{"version":1,"initialViewId":"main","views":[{"id":"main","root":{"type":"Container","direction":"column","gap":"md","padding":"md","children":[{"type":"Heading","text":"Tip splitter","level":1},{"type":"Counter","id":"bill","label":"Bill ($)","min":0,"step":1},{"type":"Counter","id":"tip_pct","label":"Tip (%)","min":0,"max":100,"step":5},{"type":"Counter","id":"people","label":"People","min":1,"step":1},{"type":"Button","label":"Calculate tip","action":{"type":"toast","message":"Check the counters above for your split!"},"variant":"primary"}]}}],"initialState":{"bill":50,"tip_pct":18,"people":2}}'::jsonb,
  '96ba61ef777b0d0cc6e5bc3a91e0feeb9ed9a6f341ae8e9156206d12fdf7783f',
  '2020-01-01T00:00:00Z'
)
ON CONFLICT (id) DO NOTHING;

UPDATE projects
  SET current_version_id = '00000000-0000-0000-0001-000000000010'
  WHERE id = '00000000-0000-0000-0000-000000000010' AND current_version_id IS NULL;

-- Seed: Morning routine
INSERT INTO projects (id, owner_id, title, visibility, published_at, original_prompt, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000001',
  'Morning routine',
  'public',
  '2020-01-01T00:00:00Z',
  'A morning habit tracker with streak counter',
  '2020-01-01T00:00:00Z',
  '2020-01-01T00:00:00Z'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO project_versions (id, project_id, spec_json, render_hash, created_at)
VALUES (
  '00000000-0000-0000-0001-000000000011',
  '00000000-0000-0000-0000-000000000011',
  '{"version":1,"initialViewId":"main","views":[{"id":"main","root":{"type":"Container","direction":"column","gap":"md","padding":"md","children":[{"type":"Heading","text":"Morning routine","level":1},{"type":"Toggle","id":"made_bed","label":"Made bed"},{"type":"Toggle","id":"stretched","label":"Stretched"},{"type":"Toggle","id":"cold_shower","label":"Cold shower"},{"type":"Counter","id":"streak","label":"Day streak","min":0},{"type":"Button","label":"Log today","action":{"type":"increment","targetId":"streak","by":1},"variant":"primary"},{"type":"Button","label":"Reset streak","action":{"type":"set","targetId":"streak","value":0},"variant":"secondary"}]}}],"initialState":{"made_bed":false,"stretched":false,"cold_shower":false,"streak":0}}'::jsonb,
  'fcbeafa460e0d1a3c1a6dd389f4b4fb2471bc0f6a572823b7a001ae05c8c4aa3',
  '2020-01-01T00:00:00Z'
)
ON CONFLICT (id) DO NOTHING;

UPDATE projects
  SET current_version_id = '00000000-0000-0000-0001-000000000011'
  WHERE id = '00000000-0000-0000-0000-000000000011' AND current_version_id IS NULL;

-- Seed: Decision flipper
INSERT INTO projects (id, owner_id, title, visibility, published_at, original_prompt, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000012',
  '00000000-0000-0000-0000-000000000001',
  'Decision flipper',
  'public',
  '2020-01-01T00:00:00Z',
  'Help me pick between two options',
  '2020-01-01T00:00:00Z',
  '2020-01-01T00:00:00Z'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO project_versions (id, project_id, spec_json, render_hash, created_at)
VALUES (
  '00000000-0000-0000-0001-000000000012',
  '00000000-0000-0000-0000-000000000012',
  '{"version":1,"initialViewId":"main","views":[{"id":"main","root":{"type":"Container","direction":"column","gap":"md","padding":"md","children":[{"type":"Heading","text":"Pick one","level":1},{"type":"Text","text":"Enter two options and let the app decide.","color":"muted"},{"type":"TextInput","id":"option_a","label":"Option A","placeholder":"e.g. Pizza"},{"type":"TextInput","id":"option_b","label":"Option B","placeholder":"e.g. Tacos"},{"type":"Button","label":"Pick for me!","action":{"type":"toast","message":"The coin says: Option A! (flip again to change your mind)"},"variant":"primary"}]}}]}'::jsonb,
  'a266ceb93af85339c290cf007e354012c460892beb89248289ea523966f25158',
  '2020-01-01T00:00:00Z'
)
ON CONFLICT (id) DO NOTHING;

UPDATE projects
  SET current_version_id = '00000000-0000-0000-0001-000000000012'
  WHERE id = '00000000-0000-0000-0000-000000000012' AND current_version_id IS NULL;

-- Seed: Today's spend
INSERT INTO projects (id, owner_id, title, visibility, published_at, original_prompt, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000013',
  '00000000-0000-0000-0000-000000000001',
  'Today''s spend',
  'public',
  '2020-01-01T00:00:00Z',
  'A simple daily expense logger',
  '2020-01-01T00:00:00Z',
  '2020-01-01T00:00:00Z'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO project_versions (id, project_id, spec_json, render_hash, created_at)
VALUES (
  '00000000-0000-0000-0001-000000000013',
  '00000000-0000-0000-0000-000000000013',
  '{"version":1,"initialViewId":"main","views":[{"id":"main","root":{"type":"Container","direction":"column","gap":"md","padding":"md","children":[{"type":"Heading","text":"Today''s spend","level":1},{"type":"TextInput","id":"amount","label":"Amount ($)","placeholder":"e.g. 12.50"},{"type":"TextInput","id":"description","label":"What for?","placeholder":"e.g. Coffee"},{"type":"Counter","id":"entry_count","label":"Entries logged","min":0},{"type":"Button","label":"Log it","action":{"type":"increment","targetId":"entry_count","by":1},"variant":"primary"},{"type":"Button","label":"Clear","action":{"type":"set","targetId":"entry_count","value":0},"variant":"secondary"}]}}],"initialState":{"entry_count":0}}'::jsonb,
  '432a154c8ca69345fb2f27d440ad30bfed34d7f479f350e537baf162fe6257b6',
  '2020-01-01T00:00:00Z'
)
ON CONFLICT (id) DO NOTHING;

UPDATE projects
  SET current_version_id = '00000000-0000-0000-0001-000000000013'
  WHERE id = '00000000-0000-0000-0000-000000000013' AND current_version_id IS NULL;

-- Seed: Counter playground
INSERT INTO projects (id, owner_id, title, visibility, published_at, original_prompt, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000014',
  '00000000-0000-0000-0000-000000000001',
  'Counter playground',
  'public',
  '2020-01-01T00:00:00Z',
  'A simple counter with increment, decrement, and reset',
  '2020-01-01T00:00:00Z',
  '2020-01-01T00:00:00Z'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO project_versions (id, project_id, spec_json, render_hash, created_at)
VALUES (
  '00000000-0000-0000-0001-000000000014',
  '00000000-0000-0000-0000-000000000014',
  '{"version":1,"initialViewId":"main","views":[{"id":"main","root":{"type":"Container","direction":"column","gap":"md","padding":"md","align":"center","children":[{"type":"Heading","text":"Counter","level":1},{"type":"Counter","id":"count","label":"Count","min":0},{"type":"Container","direction":"row","gap":"sm","children":[{"type":"Button","label":"+1","action":{"type":"increment","targetId":"count","by":1},"variant":"primary"},{"type":"Button","label":"-1","action":{"type":"decrement","targetId":"count","by":1},"variant":"secondary"},{"type":"Button","label":"Reset","action":{"type":"set","targetId":"count","value":0},"variant":"secondary"}]}]}}],"initialState":{"count":0}}'::jsonb,
  '7826736ade31c244ac9530a7fdf4ade68ab1b909bf8eaeaa76b1c6e767f95278',
  '2020-01-01T00:00:00Z'
)
ON CONFLICT (id) DO NOTHING;

UPDATE projects
  SET current_version_id = '00000000-0000-0000-0001-000000000014'
  WHERE id = '00000000-0000-0000-0000-000000000014' AND current_version_id IS NULL;
