-- =====================================================================
-- 1) Drift repair (idempotent)
-- Production was managed with `prisma db push`, and the app used to add
-- these columns/tables at request time (ensureDbColumns /
-- ensureSettingsTable). Bring any such database in line with 0_init.
-- Every statement is a no-op on a database that already matches.
-- =====================================================================

ALTER TABLE "sources" ADD COLUMN IF NOT EXISTS "originalFilename" TEXT;
ALTER TABLE "sources" ADD COLUMN IF NOT EXISTS "fileUrl" TEXT;
ALTER TABLE "sources" ADD COLUMN IF NOT EXISTS "mimeType" TEXT;
ALTER TABLE "sources" ADD COLUMN IF NOT EXISTS "sourceType" TEXT DEFAULT 'document';
ALTER TABLE "sources" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'review';
ALTER TABLE "sources" ADD COLUMN IF NOT EXISTS "metadata" TEXT DEFAULT '{}';
ALTER TABLE "sources" ADD COLUMN IF NOT EXISTS "questionCount" INTEGER DEFAULT 0;
UPDATE "sources" SET "sourceType" = 'document' WHERE "sourceType" IS NULL;
UPDATE "sources" SET "status" = 'review' WHERE "status" IS NULL;
UPDATE "sources" SET "metadata" = '{}' WHERE "metadata" IS NULL;
UPDATE "sources" SET "questionCount" = 0 WHERE "questionCount" IS NULL;
ALTER TABLE "sources" ALTER COLUMN "sourceType" SET DEFAULT 'document', ALTER COLUMN "sourceType" SET NOT NULL;
ALTER TABLE "sources" ALTER COLUMN "status" SET DEFAULT 'review', ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "sources" ALTER COLUMN "metadata" SET DEFAULT '{}', ALTER COLUMN "metadata" SET NOT NULL;
ALTER TABLE "sources" ALTER COLUMN "questionCount" SET DEFAULT 0, ALTER COLUMN "questionCount" SET NOT NULL;

ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'published';
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "metadata" TEXT DEFAULT '{}';
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "tags" TEXT DEFAULT '[]';
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "citation" TEXT;
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "explanation" TEXT;
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "studyTip" TEXT;
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "passageId" TEXT;
UPDATE "questions" SET "status" = 'published' WHERE "status" IS NULL;
UPDATE "questions" SET "metadata" = '{}' WHERE "metadata" IS NULL;
UPDATE "questions" SET "tags" = '[]' WHERE "tags" IS NULL;
ALTER TABLE "questions" ALTER COLUMN "status" SET DEFAULT 'published', ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "questions" ALTER COLUMN "metadata" SET DEFAULT '{}', ALTER COLUMN "metadata" SET NOT NULL;
ALTER TABLE "questions" ALTER COLUMN "tags" SET DEFAULT '[]', ALTER COLUMN "tags" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'questions_passageId_fkey') THEN
    ALTER TABLE "questions" ADD CONSTRAINT "questions_passageId_fkey"
      FOREIGN KEY ("passageId") REFERENCES "passages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "questions_passageId_idx" ON "questions"("passageId");
CREATE INDEX IF NOT EXISTS "questions_status_idx" ON "questions"("status");

CREATE TABLE IF NOT EXISTS "studio_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    CONSTRAINT "studio_settings_pkey" PRIMARY KEY ("key")
);

-- =====================================================================
-- 2) Shared rate-limit counters
-- =====================================================================

CREATE TABLE IF NOT EXISTS "rate_limit_buckets" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("key")
);
CREATE INDEX IF NOT EXISTS "rate_limit_buckets_resetAt_idx" ON "rate_limit_buckets"("resetAt");

-- =====================================================================
-- 3) Missing foreign-key indexes
-- =====================================================================

CREATE INDEX IF NOT EXISTS "accounts_userId_idx" ON "accounts"("userId");
CREATE INDEX IF NOT EXISTS "attempts_questionId_idx" ON "attempts"("questionId");
CREATE INDEX IF NOT EXISTS "favorites_questionId_idx" ON "favorites"("questionId");
CREATE INDEX IF NOT EXISTS "passages_sourceId_idx" ON "passages"("sourceId");
CREATE INDEX IF NOT EXISTS "review_schedules_questionId_idx" ON "review_schedules"("questionId");
CREATE INDEX IF NOT EXISTS "sessions_userId_idx" ON "sessions"("userId");
