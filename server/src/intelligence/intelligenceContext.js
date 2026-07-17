import { prisma } from '../db.js';
import { loadCognitiveModel, isIntelligenceV2Enabled } from './cognitiveModel.js';
import { readMemory } from '../services/interviewMemory.js';
import {
  getPrerequisiteGapsFromGraph,
} from './conceptGraph.js';

function parseCurriculum(raw) {
  if (!raw) return null;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

/**
 * Load compact intelligence context for Director / next-question decisions.
 */
export async function loadSessionIntelligenceContext(session) {
  const [cognitiveModel, hypotheses, uncertainties, resumeClaims, misconceptions] =
    await Promise.all([
      loadCognitiveModel(session),
      prisma.hypothesis.findMany({
        where: { sessionId: session.id },
        orderBy: { priority: 'desc' },
        take: 12,
      }),
      prisma.uncertainty.findMany({
        where: { sessionId: session.id, status: 'open' },
        orderBy: { priority: 'desc' },
        take: 10,
      }),
      prisma.resumeClaim.findMany({
        where: { sessionId: session.id },
        orderBy: { createdAt: 'asc' },
        take: 12,
      }),
      prisma.misconception.findMany({
        where: { sessionId: session.id, status: { in: ['suspected', 'confirmed'] } },
        take: 8,
      }),
    ]);

  const memory = readMemory(session);

  const conceptBeliefs = (cognitiveModel.concepts || []).map((c) => ({
    conceptSlug: c.conceptSlug,
    score: c.knowledge?.score,
    confidence: c.knowledge?.confidence,
    verification: c.knowledge?.verification,
    status: c.status,
    neighborhoodInfluence: c.neighborhoodInfluence ?? 0,
    timesProbed: c.timesProbed ?? 0,
  }));

  let prerequisiteGaps = [];
  if (isIntelligenceV2Enabled()) {
    prerequisiteGaps = await getPrerequisiteGapsFromGraph(cognitiveModel);
  }

  return {
    cognitiveModel,
    memory,
    roleCurriculum: parseCurriculum(session.roleCurriculum),
    conceptBeliefs,
    prerequisiteGaps,
    hypotheses: hypotheses.map((h) => ({
      id: h.id,
      statement: h.statement,
      conceptSlugs: h.conceptSlugs,
      status: h.status,
      confidence: h.confidence,
      priority: h.priority,
      origin: h.origin,
    })),
    uncertainties: uncertainties.map((u) => ({
      id: u.id,
      about: u.about,
      conceptSlugs: u.conceptSlugs,
      priority: u.priority,
      status: u.status,
    })),
    resumeClaims: resumeClaims.map((c) => ({
      id: c.id,
      claim: c.claim,
      conceptSlugs: c.conceptSlugs,
      importance: c.importance,
      verification: c.verification,
    })),
    misconceptions: misconceptions.map((m) => ({
      id: m.id,
      conceptSlug: m.conceptSlug,
      statement: m.statement,
      status: m.status,
      ourConfidence: m.ourConfidence,
    })),
    coveredTopics: session.coveredTopics || memory.topicsCovered || [],
  };
}
