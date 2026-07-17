import { prisma } from '../db.js';
import { loadCognitiveModel } from './cognitiveModel.js';

/**
 * Load full intelligence context for the Report Writer at session finish.
 */
export async function loadReportContext(session, questions = []) {
  const sessionId = session.id;

  const [cognitiveModel, hypotheses, evidence, misconceptions, resumeClaims, uncertainties] =
    await Promise.all([
      loadCognitiveModel(session),
      prisma.hypothesis.findMany({
        where: { sessionId },
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      }),
      prisma.evidence.findMany({
        where: { sessionId },
        orderBy: [{ turn: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.misconception.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.resumeClaim.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.uncertainty.findMany({
        where: { sessionId },
        orderBy: { priority: 'desc' },
      }),
    ]);

  const transcript = (questions || []).map((q, index) => ({
    turn: index + 1,
    questionText: q.questionText,
    userAnswer: q.userAnswer,
    isFollowUp: Boolean(q.isFollowUp),
    scores: {
      technical: q.technicalScore,
      communication: q.communicationScore,
      depth: q.depthScore,
      structure: q.structureScore,
    },
    topicTags: q.topicTags || [],
    conceptsCorrect: q.conceptsCorrect || [],
    conceptsPartial: q.conceptsPartial || [],
    conceptsIncorrect: q.conceptsIncorrect || [],
    knowledgeGaps: q.knowledgeGaps || [],
    feedback: q.feedback || '',
  }));

  return {
    cognitiveModel,
    hypotheses: hypotheses.map((h) => ({
      id: h.id,
      statement: h.statement,
      conceptSlugs: h.conceptSlugs,
      status: h.status,
      confidence: h.confidence,
      priority: h.priority,
      origin: h.origin,
      createdTurn: h.createdTurn,
      lastTestedTurn: h.lastTestedTurn,
    })),
    evidence: evidence.map((e) => ({
      id: e.id,
      turn: e.turn,
      source: e.source,
      observation: e.observation,
      dimension: e.dimension,
      conceptSlugs: e.conceptSlugs,
      polarity: e.polarity,
      strength: e.strength,
      confidence: e.confidence,
      hypothesisId: e.hypothesisId,
    })),
    misconceptions: misconceptions.map((m) => ({
      id: m.id,
      conceptSlug: m.conceptSlug,
      statement: m.statement,
      correctStatement: m.correctStatement,
      status: m.status,
      ourConfidence: m.ourConfidence,
    })),
    resumeClaims: resumeClaims.map((c) => ({
      id: c.id,
      claim: c.claim,
      conceptSlugs: c.conceptSlugs,
      importance: c.importance,
      verification: c.verification,
    })),
    uncertainties: uncertainties.map((u) => ({
      id: u.id,
      about: u.about,
      conceptSlugs: u.conceptSlugs,
      status: u.status,
      priority: u.priority,
    })),
    transcript,
    conceptBeliefs: (cognitiveModel.concepts || []).map((c) => ({
      conceptSlug: c.conceptSlug,
      score: c.knowledge?.score,
      confidence: c.knowledge?.confidence,
      verification: c.knowledge?.verification,
      neighborhoodInfluence: c.neighborhoodInfluence ?? 0,
      status: c.status,
    })),
  };
}
