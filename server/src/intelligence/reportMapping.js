import { asStringArray } from '../services/evaluationService.js';

function textFromItem(item) {
  if (typeof item === 'string') return item.trim();
  if (item && typeof item === 'object') return String(item.text || '').trim();
  return '';
}

function evidenceIdsFromItem(item) {
  if (!item || typeof item !== 'object') return [];
  return asStringArray(item.evidenceIds);
}

/**
 * Map V2 Report Writer output to normalizeVerdict-compatible shape + explainable extensions.
 */
export function mapReportWriterToVerdict(parsed) {
  const readiness = Number(parsed.readiness ?? parsed.readinessScore);
  const readinessScore = Number.isNaN(readiness) ? undefined : readiness;

  return {
    hiringVerdict: String(parsed.hiringVerdict || 'Leaning No Hire'),
    hireProbability: parsed.hireProbability,
    readinessScore,
    estimatedInterviewReadiness: readinessScore,
    reasoning: String(parsed.reasoning || ''),
    strengths: (parsed.strengths || []).map(textFromItem).filter(Boolean),
    weaknesses: (parsed.weaknesses || []).map(textFromItem).filter(Boolean),
    repeatedMistakes: asStringArray(parsed.repeatedMistakes),
    missedConcepts: asStringArray(parsed.missedConcepts),
    bestAnswerQ: parsed.bestAnswerQ != null ? String(parsed.bestAnswerQ) : null,
    worstAnswerQ: parsed.worstAnswerQ != null ? String(parsed.worstAnswerQ) : null,
    confidenceAnalysis: String(parsed.confidenceAnalysis || ''),
    communicationAnalysis: String(parsed.communicationAnalysis || ''),
    technicalAnalysis: String(parsed.technicalAnalysis || ''),
    recommendedLearningPath: String(parsed.recommendedLearningPath || ''),
    dimensionReport: parsed.dimensionReport || [],
    resolvedHypotheses: parsed.resolvedHypotheses || [],
    reportMisconceptions: parsed.misconceptions || [],
    strengthsDetailed: (parsed.strengths || []).filter((s) => s && typeof s === 'object'),
    weaknessesDetailed: (parsed.weaknesses || []).filter((w) => w && typeof w === 'object'),
  };
}

export function buildExplainableReportAnalysis(verdict, { source, error } = {}) {
  return {
    confidenceAnalysis: verdict.confidenceAnalysis,
    communicationAnalysis: verdict.communicationAnalysis,
    technicalAnalysis: verdict.technicalAnalysis,
    missedConcepts: verdict.missedConcepts,
    bestAnswerQ: verdict.bestAnswerQ,
    worstAnswerQ: verdict.worstAnswerQ,
    dimensionReport: verdict.dimensionReport || [],
    resolvedHypotheses: verdict.resolvedHypotheses || [],
    misconceptions: verdict.reportMisconceptions || [],
    intelligenceSource: source || 'v1',
    ...(error ? { intelligenceError: error } : {}),
  };
}
