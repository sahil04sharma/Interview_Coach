import { prisma } from '../db.js';
import { emptyScoredBelief, isIntelligenceV2Enabled } from './cognitiveModel.js';
import { reconcileHypothesesFromEvidence } from './hypothesisEngine.js';
import { updateConceptBeliefsFromEvidence } from './conceptGraph.js';

function clamp01(n, fallback = 0.5) {
  const v = Number(n);
  if (Number.isNaN(v)) return fallback;
  return Math.max(0, Math.min(1, v));
}

function dimensionFromField(field, turn) {
  if (!field) return emptyScoredBelief({ lastUpdatedTurn: turn });
  return {
    score: field.score,
    confidence: clamp01(field.confidence, 0),
    verification: 'unverified',
    evidenceIds: [],
    lastUpdatedTurn: turn,
    trend: 'unknown',
  };
}

/**
 * Persist evidence rows and update CCM dimensions from evaluator output.
 */
export async function applyEvidenceToModel({
  sessionId,
  userId,
  questionId,
  turn,
  technical,
  communication,
  model,
}) {
  const evidenceItems = [
    ...(technical?.evidence || []),
    ...(communication?.evidence || []),
  ];

  const createdIds = [];
  for (const item of evidenceItems) {
    const row = await prisma.evidence.create({
      data: {
        sessionId,
        questionId: questionId || null,
        turn,
        source: item.source,
        observation: item.observation,
        dimension: item.dimension || null,
        conceptSlugs: item.conceptSlugs || [],
        polarity: item.polarity || 'neutral',
        strength: item.strength ?? 0.5,
        confidence: item.confidence ?? 0.5,
        alternatives: item.alternatives || [],
        hypothesisId: item.hypothesisId || null,
      },
    });
    createdIds.push(row.id);
  }

  const dimensions = { ...(model.dimensions || {}) };

  if (technical) {
    dimensions.knowledge = dimensionFromField(technical.knowledge, turn);
    dimensions.understanding = dimensionFromField(technical.understanding, turn);
    dimensions.reasoning = dimensionFromField(technical.reasoning, turn);
    dimensions.depth = dimensionFromField(technical.depth, turn);
    dimensions.terminology = dimensionFromField(technical.terminology, turn);
    dimensions.architectureThinking = dimensionFromField(
      technical.architectureThinking,
      turn,
    );
    dimensions.productionThinking = dimensionFromField(
      technical.productionThinking,
      turn,
    );
    dimensions.problemSolving = dimensionFromField(technical.reasoning, turn);
  }

  if (communication) {
    dimensions.communication = dimensionFromField(communication.communication, turn);
    dimensions.structure = dimensionFromField(communication.structure, turn);
  }

  const updated = {
    ...model,
    dimensions,
    meta: {
      ...(model.meta || {}),
      turn,
      lastEvidenceCount: createdIds.length,
    },
  };

  let concepts = model.concepts || [];
  let neighborhoodInfluences = [];

  if (isIntelligenceV2Enabled() && technical) {
    const graphResult = await updateConceptBeliefsFromEvidence({
      model: { ...updated, concepts },
      technical,
      turn,
    });
    concepts = graphResult.model.concepts;
    neighborhoodInfluences = graphResult.influences;
    updated.concepts = concepts;
    updated.meta.conceptDeltaCount = graphResult.conceptDeltaCount;
    updated.meta.neighborhoodInfluenceCount = neighborhoodInfluences.length;
  }

  await prisma.cognitiveModel.upsert({
    where: { sessionId },
    create: {
      sessionId,
      userId,
      dimensions,
      concepts,
      impressions: model.impressions || [],
      signals: model.signals ?? null,
      growth: model.growth ?? null,
    },
    update: {
      dimensions,
      concepts,
    },
  });

  const hypothesisResult = await reconcileHypothesesFromEvidence({
    sessionId,
    evidenceIds: createdIds,
    technical,
    turn,
  });

  return {
    model: updated,
    evidenceIds: createdIds,
    neighborhoodInfluences,
    ...hypothesisResult,
  };
}
