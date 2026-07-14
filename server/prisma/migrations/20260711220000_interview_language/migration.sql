-- AlterTable
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "interviewLanguage" TEXT NOT NULL DEFAULT 'english';
