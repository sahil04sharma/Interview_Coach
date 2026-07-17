-- Lifelong Role Curriculum foundation
-- See docs/future-concerns/03-lifelong-role-curriculum.md

-- Extend UserConceptMastery for spaced repetition / progress graph
ALTER TABLE "UserConceptMastery" ALTER COLUMN "status" SET DEFAULT 'not_started';
ALTER TABLE "UserConceptMastery" ADD COLUMN IF NOT EXISTS "difficultyReached" TEXT;
ALTER TABLE "UserConceptMastery" ADD COLUMN IF NOT EXISTS "evidenceCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "UserConceptMastery" ADD COLUMN IF NOT EXISTS "lastEvidenceAt" TIMESTAMP(3);
ALTER TABLE "UserConceptMastery" ADD COLUMN IF NOT EXISTS "nextReviewAt" TIMESTAMP(3);
ALTER TABLE "UserConceptMastery" ADD COLUMN IF NOT EXISTS "reviewIntervalDays" DOUBLE PRECISION;
ALTER TABLE "UserConceptMastery" ADD COLUMN IF NOT EXISTS "misconceptionNotes" TEXT[] DEFAULT ARRAY[]::TEXT[];

CREATE INDEX IF NOT EXISTS "UserConceptMastery_nextReviewAt_idx" ON "UserConceptMastery"("nextReviewAt");

CREATE TABLE IF NOT EXISTS "RoleCurriculum" (
    "id" TEXT NOT NULL,
    "roleSlug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'active',
    "summary" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'seed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleCurriculum_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RoleCurriculum_roleSlug_key" ON "RoleCurriculum"("roleSlug");

CREATE TABLE IF NOT EXISTS "RoleCompetency" (
    "id" TEXT NOT NULL,
    "curriculumId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "importance" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "coverageTarget" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoleCompetency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RoleCompetency_curriculumId_slug_key" ON "RoleCompetency"("curriculumId", "slug");
CREATE INDEX IF NOT EXISTS "RoleCompetency_curriculumId_idx" ON "RoleCompetency"("curriculumId");

CREATE TABLE IF NOT EXISTS "RoleCompetencyConcept" (
    "id" TEXT NOT NULL,
    "competencyId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "difficultyBand" TEXT NOT NULL DEFAULT 'medium',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isCore" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RoleCompetencyConcept_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RoleCompetencyConcept_competencyId_conceptId_key" ON "RoleCompetencyConcept"("competencyId", "conceptId");
CREATE INDEX IF NOT EXISTS "RoleCompetencyConcept_competencyId_idx" ON "RoleCompetencyConcept"("competencyId");
CREATE INDEX IF NOT EXISTS "RoleCompetencyConcept_conceptId_idx" ON "RoleCompetencyConcept"("conceptId");

CREATE TABLE IF NOT EXISTS "UserRoleEnrollment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "curriculumId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "coveragePct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "velocity" TEXT NOT NULL DEFAULT 'unknown',
    "estimatedSessionsRemaining" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserRoleEnrollment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserRoleEnrollment_userId_curriculumId_key" ON "UserRoleEnrollment"("userId", "curriculumId");
CREATE INDEX IF NOT EXISTS "UserRoleEnrollment_userId_idx" ON "UserRoleEnrollment"("userId");

CREATE TABLE IF NOT EXISTS "CurriculumProposal" (
    "id" TEXT NOT NULL,
    "roleSlug" TEXT NOT NULL,
    "proposalType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "evidenceNote" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CurriculumProposal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CurriculumProposal_roleSlug_idx" ON "CurriculumProposal"("roleSlug");
CREATE INDEX IF NOT EXISTS "CurriculumProposal_status_idx" ON "CurriculumProposal"("status");

DO $$ BEGIN
  ALTER TABLE "RoleCompetency" ADD CONSTRAINT "RoleCompetency_curriculumId_fkey"
    FOREIGN KEY ("curriculumId") REFERENCES "RoleCurriculum"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "RoleCompetencyConcept" ADD CONSTRAINT "RoleCompetencyConcept_competencyId_fkey"
    FOREIGN KEY ("competencyId") REFERENCES "RoleCompetency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "RoleCompetencyConcept" ADD CONSTRAINT "RoleCompetencyConcept_conceptId_fkey"
    FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "UserRoleEnrollment" ADD CONSTRAINT "UserRoleEnrollment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "UserRoleEnrollment" ADD CONSTRAINT "UserRoleEnrollment_curriculumId_fkey"
    FOREIGN KEY ("curriculumId") REFERENCES "RoleCurriculum"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
