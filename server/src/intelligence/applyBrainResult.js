import { prisma } from '../db.js';
import { mergeSplitEvaluation } from './legacyMapping.js';
import { applyEvidenceToModel } from './evidenceEngine.js';
import { persistMisconceptions } from './hypothesisEngine.js';
import { loadCognitiveModel } from './cognitiveModel.js';

/**
 * Map Brain coaching + scored fields into legacy normalizeEvaluation input.
 */
export function mapBrainToEvaluation(brain) {
  if (!brain?.technical || !brain?.communication) return null;
  const { normalized, mergedRaw, technical, communication } = mergeSplitEvaluation(
    brain.technical,
    brain.communication,
    brain.coaching || {},
  );
  return { normalized, mergedRaw, technical, communication };
}

/**
 * Apply Brain hypothesis / uncertainty update proposals (IDs must exist in DB).
 * Links evidence via Evidence.hypothesisId (not a Hypothesis.evidenceIds array).
 */
export async function applyBrainHypothesisUpdates({
  sessionId,
  hypothesisUpdates = [],
  uncertaintyUpdates = [],
  evidenceIds = [],
}) {
  let updatedHypotheses = 0;
  let resolvedUncertainties = 0;

  for (const update of hypothesisUpdates) {
    if (!update.hypothesisId) continue;
    const existing = await prisma.hypothesis.findFirst({
      where: { id: update.hypothesisId, sessionId },
    });
    if (!existing) continue;

    let status = existing.status;
    if (update.action === 'support') status = 'supported';
    if (update.action === 'refute') status = 'refuted';
    if (update.action === 'open') status = 'open';

    await prisma.hypothesis.update({
      where: { id: existing.id },
      data: {
        status,
        confidence: update.confidence ?? existing.confidence,
      },
    });
    updatedHypotheses += 1;

    for (const ref of update.evidenceRefs || []) {
      let evidenceId = null;
      if (typeof ref === 'number' && evidenceIds[ref]) evidenceId = evidenceIds[ref];
      else if (typeof ref === 'string' && evidenceIds.includes(ref)) evidenceId = ref;
      if (!evidenceId) continue;
      await prisma.evidence.updateMany({
        where: { id: evidenceId, sessionId },
        data: { hypothesisId: existing.id },
      });
    }
  }

  for (const update of uncertaintyUpdates) {
    if (update.action === 'resolve' && update.uncertaintyId) {
      const existing = await prisma.uncertainty.findFirst({
        where: { id: update.uncertaintyId, sessionId },
      });
      if (!existing) continue;
      await prisma.uncertainty.update({
        where: { id: existing.id },
        data: { status: 'resolved' },
      });
      resolvedUncertainties += 1;
    } else if (update.action === 'raise' && update.about) {
      await prisma.uncertainty.create({
        data: {
          sessionId,
          about: update.about,
          conceptSlugs: [],
          priority: 0.5,
          status: 'open',
        },
      });
    }
  }

  return { updatedHypotheses, resolvedUncertainties };
}

/**
 * Persist Brain turn results via existing engines.
 */
export async function applyBrainResult({
  session,
  questionId,
  turn,
  brain,
}) {
  if (!brain?.technical && !brain?.communication) {
    return {
      evidenceIds: [],
      updatedHypotheses: 0,
      resolvedUncertainties: 0,
      misconceptionIds: [],
      neighborhoodInfluences: [],
    };
  }

  const model = await loadCognitiveModel(session);
  const evidenceResult = await applyEvidenceToModel({
    sessionId: session.id,
    userId: session.userId,
    questionId,
    turn,
    technical: brain.technical,
    communication: brain.communication,
    model,
  });

  const brainHypothesis = await applyBrainHypothesisUpdates({
    sessionId: session.id,
    hypothesisUpdates: brain.hypothesisUpdates || [],
    uncertaintyUpdates: brain.uncertaintyUpdates || [],
    evidenceIds: evidenceResult.evidenceIds || [],
  });

  let misconceptionIds = [];
  if (brain.misconceptions?.length) {
    misconceptionIds = await persistMisconceptions({
      sessionId: session.id,
      misconceptions: brain.misconceptions,
    });
  }

  return {
    evidenceIds: evidenceResult.evidenceIds || [],
    updatedHypotheses:
      (evidenceResult.updatedHypotheses || 0) + (brainHypothesis.updatedHypotheses || 0),
    resolvedUncertainties:
      (evidenceResult.resolvedUncertainties || 0) +
      (brainHypothesis.resolvedUncertainties || 0),
    misconceptionIds,
    neighborhoodInfluences: evidenceResult.neighborhoodInfluences || [],
  };
}
