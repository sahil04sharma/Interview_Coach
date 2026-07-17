-- AlterTable
ALTER TABLE "CompanyStyle" ADD COLUMN     "behavioralWeight" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "codingWeight" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "communicationExpect" TEXT NOT NULL DEFAULT 'clear and structured',
ADD COLUMN     "difficulty" TEXT NOT NULL DEFAULT 'medium',
ADD COLUMN     "followUpAggressiveness" TEXT NOT NULL DEFAULT 'medium',
ADD COLUMN     "philosophy" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "preferredAnswerStyle" TEXT NOT NULL DEFAULT 'structured, specific, and honest about trade-offs',
ADD COLUMN     "systemDesignWeight" INTEGER NOT NULL DEFAULT 3;

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "accuracyScore" DOUBLE PRECISION,
ADD COLUMN     "conceptsCorrect" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "conceptsIncorrect" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "conceptsPartial" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "confidenceScore" DOUBLE PRECISION,
ADD COLUMN     "difficultyLevel" TEXT NOT NULL DEFAULT 'medium',
ADD COLUMN     "estimatedRevisionMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "knowledgeGaps" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "learningPriority" TEXT NOT NULL DEFAULT 'medium',
ADD COLUMN     "practicalScore" DOUBLE PRECISION,
ADD COLUMN     "problemSolvingScore" DOUBLE PRECISION,
ADD COLUMN     "productionThinking" DOUBLE PRECISION,
ADD COLUMN     "questionType" TEXT NOT NULL DEFAULT 'technical';

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "hireProbability" DOUBLE PRECISION,
ADD COLUMN     "memory" JSONB,
ADD COLUMN     "readinessScore" DOUBLE PRECISION,
ADD COLUMN     "recommendedPath" TEXT,
ADD COLUMN     "repeatedMistakes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "reportAnalysis" JSONB,
ADD COLUMN     "strengths" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "verdictReasoning" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "weaknesses" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "Concept" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL DEFAULT 'general',
    "description" TEXT NOT NULL DEFAULT '',
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Concept_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserConceptMastery" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "masteryScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "partialCount" INTEGER NOT NULL DEFAULT 0,
    "incorrectCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'weak',
    "repeatedMistakes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserConceptMastery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionConcept" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'partial',
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionConcept_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 0,
    "readinessScore" DOUBLE PRECISION,
    "items" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "forDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudyPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "communication" DOUBLE PRECISION,
    "readiness" DOUBLE PRECISION,
    "weakCount" INTEGER NOT NULL DEFAULT 0,
    "strongCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgressSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Concept_slug_key" ON "Concept"("slug");

-- CreateIndex
CREATE INDEX "Concept_parentId_idx" ON "Concept"("parentId");

-- CreateIndex
CREATE INDEX "Concept_domain_idx" ON "Concept"("domain");

-- CreateIndex
CREATE INDEX "UserConceptMastery_userId_idx" ON "UserConceptMastery"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserConceptMastery_userId_conceptId_key" ON "UserConceptMastery"("userId", "conceptId");

-- CreateIndex
CREATE INDEX "QuestionConcept_conceptId_idx" ON "QuestionConcept"("conceptId");

-- CreateIndex
CREATE INDEX "QuestionConcept_questionId_idx" ON "QuestionConcept"("questionId");

-- CreateIndex
CREATE INDEX "StudyPlan_userId_idx" ON "StudyPlan"("userId");

-- CreateIndex
CREATE INDEX "ProgressSnapshot_userId_idx" ON "ProgressSnapshot"("userId");

-- AddForeignKey
ALTER TABLE "Concept" ADD CONSTRAINT "Concept_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Concept"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserConceptMastery" ADD CONSTRAINT "UserConceptMastery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserConceptMastery" ADD CONSTRAINT "UserConceptMastery_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionConcept" ADD CONSTRAINT "QuestionConcept_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionConcept" ADD CONSTRAINT "QuestionConcept_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyPlan" ADD CONSTRAINT "StudyPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressSnapshot" ADD CONSTRAINT "ProgressSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
