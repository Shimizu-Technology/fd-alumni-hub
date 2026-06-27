-- Add optional media metadata fields to article links
ALTER TABLE "ArticleLink"
  ADD COLUMN IF NOT EXISTS "imageUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "excerpt" TEXT;