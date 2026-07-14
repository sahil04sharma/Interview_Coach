-- AlterTable
ALTER TABLE "Session" ADD COLUMN "coveredTopics" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Session" ADD COLUMN "currentQuestion" TEXT;
ALTER TABLE "Session" ADD COLUMN "currentIsFollowUp" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "CurriculumCache" (
    "id" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "curriculum" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurriculumCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CurriculumCache_cacheKey_key" ON "CurriculumCache"("cacheKey");
