export function clampScore(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(10, n));
}

export function optionalScore(value) {
  if (value === null || value === undefined || value === '') return null;
  return clampScore(value);
}

export function asStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map(String).map((s) => s.trim()).filter(Boolean);
}

/**
 * Normalize LLM evaluator JSON into persisted Question fields + response payload.
 */
export function normalizeEvaluation(raw = {}) {
  const technicalScore = clampScore(raw.technicalScore ?? raw.accuracyScore);
  const accuracyScore = clampScore(raw.accuracyScore ?? raw.technicalScore);
  const communicationScore = clampScore(raw.communicationScore);
  const depthScore = clampScore(raw.depthScore);
  const structureScore = clampScore(raw.structureScore);
  const problemSolvingScore = optionalScore(raw.problemSolvingScore ?? raw.depthScore);
  const practicalScore = optionalScore(raw.practicalScore ?? raw.practicalExperience);
  const productionThinking = optionalScore(raw.productionThinking ?? raw.productionThinkingScore);
  const confidenceScore = optionalScore(raw.confidenceScore ?? raw.confidence);

  const learningPriority = ['high', 'medium', 'low'].includes(
    String(raw.learningPriority || '').toLowerCase(),
  )
    ? String(raw.learningPriority).toLowerCase()
    : 'medium';

  const difficultyLevel = ['easy', 'medium', 'hard'].includes(
    String(raw.difficultyLevel || '').toLowerCase(),
  )
    ? String(raw.difficultyLevel).toLowerCase()
    : 'medium';

  const questionType = String(raw.questionType || 'technical').slice(0, 64);

  return {
    technicalScore,
    communicationScore,
    depthScore,
    structureScore,
    accuracyScore,
    problemSolvingScore,
    practicalScore,
    productionThinking,
    confidenceScore,
    starSituation: optionalScore(raw.starSituation),
    starTask: optionalScore(raw.starTask),
    starAction: optionalScore(raw.starAction),
    starResult: optionalScore(raw.starResult),
    idealAnswer: String(raw.idealAnswer || ''),
    improvedAnswer: String(raw.improvedAnswer || ''),
    conceptExplanation: String(raw.conceptExplanation || ''),
    missingPoints: asStringArray(raw.missingPoints),
    topicTags: asStringArray(raw.topicTags),
    studyTips: asStringArray(raw.studyTips),
    feedback: String(raw.feedback || ''),
    conceptsCorrect: asStringArray(raw.conceptsCorrect),
    conceptsPartial: asStringArray(raw.conceptsPartial),
    conceptsIncorrect: asStringArray(raw.conceptsIncorrect),
    knowledgeGaps: asStringArray(raw.knowledgeGaps),
    learningPriority,
    estimatedRevisionMinutes: Math.max(
      0,
      Math.min(240, Number(raw.estimatedRevisionMinutes ?? raw.estimatedRevisionTime) || 0),
    ),
    questionType,
    difficultyLevel,
    needsFollowUp: raw.needsFollowUp === true,
    followUpQuestion: String(raw.followUpQuestion || '').trim(),
  };
}

export function evaluationPayload(saved) {
  return {
    id: saved.id,
    technicalScore: saved.technicalScore,
    communicationScore: saved.communicationScore,
    depthScore: saved.depthScore,
    structureScore: saved.structureScore,
    accuracyScore: saved.accuracyScore,
    problemSolvingScore: saved.problemSolvingScore,
    practicalScore: saved.practicalScore,
    productionThinking: saved.productionThinking,
    confidenceScore: saved.confidenceScore,
    starSituation: saved.starSituation,
    starTask: saved.starTask,
    starAction: saved.starAction,
    starResult: saved.starResult,
    idealAnswer: saved.idealAnswer,
    improvedAnswer: saved.improvedAnswer,
    conceptExplanation: saved.conceptExplanation,
    missingPoints: saved.missingPoints,
    topicTags: saved.topicTags,
    studyTips: saved.studyTips,
    feedback: saved.feedback,
    conceptsCorrect: saved.conceptsCorrect,
    conceptsPartial: saved.conceptsPartial,
    conceptsIncorrect: saved.conceptsIncorrect,
    knowledgeGaps: saved.knowledgeGaps,
    learningPriority: saved.learningPriority,
    estimatedRevisionMinutes: saved.estimatedRevisionMinutes,
    questionType: saved.questionType,
    difficultyLevel: saved.difficultyLevel,
    fillerWordCount: saved.fillerWordCount,
    wordCount: saved.wordCount,
    speakingSeconds: saved.speakingSeconds,
    wordsPerMinute: saved.wordsPerMinute,
  };
}

export function normalizeVerdict(raw = {}) {
  const hiringVerdict = String(raw.hiringVerdict || 'Leaning No Hire');
  let hireProbability = Number(raw.hireProbability);
  if (Number.isNaN(hireProbability)) {
    const map = {
      'Strong Hire': 90,
      Hire: 75,
      'Leaning Hire': 60,
      'Leaning No Hire': 35,
      'No Hire': 15,
    };
    hireProbability = map[hiringVerdict] ?? 40;
  }
  hireProbability = Math.max(0, Math.min(100, hireProbability));

  let readiness = Number(raw.estimatedInterviewReadiness ?? raw.readinessScore);
  if (Number.isNaN(readiness)) readiness = hireProbability / 10;
  readiness = Math.max(0, Math.min(10, readiness));

  return {
    hiringVerdict,
    reasoning: String(raw.reasoning || ''),
    hireProbability,
    readinessScore: Math.round(readiness * 100) / 100,
    strengths: asStringArray(raw.strengths),
    weaknesses: asStringArray(raw.weaknesses),
    repeatedMistakes: asStringArray(raw.repeatedMistakes),
    missedConcepts: asStringArray(raw.missedConcepts),
    bestAnswerQ: raw.bestAnswerQ != null ? String(raw.bestAnswerQ) : null,
    worstAnswerQ: raw.worstAnswerQ != null ? String(raw.worstAnswerQ) : null,
    confidenceAnalysis: String(raw.confidenceAnalysis || ''),
    communicationAnalysis: String(raw.communicationAnalysis || ''),
    technicalAnalysis: String(raw.technicalAnalysis || ''),
    recommendedLearningPath: String(raw.recommendedLearningPath || ''),
    estimatedInterviewReadiness: Math.round(readiness * 100) / 100,
  };
}

export function questionCreateData(normalized, extras = {}) {
  return {
    idealAnswer: normalized.idealAnswer,
    improvedAnswer: normalized.improvedAnswer,
    conceptExplanation: normalized.conceptExplanation,
    missingPoints: normalized.missingPoints,
    topicTags: normalized.topicTags,
    technicalScore: normalized.technicalScore,
    communicationScore: normalized.communicationScore,
    depthScore: normalized.depthScore,
    structureScore: normalized.structureScore,
    starSituation: normalized.starSituation,
    starTask: normalized.starTask,
    starAction: normalized.starAction,
    starResult: normalized.starResult,
    studyTips: normalized.studyTips,
    feedback: normalized.feedback,
    accuracyScore: normalized.accuracyScore,
    problemSolvingScore: normalized.problemSolvingScore,
    practicalScore: normalized.practicalScore,
    productionThinking: normalized.productionThinking,
    confidenceScore: normalized.confidenceScore,
    conceptsCorrect: normalized.conceptsCorrect,
    conceptsPartial: normalized.conceptsPartial,
    conceptsIncorrect: normalized.conceptsIncorrect,
    knowledgeGaps: normalized.knowledgeGaps,
    learningPriority: normalized.learningPriority,
    estimatedRevisionMinutes: normalized.estimatedRevisionMinutes,
    questionType: normalized.questionType,
    difficultyLevel: normalized.difficultyLevel,
    ...extras,
  };
}
