-- Migration: 0003_division_bracket
-- Adds division and bracketCode nullable columns to Game
-- Safe: both columns are nullable, no data loss, fully backward-compatible

ALTER TABLE "Game"
  ADD COLUMN IF NOT EXISTS "division" TEXT,
  ADD COLUMN IF NOT EXISTS "bracketCode" TEXT;

-- Index for efficient division-filtered queries
CREATE INDEX IF NOT EXISTS "Game_tournament_division_idx" ON "Game"("tournamentId", "division");

-- Back-fill division from the home team's division where home team has a division set
-- (This is a best-effort migration; null is a valid state and will be handled by the app)
UPDATE "Game" g
SET "division" = t."division"
FROM "Team" t
WHERE g."homeTeamId" = t."id"
  AND t."division" IS NOT NULL
  AND g."division" IS NULL;
