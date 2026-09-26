-- migrations/0004_project_proof.sql: before -> after on the project card (plan D #8).
ALTER TABLE projects ADD COLUMN proof_before TEXT;   -- "6.1 s load"
ALTER TABLE projects ADD COLUMN proof_after  TEXT;   -- "0.9 s load"
