DO $$ BEGIN
  CREATE TYPE "IngestStatus" AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "IngestKind" AS ENUM ('article', 'media');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "ContentIngestItem" (
  "id" TEXT NOT NULL,
  "tournamentId" TEXT NOT NULL,
  "kind" "IngestKind" NOT NULL,
  "status" "IngestStatus" NOT NULL DEFAULT 'pending',
  "source" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "imageUrl" TEXT,
  "excerpt" TEXT,
  "confidence" TEXT,
  "notes" TEXT,
  "importedToId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContentIngestItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ContentIngestItem_tournamentId_status_kind_idx"
  ON "ContentIngestItem"("tournamentId", "status", "kind");

CREATE INDEX IF NOT EXISTS "ContentIngestItem_source_status_idx"
  ON "ContentIngestItem"("source", "status");

ALTER TABLE "ContentIngestItem"
  ADD CONSTRAINT "ContentIngestItem_tournamentId_fkey"
  FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;