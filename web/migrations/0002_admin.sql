-- migrations/0002_admin.sql: what the admin (PLAN §7.8) needs on top of 0001.
-- The case-study fields the site already shows (lib/pages.ts CASE_STUDIES), as JSON columns,
-- and the placeholder colour for each image (width and height already exist).

ALTER TABLE projects ADD COLUMN tags    TEXT NOT NULL DEFAULT '[]';   -- ["Website","WhatsApp"]
ALTER TABLE projects ADD COLUMN built   TEXT NOT NULL DEFAULT '[]';   -- ["Online menu", ...]
ALTER TABLE projects ADD COLUMN results TEXT NOT NULL DEFAULT '[]';   -- [{"value","label","source"}]
ALTER TABLE projects ADD COLUMN team    TEXT NOT NULL DEFAULT '[]';   -- [{"slug","role"}]

ALTER TABLE project_images ADD COLUMN dominant_color TEXT;             -- "#aabbcc", the loading placeholder
