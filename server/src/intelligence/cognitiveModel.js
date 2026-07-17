/**
 * Candidate Cognitive Model (CCM) — read/write with V1 Session.memory fallback.
 * Design: docs/intelligence-v2/03-candidate-cognitive-model.md
 */

import { prisma } from '../db.js';
import { readMemory } from '../services/interviewMemory.js';

export const DIMENSION_KEYS = [
  'knowledge',
  'understanding',
  'reasoning',
  'communication',
  'terminology',
  'depth',
  'confidence',
  'problemSolving',
  'architectureThinking',
  'productionThinking',
  'behavior',
  'learningAbility',
  'interviewReadiness',
];

function clamp(n, min, max) {
  const v = Number(n);
  if (Number.isNaN(v)) return min;
  return Math.max(min, Math.min(max, v));
}

export function emptyScoredBelief(overrides = {}) {
  return {
    score: 5,
    confidence: 0,
    verification: 'unverified',
    evidenceIds: [],
    lastUpdatedTurn: 0,
    trend: 'unknown',
    ...overrides,
  };
}

export function emptyDimensions() {
  return Object.fromEntries(DIMENSION_KEYS.map((key) => [key, emptyScoredBelief()]));
}

export function emptyGrowth() {
  return {
    perDimension: Object.fromEntries(DIMENSION_KEYS.map((key) => [key, { start: 5, current: 5 }])),
    recentlyImprovedConcepts: [],
    persistentlyWeakConcepts: [],
    respondedToCoaching: null,
  };
}

/**
 * In-memory CCM shape (session scope). Hypotheses/claims live in separate tables later.
 */
export function emptyCognitiveModel({ sessionId, userId, difficulty = 'medium' } = {}) {
  return {
    sessionId,
    userId,
    updatedAt: new Date().toISOString(),
    dimensions: emptyDimensions(),
    concepts: [],
    impressions: [],
    signals: null,
    growth: emptyGrowth(),
    meta: {
      difficulty,
      turn: 0,
      source: 'empty',
    },
  };
}

function scoredFromMemoryScore(score, turn = 0) {
  const s = clamp(score, 0, 10);
  return emptyScoredBelief({
    score: s,
    confidence: s > 0 ? 0.25 : 0,
    verification: 'unverified',
    lastUpdatedTurn: turn,
    trend: 'unknown',
  });
}

/**
 * Synthesize a minimal CCM from V1 Session.memory when no CognitiveModel row exists.
 */
export function cognitiveModelFromMemory(session) {
  const memory = readMemory(session);
  const model = emptyCognitiveModel({
    sessionId: session.id,
    userId: session.userId,
    difficulty: memory.difficulty || session.difficulty || 'medium',
  });

  model.meta.source = 'memory-fallback';
  model.meta.turn = memory.questionsAsked?.length || 0;

  const last = memory.lastScores;
  if (last) {
    model.dimensions.knowledge = scoredFromMemoryScore(
      last.technical ?? last.accuracy,
      model.meta.turn,
    );
    model.dimensions.communication = scoredFromMemoryScore(last.communication, model.meta.turn);
    model.dimensions.depth = scoredFromMemoryScore(last.depth, model.meta.turn);
    model.dimensions.confidence = scoredFromMemoryScore(last.confidence, model.meta.turn);
    model.dimensions.problemSolving = scoredFromMemoryScore(last.technical, model.meta.turn);
    model.dimensions.interviewReadiness = scoredFromMemoryScore(
      (Number(last.technical || 0) + Number(last.communication || 0)) / 2,
      model.meta.turn,
    );
  }

  if (memory.communicationQuality != null) {
    model.dimensions.communication.score = clamp(memory.communicationQuality, 0, 10);
  }
  if (memory.depthQuality != null) {
    model.dimensions.depth.score = clamp(memory.depthQuality, 0, 10);
  }
  if (memory.confidenceLevel != null) {
    model.dimensions.confidence.score = clamp(memory.confidenceLevel, 0, 10);
  }

  for (const slug of memory.weakTopics || []) {
    model.concepts.push({
      conceptSlug: slug,
      knowledge: emptyScoredBelief({ score: 4, confidence: 0.3, trend: 'falling' }),
      understanding: emptyScoredBelief({ score: 4, confidence: 0.2 }),
      status: 'weak',
      timesProbed: 0,
    });
  }

  for (const slug of memory.strongTopics || []) {
    model.concepts.push({
      conceptSlug: slug,
      knowledge: emptyScoredBelief({ score: 8, confidence: 0.3, trend: 'rising' }),
      understanding: emptyScoredBelief({ score: 8, confidence: 0.2 }),
      status: 'strong',
      timesProbed: 0,
    });
  }

  return model;
}

function rowToModel(row) {
  return {
    sessionId: row.sessionId,
    userId: row.userId,
    updatedAt: row.updatedAt.toISOString(),
    dimensions: row.dimensions,
    concepts: row.concepts || [],
    impressions: row.impressions || [],
    signals: row.signals ?? null,
    growth: row.growth ?? emptyGrowth(),
    meta: { source: 'database', turn: 0 },
  };
}

/**
 * Load CCM for a session. Falls back to V1 memory synthesis if no row exists.
 */
export async function loadCognitiveModel(session) {
  if (!session?.id) {
    throw new Error('loadCognitiveModel requires a session with id');
  }

  try {
    const row = await prisma.cognitiveModel.findUnique({
      where: { sessionId: session.id },
    });
    if (row) {
      return rowToModel(row);
    }
  } catch (err) {
    console.warn('[cognitiveModel] load failed, using memory fallback:', err.message);
  }

  return cognitiveModelFromMemory(session);
}

/**
 * Persist CCM dimensions/concepts/impressions to CognitiveModel (upsert).
 */
export async function saveCognitiveModel(model) {
  const { sessionId, userId, dimensions, concepts, impressions, signals, growth } = model;
  if (!sessionId || !userId) {
    throw new Error('saveCognitiveModel requires sessionId and userId');
  }

  const row = await prisma.cognitiveModel.upsert({
    where: { sessionId },
    create: {
      sessionId,
      userId,
      dimensions,
      concepts: concepts || [],
      impressions: impressions || [],
      signals: signals ?? null,
      growth: growth ?? emptyGrowth(),
    },
    update: {
      dimensions,
      concepts: concepts || [],
      impressions: impressions || [],
      signals: signals ?? null,
      growth: growth ?? emptyGrowth(),
    },
  });

  return rowToModel(row);
}

/**
 * Get or create an empty CCM row for a new session.
 */
export async function ensureCognitiveModel(session) {
  const existing = await prisma.cognitiveModel.findUnique({
    where: { sessionId: session.id },
  });
  if (existing) {
    return rowToModel(existing);
  }

  const model = emptyCognitiveModel({
    sessionId: session.id,
    userId: session.userId,
    difficulty: session.difficulty || 'medium',
  });
  return saveCognitiveModel(model);
}

export function isIntelligenceV2Enabled() {
  return String(process.env.INTELLIGENCE_V2 || '').toLowerCase() === 'true';
}

/** Fused Interview Brain path (requires V2). See docs/future-concerns/02-interview-brain-consolidation.md */
export function isIntelligenceBrainEnabled() {
  return (
    isIntelligenceV2Enabled() &&
    String(process.env.INTELLIGENCE_BRAIN || '').toLowerCase() === 'true'
  );
}
