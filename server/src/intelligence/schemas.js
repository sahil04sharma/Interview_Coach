import { clampScore, asStringArray } from '../services/evaluationService.js';

function clamp01(n, fallback = 0.5) {
  const v = Number(n);
  if (Number.isNaN(v)) return fallback;
  return Math.max(0, Math.min(1, v));
}

export function parseScoredField(raw, fallbackScore = 5) {
  if (!raw || typeof raw !== 'object') {
    return { score: fallbackScore, confidence: 0, reason: '', conceptSlugs: [] };
  }
  return {
    score: clampScore(raw.score ?? fallbackScore),
    confidence: clamp01(raw.confidence, 0),
    reason: String(raw.reason || ''),
    conceptSlugs: asStringArray(raw.conceptSlugs),
  };
}

export function parseEvidenceList(raw, defaultSource) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const polarity = ['supports', 'contradicts', 'neutral'].includes(item.polarity)
        ? item.polarity
        : 'neutral';
      return {
        observation: String(item.observation || '').trim(),
        dimension: item.dimension ? String(item.dimension) : null,
        conceptSlugs: asStringArray(item.conceptSlugs),
        polarity,
        strength: clamp01(item.strength, 0.5),
        confidence: clamp01(item.confidence, 0.5),
        alternatives: asStringArray(item.alternativeInterpretations),
        source: defaultSource,
      };
    })
    .filter((e) => e && e.observation);
}

export function parseTechnicalOutput(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const knowledge = parseScoredField(raw.knowledge);
  if (!raw.knowledge && !raw.depth && !raw.reasoning) return null;

  return {
    knowledge,
    understanding: parseScoredField(raw.understanding, knowledge.score),
    reasoning: parseScoredField(raw.reasoning, knowledge.score),
    depth: parseScoredField(raw.depth, knowledge.score),
    terminology: parseScoredField(raw.terminology, knowledge.score),
    architectureThinking: parseScoredField(raw.architectureThinking, knowledge.score),
    productionThinking: parseScoredField(raw.productionThinking, knowledge.score),
    conceptsCorrect: asStringArray(raw.conceptsCorrect),
    conceptsPartial: asStringArray(raw.conceptsPartial),
    conceptsIncorrect: asStringArray(raw.conceptsIncorrect),
    knowledgeGaps: asStringArray(raw.knowledgeGaps),
    topicTags: asStringArray(raw.topicTags),
    evidence: parseEvidenceList(raw.evidence, 'technical-evaluator'),
  };
}

export function parseCommunicationOutput(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const communication = parseScoredField(raw.communication);
  if (!raw.communication && !raw.structure) return null;

  const star = raw.star && typeof raw.star === 'object' ? raw.star : {};
  const optionalStar = (v) => (v === null || v === undefined ? null : clampScore(v));

  return {
    communication,
    structure: parseScoredField(raw.structure, communication.score),
    star: {
      situation: optionalStar(star.situation),
      task: optionalStar(star.task),
      action: optionalStar(star.action),
      result: optionalStar(star.result),
    },
    deliveryNotes: String(raw.deliveryNotes || ''),
    evidence: parseEvidenceList(raw.evidence, 'communication-evaluator'),
  };
}

export function parseResumeAnalysisOutput(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const claims = Array.isArray(raw.claims)
    ? raw.claims
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const importance = ['high', 'medium', 'low'].includes(
            String(item.importance || '').toLowerCase(),
          )
            ? String(item.importance).toLowerCase()
            : 'medium';
          const claim = String(item.claim || '').trim();
          if (!claim) return null;
          return {
            claim,
            conceptSlugs: asStringArray(item.conceptSlugs),
            importance,
          };
        })
        .filter(Boolean)
    : [];

  const seedHypotheses = Array.isArray(raw.seedHypotheses)
    ? raw.seedHypotheses
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const statement = String(item.statement || '').trim();
          if (!statement) return null;
          return {
            statement,
            conceptSlugs: asStringArray(item.conceptSlugs),
            priority: clamp01(item.priority, 0.5),
          };
        })
        .filter(Boolean)
    : [];

  const seedUncertainties = Array.isArray(raw.seedUncertainties)
    ? raw.seedUncertainties
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const about = String(item.about || '').trim();
          if (!about) return null;
          return {
            about,
            conceptSlugs: asStringArray(item.conceptSlugs),
            priority: clamp01(item.priority, 0.5),
          };
        })
        .filter(Boolean)
    : [];

  if (!claims.length && !seedHypotheses.length && !seedUncertainties.length) return null;
  return { claims, seedHypotheses, seedUncertainties };
}

const OBJECTIVE_TYPES = new Set([
  'verify-hypothesis',
  'reduce-uncertainty',
  'probe-misconception',
  'stretch-strength',
  'cover-required',
  'behavioral',
  're-probe-weak',
]);

const PLAN_INTENTS = new Set([
  'ROLE_FUNDAMENTAL',
  'RESUME_DEEP_DIVE',
  'TRICK_OR_EDGE',
  'SCENARIO',
  'RECRUITER_SOFT',
  'ADVANCED',
  'WEAK_TOPIC_PROBE',
]);

export function parseDirectorPlanOutput(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const objectiveRaw = raw.objective || raw;
  const planRaw = raw.plan;
  if (!planRaw || typeof planRaw !== 'object') return null;

  const objectiveType = String(objectiveRaw.objectiveType || 'cover-required');
  const difficulty = ['easy', 'medium', 'hard'].includes(String(objectiveRaw.difficulty))
    ? String(objectiveRaw.difficulty)
    : 'medium';

  const objective = {
    objectiveType: OBJECTIVE_TYPES.has(objectiveType) ? objectiveType : 'cover-required',
    targetHypothesisId: objectiveRaw.targetHypothesisId || null,
    targetUncertaintyId: objectiveRaw.targetUncertaintyId || null,
    targetConceptSlugs: asStringArray(objectiveRaw.targetConceptSlugs),
    difficulty,
    followUp: objectiveRaw.followUp === true,
    expectedConfidenceGain: clamp01(objectiveRaw.expectedConfidenceGain, 0.4),
    rationale: String(objectiveRaw.rationale || ''),
  };

  const intent = String(planRaw.intent || 'ROLE_FUNDAMENTAL').toUpperCase();
  const planDifficulty = ['easy', 'medium', 'hard'].includes(String(planRaw.difficulty))
    ? String(planRaw.difficulty)
    : difficulty;

  const plan = {
    intent: PLAN_INTENTS.has(intent) ? intent : 'ROLE_FUNDAMENTAL',
    questionType: String(planRaw.questionType || 'technical').slice(0, 64),
    topic: String(planRaw.topic || 'general fundamentals'),
    targetConceptSlug: planRaw.targetConceptSlug ? String(planRaw.targetConceptSlug) : null,
    expectedConcepts: asStringArray(planRaw.expectedConcepts),
    verificationGoal: String(planRaw.verificationGoal || ''),
    difficulty: planDifficulty,
    starRequired: planRaw.starRequired === true,
  };

  if (!objective.rationale && !plan.topic) return null;
  return { objective, plan };
}

export function parseMisconceptionOutput(raw) {
  if (!raw || typeof raw !== 'object') return [];
  if (!Array.isArray(raw.misconceptions)) return [];
  return raw.misconceptions
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const statement = String(item.statement || '').trim();
      const conceptSlug = String(item.conceptSlug || item.conceptSlugs?.[0] || '').trim();
      if (!statement || !conceptSlug) return null;
      return {
        conceptSlug,
        statement,
        correctStatement: String(item.correctStatement || ''),
        candidateConfidence: clamp01(item.confidenceOfCandidate ?? item.candidateConfidence, 0.5),
        ourConfidence: clamp01(item.ourConfidence, 0.5),
        conceptSlugs: asStringArray(item.conceptSlugs || [conceptSlug]),
      };
    })
    .filter(Boolean);
}

const HIRING_VERDICTS = new Set([
  'Strong Hire',
  'Hire',
  'Leaning Hire',
  'Leaning No Hire',
  'No Hire',
]);

function parseEvidenceLinkedItems(raw, fieldName) {
  if (!Array.isArray(raw)) return null;
  const items = raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const text = String(item.text || item.summary || '').trim();
      const evidenceIds = asStringArray(item.evidenceIds);
      if (!text || evidenceIds.length === 0) return null;
      return { ...item, text, evidenceIds };
    })
    .filter(Boolean);
  if (items.length !== raw.length) return null;
  return items;
}

function parseDimensionReport(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const items = raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const dimension = String(item.dimension || '').trim();
      const narrative = String(item.narrative || '').trim();
      const evidenceIds = asStringArray(item.evidenceIds);
      if (!dimension || !narrative || evidenceIds.length === 0) return null;
      return {
        dimension,
        score: clampScore(item.score ?? 5),
        confidence: clamp01(item.confidence, 0.5),
        narrative,
        evidenceIds,
      };
    })
    .filter(Boolean);
  if (items.length !== raw.length) return null;
  return items;
}

export function parseReportWriterOutput(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const hiringVerdict = String(raw.hiringVerdict || '').trim();
  if (!HIRING_VERDICTS.has(hiringVerdict)) return null;

  const dimensionReport = parseDimensionReport(raw.dimensionReport);
  const strengths = parseEvidenceLinkedItems(raw.strengths, 'strengths');
  const weaknesses = parseEvidenceLinkedItems(raw.weaknesses, 'weaknesses');
  if (!dimensionReport || !strengths || !weaknesses) return null;

  const resolvedHypotheses = Array.isArray(raw.resolvedHypotheses)
    ? raw.resolvedHypotheses
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const id = String(item.id || '').trim();
          const summary = String(item.summary || '').trim();
          if (!id || !summary) return null;
          return {
            id,
            status: String(item.status || 'open'),
            summary,
          };
        })
        .filter(Boolean)
    : [];

  const misconceptions = Array.isArray(raw.misconceptions)
    ? raw.misconceptions
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const conceptSlug = String(item.conceptSlug || '').trim();
          const summary = String(item.summary || item.statement || '').trim();
          if (!conceptSlug || !summary) return null;
          return {
            conceptSlug,
            status: String(item.status || 'suspected'),
            summary,
            evidenceIds: asStringArray(item.evidenceIds),
          };
        })
        .filter(Boolean)
    : [];

  return {
    hiringVerdict,
    hireProbability: raw.hireProbability,
    readiness: raw.readiness ?? raw.readinessScore ?? raw.estimatedInterviewReadiness,
    reasoning: String(raw.reasoning || ''),
    dimensionReport,
    strengths,
    weaknesses,
    resolvedHypotheses,
    misconceptions,
    repeatedMistakes: asStringArray(raw.repeatedMistakes),
    missedConcepts: asStringArray(raw.missedConcepts),
    bestAnswerQ: raw.bestAnswerQ,
    worstAnswerQ: raw.worstAnswerQ,
    confidenceAnalysis: String(raw.confidenceAnalysis || ''),
    communicationAnalysis: String(raw.communicationAnalysis || ''),
    technicalAnalysis: String(raw.technicalAnalysis || ''),
    recommendedLearningPath: String(raw.recommendedLearningPath || ''),
  };
}

const HYPOTHESIS_ACTIONS = new Set(['support', 'refute', 'open', 'noop']);
const UNCERTAINTY_ACTIONS = new Set(['resolve', 'raise', 'noop']);
const EVIDENCE_SOURCES = new Set([
  'technical',
  'communication',
  'behavior',
  'misconception',
]);

function parseDirectorDecision(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const objectiveType = String(raw.objectiveType || 'cover-required');
  const difficulty = ['easy', 'medium', 'hard'].includes(String(raw.difficulty))
    ? String(raw.difficulty)
    : 'medium';
  return {
    objectiveType: OBJECTIVE_TYPES.has(objectiveType) ? objectiveType : 'cover-required',
    targetHypothesisId: raw.targetHypothesisId || null,
    targetUncertaintyId: raw.targetUncertaintyId || null,
    targetConceptSlugs: asStringArray(raw.targetConceptSlugs),
    difficulty,
    followUp: raw.followUp === true,
    expectedConfidenceGain: clamp01(raw.expectedConfidenceGain, 0.4),
    rationale: String(raw.rationale || ''),
  };
}

function parseInterviewPlan(raw, fallbackDifficulty = 'medium') {
  if (!raw || typeof raw !== 'object') return null;
  const intent = String(raw.intent || 'ROLE_FUNDAMENTAL').toUpperCase();
  const difficulty = ['easy', 'medium', 'hard'].includes(String(raw.difficulty))
    ? String(raw.difficulty)
    : fallbackDifficulty;
  const topic = String(raw.topic || '').trim();
  if (!topic) return null;
  return {
    intent: PLAN_INTENTS.has(intent) ? intent : 'ROLE_FUNDAMENTAL',
    questionType: String(raw.questionType || 'technical').slice(0, 64),
    topic,
    targetConceptSlug: raw.targetConceptSlug ? String(raw.targetConceptSlug) : null,
    expectedConcepts: asStringArray(raw.expectedConcepts),
    verificationGoal: String(raw.verificationGoal || ''),
    difficulty,
    starRequired: raw.starRequired === true,
  };
}

function parseNextQuestion(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const text = String(raw.text || raw.question || '').trim();
  if (!text || text.length < 8) return null;
  return {
    text,
    isFollowUp: raw.isFollowUp === true,
  };
}

function parseBrainEvidenceUpdates(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const observation = String(item.observation || '').trim();
      if (!observation) return null;
      const sourceRaw = String(item.source || 'technical').toLowerCase();
      const source = EVIDENCE_SOURCES.has(sourceRaw) ? sourceRaw : 'technical';
      const polarity = ['supports', 'contradicts', 'neutral'].includes(item.polarity)
        ? item.polarity
        : 'neutral';
      return {
        observation,
        source,
        dimension: item.dimension ? String(item.dimension) : null,
        conceptSlugs: asStringArray(item.conceptSlugs),
        polarity,
        strength: clamp01(item.strength, 0.5),
        confidence: clamp01(item.confidence, 0.5),
        alternatives: asStringArray(item.alternativeInterpretations),
        hypothesisId: item.hypothesisId || null,
      };
    })
    .filter(Boolean);
}

function parseHypothesisUpdates(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const action = String(item.action || 'noop').toLowerCase();
      if (!HYPOTHESIS_ACTIONS.has(action) || action === 'noop') return null;
      return {
        hypothesisId: item.hypothesisId || null,
        action,
        confidence: clamp01(item.confidence, 0.5),
        summary: String(item.summary || ''),
        evidenceRefs: Array.isArray(item.evidenceRefs) ? item.evidenceRefs : [],
      };
    })
    .filter(Boolean);
}

function parseUncertaintyUpdates(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const action = String(item.action || 'noop').toLowerCase();
      if (!UNCERTAINTY_ACTIONS.has(action) || action === 'noop') return null;
      return {
        uncertaintyId: item.uncertaintyId || null,
        action,
        about: String(item.about || ''),
      };
    })
    .filter(Boolean);
}

function parseCoaching(raw) {
  if (!raw || typeof raw !== 'object') return {};
  return {
    feedback: String(raw.feedback || ''),
    idealAnswer: String(raw.idealAnswer || ''),
    improvedAnswer: String(raw.improvedAnswer || ''),
    conceptExplanation: String(raw.conceptExplanation || ''),
    missingPoints: asStringArray(raw.missingPoints),
    studyTips: asStringArray(raw.studyTips),
    learningPriority: String(raw.learningPriority || 'medium'),
    estimatedRevisionMinutes: Number(raw.estimatedRevisionMinutes) || 0,
    followUpQuestion: String(raw.followUpQuestion || ''),
    confidenceScore: raw.confidenceScore,
  };
}

function neverDoViolations(parsed, mode) {
  const violations = [];
  if (mode === 'turn' && parsed.technical && parsed.communication) {
    const techText = JSON.stringify(parsed.technical).toLowerCase();
    if (
      /\b(clarity|fluency|filler|star structure)\b/.test(techText) &&
      !parsed.communication.communication
    ) {
      violations.push('technical-may-include-comm-language');
    }
  }
  if (parsed.objective?.rationale && parsed.nextQuestion) {
    const rationale = parsed.objective.rationale.trim();
    if (rationale.length > 40 && rationale === parsed.nextQuestion.text.trim()) {
      violations.push('director-equals-question-prose');
    }
  }
  if (parsed.plan?.topic && parsed.nextQuestion?.text) {
    // Soft check only — do not fail parse; logged by caller if needed
  }
  return violations;
}

/**
 * Parse Interview Brain JSON. Returns null if required sections are missing.
 * @param {object} raw
 * @param {'turn'|'open'} mode
 */
export function parseInterviewBrainOutput(raw, mode = 'turn') {
  if (!raw || typeof raw !== 'object') return null;

  const directorRaw = raw.directorDecision || raw.nextInterviewObjective || raw.objective;
  const objective = parseDirectorDecision(directorRaw);
  const plan = parseInterviewPlan(raw.interviewPlan || raw.plan, objective?.difficulty);
  const nextQuestion = parseNextQuestion(raw.nextQuestion);

  if (!objective || !plan || !nextQuestion) return null;

  let technical = null;
  let communication = null;
  let misconceptions = [];
  let coaching = {};
  let behaviorEvaluation = null;

  if (mode === 'turn') {
    technical = parseTechnicalOutput(raw.technicalEvaluation);
    communication = parseCommunicationOutput(raw.communicationEvaluation);
    if (!technical || !communication) return null;

    // Evidence only at top level — strip any nested evidence from parsers
    technical = { ...technical, evidence: [] };
    communication = { ...communication, evidence: [] };

    misconceptions = parseMisconceptionOutput({
      misconceptions: raw.misconceptions || [],
    });
    coaching = parseCoaching(raw.coaching);
    if (raw.behaviorEvaluation && typeof raw.behaviorEvaluation === 'object') {
      behaviorEvaluation = {
        confidence: parseScoredField(raw.behaviorEvaluation.confidence, 5),
        learningAbility: raw.behaviorEvaluation.learningAbility ?? null,
        notes: String(raw.behaviorEvaluation.notes || ''),
      };
      if (behaviorEvaluation.confidence?.score != null) {
        coaching.confidenceScore = behaviorEvaluation.confidence.score;
      }
    }
  }

  const evidenceUpdates = parseBrainEvidenceUpdates(raw.evidenceUpdates);
  // Attach evidence onto evaluators by source for existing Evidence Engine
  if (technical || communication) {
    const techEvidence = evidenceUpdates
      .filter((e) => e.source === 'technical' || e.source === 'misconception')
      .map((e) => ({
        ...e,
        source: e.source === 'misconception' ? 'misconception-detector' : 'technical-evaluator',
      }));
    const commEvidence = evidenceUpdates
      .filter((e) => e.source === 'communication' || e.source === 'behavior')
      .map((e) => ({
        ...e,
        source:
          e.source === 'behavior' ? 'behavior-evaluator' : 'communication-evaluator',
      }));
    if (technical) technical = { ...technical, evidence: techEvidence };
    if (communication) communication = { ...communication, evidence: commEvidence };
  }

  const parsed = {
    mode,
    technical,
    communication,
    behaviorEvaluation,
    misconceptions,
    candidateMindUpdates: raw.candidateMindUpdates || null,
    hypothesisUpdates: parseHypothesisUpdates(raw.hypothesisUpdates),
    uncertaintyUpdates: parseUncertaintyUpdates(raw.uncertaintyUpdates),
    evidenceUpdates,
    objective,
    plan,
    nextQuestion,
    coaching,
    metrics:
      raw.metrics && typeof raw.metrics === 'object'
        ? {
            remainingUncertainty: asStringArray(raw.metrics.remainingUncertainty),
            informationGainEstimate: clamp01(raw.metrics.informationGainEstimate, 0.4),
            selfConfidence: clamp01(raw.metrics.selfConfidence, 0.5),
          }
        : null,
    violations: [],
  };

  parsed.violations = neverDoViolations(parsed, mode);
  return parsed;
}
