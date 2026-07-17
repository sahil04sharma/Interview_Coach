-- CreateTable
CREATE TABLE "CognitiveModel" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dimensions" JSONB NOT NULL,
    "concepts" JSONB NOT NULL DEFAULT '[]',
    "impressions" JSONB NOT NULL DEFAULT '[]',
    "signals" JSONB,
    "growth" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CognitiveModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hypothesis" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "conceptSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "origin" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "priority" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "createdTurn" INTEGER NOT NULL DEFAULT 0,
    "lastTestedTurn" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Hypothesis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "questionId" TEXT,
    "turn" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL,
    "observation" TEXT NOT NULL,
    "dimension" TEXT,
    "conceptSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "polarity" TEXT NOT NULL DEFAULT 'neutral',
    "strength" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "alternatives" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hypothesisId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Misconception" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "conceptSlug" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "correctStatement" TEXT NOT NULL DEFAULT '',
    "candidateConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "ourConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "status" TEXT NOT NULL DEFAULT 'suspected',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Misconception_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumeClaim" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "claim" TEXT NOT NULL,
    "conceptSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "importance" TEXT NOT NULL DEFAULT 'medium',
    "verification" TEXT NOT NULL DEFAULT 'unverified',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResumeClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Uncertainty" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "about" TEXT NOT NULL,
    "conceptSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "linkedHypothesisId" TEXT,
    "priority" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Uncertainty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConceptEdge" (
    "id" TEXT NOT NULL,
    "fromSlug" TEXT NOT NULL,
    "toSlug" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 0.5,

    CONSTRAINT "ConceptEdge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CognitiveModel_sessionId_key" ON "CognitiveModel"("sessionId");

-- CreateIndex
CREATE INDEX "CognitiveModel_userId_idx" ON "CognitiveModel"("userId");

-- CreateIndex
CREATE INDEX "Hypothesis_sessionId_idx" ON "Hypothesis"("sessionId");

-- CreateIndex
CREATE INDEX "Evidence_sessionId_idx" ON "Evidence"("sessionId");

-- CreateIndex
CREATE INDEX "Evidence_questionId_idx" ON "Evidence"("questionId");

-- CreateIndex
CREATE INDEX "Evidence_hypothesisId_idx" ON "Evidence"("hypothesisId");

-- CreateIndex
CREATE INDEX "Misconception_sessionId_idx" ON "Misconception"("sessionId");

-- CreateIndex
CREATE INDEX "ResumeClaim_sessionId_idx" ON "ResumeClaim"("sessionId");

-- CreateIndex
CREATE INDEX "Uncertainty_sessionId_idx" ON "Uncertainty"("sessionId");

-- CreateIndex
CREATE INDEX "ConceptEdge_fromSlug_idx" ON "ConceptEdge"("fromSlug");

-- CreateIndex
CREATE INDEX "ConceptEdge_toSlug_idx" ON "ConceptEdge"("toSlug");

-- CreateIndex
CREATE UNIQUE INDEX "ConceptEdge_fromSlug_toSlug_type_key" ON "ConceptEdge"("fromSlug", "toSlug", "type");

-- AddForeignKey
ALTER TABLE "CognitiveModel" ADD CONSTRAINT "CognitiveModel_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hypothesis" ADD CONSTRAINT "Hypothesis_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Misconception" ADD CONSTRAINT "Misconception_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeClaim" ADD CONSTRAINT "ResumeClaim_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Uncertainty" ADD CONSTRAINT "Uncertainty_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
