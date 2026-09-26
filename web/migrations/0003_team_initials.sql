-- migrations/0003_team_initials.sql: the monogram shown until a photo exists (TEAM.initials).
ALTER TABLE team_members ADD COLUMN initials TEXT;
