import { normalizeEvaluation } from '../services/evaluationService.js';

/**
 * Merge split evaluator outputs + V1 coaching fields into normalizeEvaluation input.
 * Scores come from split evaluators; coaching prose from V1 supplement.
 */
export function mergeSplitToLegacyRaw(technical, communication, coachingRaw = {}) {
  const star = communication.star || {};
  const practical = technical.productionThinking?.score ?? coachingRaw.practicalScore;

  return {
    ...coachingRaw,
    technicalScore: technical.knowledge.score,
    accuracyScore: technical.knowledge.score,
    depthScore: technical.depth.score,
    problemSolvingScore: technical.reasoning.score,
    productionThinking: technical.productionThinking.score,
    practicalScore: practical,
    communicationScore: communication.communication.score,
    structureScore: communication.structure.score,
    starSituation: star.situation,
    starTask: star.task,
    starAction: star.action,
    starResult: star.result,
    conceptsCorrect: technical.conceptsCorrect,
    conceptsPartial: technical.conceptsPartial,
    conceptsIncorrect: technical.conceptsIncorrect,
    knowledgeGaps: technical.knowledgeGaps,
    topicTags: technical.topicTags?.length
      ? technical.topicTags
      : coachingRaw.topicTags,
    confidenceScore: coachingRaw.confidenceScore,
  };
}

export function mergeSplitEvaluation(technical, communication, coachingRaw) {
  const mergedRaw = mergeSplitToLegacyRaw(technical, communication, coachingRaw);
  return {
    normalized: normalizeEvaluation(mergedRaw),
    mergedRaw,
    technical,
    communication,
  };
}
