-- migrations/0005_team_building.sql: the honest "currently building" line on each ID card (plan D #9).
ALTER TABLE team_members ADD COLUMN building TEXT;
