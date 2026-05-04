-- ADR-0001 Step 1, second migration: close the projects↔project_versions FK
-- cycle now that both tables exist (per ADR-0001 §"Notes for Colby" #2).
--
-- Idempotent: skips the ADD CONSTRAINT if the FK already exists. Postgres
-- has no "ADD CONSTRAINT IF NOT EXISTS" — emulate via a DO-block lookup
-- against information_schema.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'projects'
      AND constraint_name = 'projects_current_version_id_fk'
      AND constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE projects
      ADD CONSTRAINT projects_current_version_id_fk
      FOREIGN KEY (current_version_id)
      REFERENCES project_versions(id)
      ON DELETE SET NULL;
  END IF;
END
$$;
