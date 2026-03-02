-- Enums
CREATE TYPE "TournamentStatus" AS ENUM ('upcoming', 'live', 'completed');
CREATE TYPE "GameStatus" AS ENUM ('scheduled', 'live', 'final');

-- Tournament
CREATE TABLE "Tournament" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "status" "TournamentStatus" NOT NULL DEFAULT 'upcoming',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "Tournament_year_name_key" ON "Tournament"("year","name");
CREATE INDEX "Tournament_year_status_idx" ON "Tournament"("year","status");

-- Team
CREATE TABLE "Team" (
  "id" TEXT PRIMARY KEY,
  "tournamentId" TEXT NOT NULL,
  "classYearLabel" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "division" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Team_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Team_tournament_displayName_key" ON "Team"("tournamentId","displayName");
CREATE INDEX "Team_tournament_division_idx" ON "Team"("tournamentId","division");

-- Game
CREATE TABLE "Game" (
  "id" TEXT PRIMARY KEY,
  "tournamentId" TEXT NOT NULL,
  "homeTeamId" TEXT NOT NULL,
  "awayTeamId" TEXT NOT NULL,
  "startTime" TIMESTAMP(3) NOT NULL,
  "venue" TEXT,
  "status" "GameStatus" NOT NULL DEFAULT 'scheduled',
  "homeScore" INTEGER,
  "awayScore" INTEGER,
  "streamUrl" TEXT,
  "ticketUrl" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Game_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Game_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Game_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Game_tournament_startTime_idx" ON "Game"("tournamentId","startTime");
CREATE INDEX "Game_status_idx" ON "Game"("status");

-- Standing
CREATE TABLE "Standing" (
  "id" TEXT PRIMARY KEY,
  "tournamentId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "wins" INTEGER NOT NULL DEFAULT 0,
  "losses" INTEGER NOT NULL DEFAULT 0,
  "pointsFor" INTEGER NOT NULL DEFAULT 0,
  "pointsAgainst" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Standing_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Standing_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Standing_tournament_team_key" ON "Standing"("tournamentId","teamId");
CREATE INDEX "Standing_tournament_wins_losses_idx" ON "Standing"("tournamentId","wins","losses");

-- ArticleLink
CREATE TABLE "ArticleLink" (
  "id" TEXT PRIMARY KEY,
  "tournamentId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ArticleLink_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ArticleLink_tournament_publishedAt_idx" ON "ArticleLink"("tournamentId","publishedAt");

-- Sponsor
CREATE TABLE "Sponsor" (
  "id" TEXT PRIMARY KEY,
  "tournamentId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "logoUrl" TEXT,
  "targetUrl" TEXT,
  "tier" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Sponsor_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Sponsor_tournament_active_position_idx" ON "Sponsor"("tournamentId","active","position");
