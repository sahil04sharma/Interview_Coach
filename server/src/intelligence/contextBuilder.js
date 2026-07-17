import { loadSessionIntelligenceContext } from './intelligenceContext.js';
import { getMisconceptionPriors } from './conceptGraph.js';
import { planCurriculumObjectives } from './curriculumPlanner.js';
import { isRoleCurriculumEnabled } from './roleCurriculumService.js';

const MAX_RECENT_TURNS = 3;
const MAX_HYPOTHESES = 8;
const MAX_UNCERTAINTIES = 6;
const MAX_MISCONCEPTIONS = 5;
const MAX_CLAIMS = 8;
const MAX_CONCEPTS = 12;
const MAX_ANSWER_CHARS = 2500;
const MAX_QUESTION_CHARS = 800;

function briefDimensions(dimensions = {}) {
  const out = {};
  for (const [key, value] of Object.entries(dimensions)) {
    if (!value || typeof value !== 'object') continue;
    out[key] = {
      score: value.score,
      confidence: value.confidence,
      verification: value.verification,
    };
  }
  return out;
}

function trimText(text, max) {
  const s = String(text || '').trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

function recentTurnsFromQuestions(questions = []) {
  return questions
    .slice(-MAX_RECENT_TURNS)
    .map((q) => ({
      question: trimText(q.questionText, 400),
      answer: trimText(q.userAnswer, 600),
      technicalScore: q.technicalScore,
      communicationScore: q.communicationScore,
      topics: (q.topicTags || []).slice(0, 4),
    }));
}

/**
 * Compact Interview Context for the Interview Brain.
 * Never sends full transcript — only recent turns + ranked intelligence slices.
 */
export async function buildInterviewContext({
  session,
  company,
  companyProfile = null,
  mode = 'turn',
  questionText = null,
  userAnswer = null,
  delivery = null,
  previousQuestions = [],
  lastEvaluation = null,
  targetRole = null,
  jdPrioritySlugs = [],
}) {
  const intel = await loadSessionIntelligenceContext(session);

  const conceptSlugs = [
    ...(intel.conceptBeliefs || []).map((c) => c.conceptSlug),
    ...(intel.hypotheses || []).flatMap((h) => h.conceptSlugs || []),
  ].filter(Boolean);

  let confusionPriors = [];
  try {
    confusionPriors = await getMisconceptionPriors(conceptSlugs.slice(0, 10));
  } catch {
    confusionPriors = [];
  }

  const candidateSummary = {
    dimensions: briefDimensions(intel.cognitiveModel?.dimensions),
    weakTopics: intel.memory?.weakTopics || [],
    strongTopics: intel.memory?.strongTopics || [],
    difficulty: intel.memory?.difficulty || session.difficulty,
    followUpBudget: intel.memory?.followUpBudget,
  };

  const resolvedRole =
    targetRole || session.user?.targetRole || intel.memory?.targetRole || null;

  const context = {
    mode,
    interviewMeta: {
      sessionId: session.id,
      companyName: company?.name || session.companyStyle,
      mode: session.mode,
      difficulty: session.difficulty || 'medium',
      practicePack: session.practicePack || 'mixed',
      interviewLanguage: session.interviewLanguage || 'english',
      plannedCount: session.plannedCount || 8,
      answeredCount: (session.questions || []).filter((q) => !q.isFollowUp).length,
      coveredTopics: (intel.coveredTopics || []).slice(0, 20),
      targetRole: resolvedRole,
    },
    companyProfile: companyProfile || null,
    companyStyleNotes: company?.styleNotes
      ? trimText(company.styleNotes, 600)
      : null,
    candidateSummary,
    dimensionsBrief: candidateSummary.dimensions,
    relevantHypotheses: (intel.hypotheses || []).slice(0, MAX_HYPOTHESES),
    relevantUncertainties: (intel.uncertainties || []).slice(0, MAX_UNCERTAINTIES),
    topMisconceptions: (intel.misconceptions || []).slice(0, MAX_MISCONCEPTIONS),
    relevantResumeClaims: (intel.resumeClaims || []).slice(0, MAX_CLAIMS),
    conceptNeighborhood: (intel.conceptBeliefs || []).slice(0, MAX_CONCEPTS),
    prerequisiteGaps: (intel.prerequisiteGaps || []).slice(0, 6),
    confusionPriors: (confusionPriors || []).slice(0, 8),
    recentTurns: recentTurnsFromQuestions(session.questions || []),
    previousQuestionTexts: (previousQuestions || []).slice(-6).map((q) => trimText(q, 200)),
  };

  if (mode === 'turn') {
    context.questionJustAnswered = trimText(questionText, MAX_QUESTION_CHARS);
    context.userAnswer = trimText(userAnswer, MAX_ANSWER_CHARS);
    context.delivery = delivery
      ? {
          wordCount: delivery.wordCount,
          fillerWordCount: delivery.fillerWordCount,
          wordsPerMinute: delivery.wordsPerMinute,
          speakingSeconds: delivery.speakingSeconds,
        }
      : null;
    context.lastEvaluation = lastEvaluation || null;
  }

  if (isRoleCurriculumEnabled()) {
    try {
      const plan = await planCurriculumObjectives({
        userId: session.userId,
        targetRole: resolvedRole,
        session,
        practicePack: session.practicePack || 'mixed',
        coveredTopics: intel.coveredTopics || [],
        resumeClaims: intel.resumeClaims || [],
        jdPrioritySlugs,
        objectiveCount: 4,
      });
      if (plan) {
        context.roleCurriculumBrief = plan.roleCurriculumBrief;
        context.progressBrief = plan.progressBrief;
        context.sessionObjectives = plan.objectives;
        context.resumeBudget = {
          used: plan.resumeBudgetUsed ?? 0,
          max: plan.resumeBudgetMax ?? 0,
          remaining: plan.resumeBudgetRemaining ?? 0,
        };
        context.priorityQueue = plan.priorityQueue || [];
        context.curriculumPlanMeta = {
          matched: plan.matched,
          roleSlug: plan.roleSlug || null,
          coverageBefore: plan.coverageBefore ?? 0,
        };
      }
    } catch (err) {
      console.warn('[intelligence] curriculum planner failed:', err.message);
    }
  }

  return context;
}

export function estimateContextSize(context) {
  const json = JSON.stringify(context);
  return {
    chars: json.length,
    estTokens: Math.ceil(json.length / 4),
  };
}
