import { prisma } from '../db.js';
import { emptyScoredBelief, isIntelligenceV2Enabled } from './cognitiveModel.js';

export const NEIGHBORHOOD_DAMPING = 0.3;
export const MAX_CONFIDENCE_INFLUENCE = 0.12;
export const MAX_SCORE_INFLUENCE = 0.4;

function clamp(n, min, max) {
  const v = Number(n);
  if (Number.isNaN(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function clamp01(n, fallback = 0) {
  const v = Number(n);
  if (Number.isNaN(v)) return fallback;
  return Math.max(0, Math.min(1, v));
}

function ensureConceptEntry(concepts, slug, turn) {
  let entry = concepts.find((c) => c.conceptSlug === slug);
  if (!entry) {
    entry = {
      conceptSlug: slug,
      knowledge: emptyScoredBelief({ lastUpdatedTurn: turn }),
      understanding: emptyScoredBelief({ lastUpdatedTurn: turn }),
      status: 'unknown',
      timesProbed: 0,
    };
    concepts.push(entry);
  }
  return entry;
}

function statusFromScore(score) {
  if (score >= 8) return 'strong';
  if (score >= 6) return 'learning';
  if (score >= 4) return 'weak';
  return 'unknown';
}

/**
 * Load edges touching any of the given concept slugs (single-hop neighborhood).
 */
export async function loadNeighborEdges(conceptSlugs) {
  const slugs = [...new Set((conceptSlugs || []).filter(Boolean))];
  if (!slugs.length) return [];

  const [outgoing, incoming] = await Promise.all([
    prisma.conceptEdge.findMany({ where: { fromSlug: { in: slugs } } }),
    prisma.conceptEdge.findMany({ where: { toSlug: { in: slugs } } }),
  ]);

  const seen = new Set();
  const merged = [];
  for (const edge of [...outgoing, ...incoming]) {
    const key = `${edge.fromSlug}|${edge.toSlug}|${edge.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(edge);
  }
  return merged;
}

/**
 * Build direct concept deltas from technical evaluator concept lists.
 */
export function computeConceptDeltas(technical) {
  const deltas = new Map();

  const setDelta = (slug, patch) => {
    const prev = deltas.get(slug) || {
      scoreDelta: 0,
      confidenceDelta: 0,
      failed: false,
      direct: true,
    };
    deltas.set(slug, {
      scoreDelta: patch.scoreDelta ?? prev.scoreDelta,
      confidenceDelta: patch.confidenceDelta ?? prev.confidenceDelta,
      failed: patch.failed ?? prev.failed,
      direct: true,
    });
  };

  for (const slug of technical?.conceptsCorrect || []) {
    setDelta(slug, { scoreDelta: 0.6, confidenceDelta: 0.12, failed: false });
  }
  for (const slug of technical?.conceptsPartial || []) {
    setDelta(slug, { scoreDelta: -0.2, confidenceDelta: 0.05, failed: false });
  }
  for (const slug of technical?.conceptsIncorrect || []) {
    setDelta(slug, { scoreDelta: -1.2, confidenceDelta: -0.1, failed: true });
  }

  const knowledgeScore = technical?.knowledge?.score ?? null;
  for (const slug of technical?.knowledge?.conceptSlugs || []) {
    if (deltas.has(slug)) continue;
    const failed = knowledgeScore != null && knowledgeScore <= 6;
    setDelta(slug, {
      scoreDelta: failed ? -0.8 : 0.3,
      confidenceDelta: failed ? -0.08 : 0.08,
      failed,
    });
  }

  return deltas;
}

/**
 * Apply direct evidence updates to CCM concept beliefs.
 */
export function applyDirectConceptUpdates(model, technical, turn) {
  const deltas = computeConceptDeltas(technical);
  const concepts = [...(model.concepts || [])];

  for (const [slug, delta] of deltas) {
    const entry = ensureConceptEntry(concepts, slug, turn);
    entry.timesProbed = (entry.timesProbed || 0) + 1;
    entry.knowledge.score = clamp((entry.knowledge.score ?? 5) + delta.scoreDelta, 0, 10);
    entry.knowledge.confidence = clamp01(
      (entry.knowledge.confidence ?? 0) + Math.abs(delta.confidenceDelta),
    );
    entry.knowledge.verification = 'partially-verified';
    entry.knowledge.lastUpdatedTurn = turn;
    entry.knowledge.trend = delta.scoreDelta >= 0 ? 'rising' : 'falling';
    entry.status = statusFromScore(entry.knowledge.score);
    if (delta.failed && entry.knowledge.score <= 5) {
      entry.status = 'weak';
    }
  }

  return { model: { ...model, concepts }, deltas };
}

/**
 * Single-hop neighborhood influence. Adjusts confidence/score only — never verifies.
 */
export async function applyNeighborhoodInfluence(model, conceptDeltas, turn) {
  if (!isIntelligenceV2Enabled()) {
    return { model, influences: [] };
  }

  const slugs = [...conceptDeltas.keys()];
  if (!slugs.length) return { model, influences: [] };

  const edges = await loadNeighborEdges(slugs);
  if (!edges.length) return { model, influences: [] };

  const concepts = [...(model.concepts || [])];
  const influences = [];

  for (const [sourceSlug, delta] of conceptDeltas) {
    for (const edge of edges) {
      if (edge.fromSlug !== sourceSlug && edge.toSlug !== sourceSlug) continue;

      let neighborSlug = null;
      let confidenceDelta = 0;
      let scoreDelta = 0;
      let reason = '';

      if (edge.type === 'prerequisite') {
        // prerequisite(from -> to): `to` requires `from`
        if (edge.fromSlug === sourceSlug && delta.failed) {
          // Failed prerequisite → doubt dependent
          neighborSlug = edge.toSlug;
          confidenceDelta =
            -Math.abs(delta.confidenceDelta || 0.1) * edge.weight * NEIGHBORHOOD_DAMPING;
          reason = `prerequisite-failed:${sourceSlug}->${neighborSlug}`;
        } else if (edge.toSlug === sourceSlug && delta.failed) {
          // Failed dependent → infer prerequisite may be shaky
          neighborSlug = edge.fromSlug;
          confidenceDelta =
            -Math.abs(delta.confidenceDelta || 0.1) * edge.weight * NEIGHBORHOOD_DAMPING * 0.8;
          scoreDelta = -0.15 * edge.weight * NEIGHBORHOOD_DAMPING;
          reason = `dependent-failed:${sourceSlug}<-${neighborSlug}`;
        }
      } else if (edge.type === 'related') {
        neighborSlug = edge.fromSlug === sourceSlug ? edge.toSlug : edge.fromSlug;
        scoreDelta = delta.scoreDelta * edge.weight * NEIGHBORHOOD_DAMPING * 0.25;
        confidenceDelta = delta.confidenceDelta * edge.weight * NEIGHBORHOOD_DAMPING * 0.35;
        reason = `related:${sourceSlug}<->${neighborSlug}`;
      }

      if (!neighborSlug || (confidenceDelta === 0 && scoreDelta === 0)) continue;

      const entry = ensureConceptEntry(concepts, neighborSlug, turn);
      const prevConfidence = entry.knowledge.confidence ?? 0;
      const appliedConfidence = clamp(
        confidenceDelta,
        -MAX_CONFIDENCE_INFLUENCE,
        MAX_CONFIDENCE_INFLUENCE,
      );
      const appliedScore = clamp(scoreDelta, -MAX_SCORE_INFLUENCE, MAX_SCORE_INFLUENCE);

      entry.knowledge.confidence = clamp01(prevConfidence + appliedConfidence);
      if (appliedScore) {
        entry.knowledge.score = clamp((entry.knowledge.score ?? 5) + appliedScore, 0, 10);
      }
      entry.knowledge.verification = 'unverified';
      entry.knowledge.lastUpdatedTurn = turn;
      entry.neighborhoodInfluence = clamp(
        (entry.neighborhoodInfluence ?? 0) + appliedConfidence,
        -1,
        1,
      );
      if (entry.knowledge.score <= 4 && entry.status === 'unknown') {
        entry.status = 'weak';
      }

      influences.push({
        sourceSlug,
        neighborSlug,
        edgeType: edge.type,
        confidenceDelta: appliedConfidence,
        scoreDelta: appliedScore,
        reason,
        verification: 'unverified',
      });
    }
  }

  return { model: { ...model, concepts }, influences };
}

/**
 * Prerequisite gaps for Director: target concepts whose prerequisites look shaky.
 */
export function getPrerequisiteSequencingHints(model, targetSlugs = []) {
  const concepts = model?.concepts || [];
  const bySlug = new Map(concepts.map((c) => [c.conceptSlug, c]));
  const hints = [];

  const slugs =
    targetSlugs.length > 0
      ? targetSlugs
      : concepts.map((c) => c.conceptSlug).filter(Boolean);

  for (const slug of slugs) {
    const belief = bySlug.get(slug);
    if (!belief) continue;

    const prereqWeak = concepts.filter((c) => {
      if (c.conceptSlug === slug) return false;
      const score = c.knowledge?.score ?? 5;
      const conf = c.knowledge?.confidence ?? 0;
      const influenced = Math.abs(c.neighborhoodInfluence ?? 0) > 0.02;
      return (score <= 5 || influenced) && conf >= 0.1;
    });

    if (prereqWeak.length && (belief.knowledge?.score ?? 5) <= 6) {
      hints.push({
        targetConceptSlug: slug,
        suggestedPrerequisites: prereqWeak.slice(0, 3).map((c) => ({
          conceptSlug: c.conceptSlug,
          score: c.knowledge?.score,
          confidence: c.knowledge?.confidence,
          neighborhoodInfluence: c.neighborhoodInfluence ?? 0,
          verification: c.knowledge?.verification || 'unverified',
        })),
        rationale:
          'Dependent concept looks weak; probe prerequisites before deep follow-up (inferred, unverified).',
      });
    }
  }

  return hints;
}

/**
 * Load commonly-confused-with neighbors for misconception priors.
 */
export async function getMisconceptionPriors(conceptSlugs) {
  const slugs = [...new Set((conceptSlugs || []).filter(Boolean))];
  if (!slugs.length) return [];

  const edges = await loadNeighborEdges(slugs);
  const priors = [];

  for (const edge of edges) {
    if (edge.type !== 'commonly-confused-with') continue;
    const touches = slugs.includes(edge.fromSlug) || slugs.includes(edge.toSlug);
    if (!touches) continue;
    priors.push({
      fromSlug: edge.fromSlug,
      toSlug: edge.toSlug,
      weight: edge.weight,
      note: `Candidates often confuse ${edge.fromSlug} with ${edge.toSlug}`,
    });
  }

  return priors;
}

/**
 * Async prerequisite hints using DB edges (for Director context).
 */
export async function getPrerequisiteGapsFromGraph(model, targetSlugs = []) {
  const concepts = model?.concepts || [];
  const bySlug = new Map(concepts.map((c) => [c.conceptSlug, c]));

  const targets =
    targetSlugs.length > 0
      ? targetSlugs
      : concepts
          .filter((c) => (c.knowledge?.score ?? 5) <= 6 || (c.neighborhoodInfluence ?? 0) < -0.02)
          .map((c) => c.conceptSlug);

  if (!targets.length) return [];

  const edges = await prisma.conceptEdge.findMany({
    where: {
      type: 'prerequisite',
      toSlug: { in: targets },
    },
  });

  const gaps = [];
  for (const edge of edges) {
    const dependent = bySlug.get(edge.toSlug);
    const prereq = bySlug.get(edge.fromSlug);
    const dependentWeak =
      !dependent ||
      (dependent.knowledge?.score ?? 5) <= 6 ||
      (dependent.neighborhoodInfluence ?? 0) < -0.02;
    const prereqUnverified =
      !prereq ||
      prereq.knowledge?.verification === 'unverified' ||
      (prereq.knowledge?.confidence ?? 0) < 0.35;

    if (dependentWeak && prereqUnverified) {
      gaps.push({
        targetConceptSlug: edge.toSlug,
        prerequisiteSlug: edge.fromSlug,
        edgeWeight: edge.weight,
        prerequisiteConfidence: prereq?.knowledge?.confidence ?? 0,
        prerequisiteScore: prereq?.knowledge?.score ?? null,
        verification: prereq?.knowledge?.verification || 'unverified',
        rationale: `Probe ${edge.fromSlug} before deepening ${edge.toSlug} (prerequisite sequencing).`,
      });
    }
  }

  return gaps;
}

/**
 * Full concept graph update after evidence: direct updates + single-hop influence.
 */
export async function updateConceptBeliefsFromEvidence({ model, technical, turn }) {
  const { model: withDirect, deltas } = applyDirectConceptUpdates(model, technical, turn);
  const { model: withNeighbors, influences } = await applyNeighborhoodInfluence(
    withDirect,
    deltas,
    turn,
  );
  return { model: withNeighbors, influences, conceptDeltaCount: deltas.size };
}
