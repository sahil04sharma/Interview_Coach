import { chatJson } from '../llm.js';
import { buildEvaluatorMessages } from '../prompts.js';
import { runTechnicalEvaluator } from './agents/technicalEvaluator.js';
import { runCommunicationEvaluator } from './agents/communicationEvaluator.js';
import { runResumeAnalyst } from './agents/resumeAnalyst.js';
import {
  runMisconceptionDetector,
  shouldRunMisconceptionDetector,
} from './agents/misconceptionDetector.js';
import { mergeSplitEvaluation } from './legacyMapping.js';
import { applyEvidenceToModel } from './evidenceEngine.js';
import { seedResumeIntelligence } from './hypothesisEngine.js';
import { getMisconceptionPriors } from './conceptGraph.js';
import {
  ensureCognitiveModel,
  isIntelligenceV2Enabled,
  isIntelligenceBrainEnabled,
  loadCognitiveModel,
} from './cognitiveModel.js';
import { runInterviewBrain } from './interviewBrain.js';
import { mapBrainToEvaluation } from './applyBrainResult.js';

async function runV1Evaluator(input) {
  const raw = await chatJson({
    messages: buildEvaluatorMessages(input),
    temperature: 0.2,
  });
  return raw;
}

async function runSplitEvaluation(baseInput, { questionText, userAnswer, session }) {
  const [technical, communication, coachingRaw] = await Promise.all([
    runTechnicalEvaluator(baseInput),
    runCommunicationEvaluator(baseInput),
    runV1Evaluator(baseInput),
  ]);

  const { normalized, mergedRaw, technical: tech, communication: comm } =
    mergeSplitEvaluation(technical, communication, coachingRaw);

  let misconceptions = [];
  if (shouldRunMisconceptionDetector(tech)) {
    try {
      const conceptSlugs = [
        ...(tech.conceptsIncorrect || []),
        ...(tech.conceptsPartial || []),
        ...(tech.knowledge?.conceptSlugs || []),
      ];
      const confusionPriors = await getMisconceptionPriors(conceptSlugs);
      misconceptions = await runMisconceptionDetector({
        questionText,
        userAnswer,
        technical: tech,
        interviewLanguage: session.interviewLanguage || 'english',
        confusionPriors,
      });
    } catch (err) {
      console.warn('[intelligence] misconception detector failed:', err.message);
    }
  }

  return {
    source: 'v2-split',
    rawEvaluation: mergedRaw,
    normalized,
    technical: tech,
    communication: comm,
    misconceptions,
    nextQuestion: null,
    objective: null,
    plan: null,
    intelligence: {
      source: 'v2-split',
      pendingEvidence: true,
      misconceptionCount: misconceptions.length,
    },
  };
}

/**
 * Evaluate one answer.
 * Brain path (INTELLIGENCE_BRAIN): one fused call → eval + next question.
 * Multi-call V2: split evaluators + V1 coaching.
 * Falls back to V1 monolithic evaluator on total failure.
 */
export async function evaluateAnswer({
  session,
  company,
  questionText,
  userAnswer,
  delivery,
  companyProfile = null,
  previousQuestions = [],
  lastEvaluation = null,
  targetRole = null,
}) {
  const baseInput = {
    companyName: company.name,
    questionText,
    userAnswer,
    mode: session.mode,
    delivery,
    interviewLanguage: session.interviewLanguage || 'english',
    difficulty: session.difficulty || 'medium',
  };

  if (!isIntelligenceV2Enabled()) {
    const raw = await runV1Evaluator(baseInput);
    return {
      source: 'v1',
      rawEvaluation: raw,
      intelligence: null,
      nextQuestion: null,
      objective: null,
      plan: null,
    };
  }

  const resolvedRole = targetRole || session.user?.targetRole || null;

  if (isIntelligenceBrainEnabled()) {
    try {
      const brain = await runInterviewBrain({
        mode: 'turn',
        session,
        company,
        companyProfile,
        questionText,
        userAnswer,
        delivery,
        previousQuestions,
        lastEvaluation,
        targetRole: resolvedRole,
      });

      if (!brain) {
        throw new Error('Interview Brain returned unparseable output');
      }

      const mapped = mapBrainToEvaluation(brain);
      if (!mapped) {
        throw new Error('Interview Brain missing evaluation sections');
      }

      return {
        source: 'v2-brain',
        rawEvaluation: mapped.mergedRaw,
        normalized: mapped.normalized,
        technical: mapped.technical,
        communication: mapped.communication,
        misconceptions: brain.misconceptions || [],
        nextQuestion: brain.nextQuestion,
        objective: brain.objective,
        plan: brain.plan,
        brain,
        intelligence: {
          source: 'v2-brain',
          pendingEvidence: true,
          misconceptionCount: (brain.misconceptions || []).length,
          objective: brain.objective,
          plan: brain.plan,
          rationale: brain.objective?.rationale,
          questionSource: 'v2-brain',
          metrics: brain.metrics,
          brainMeta: brain._meta || null,
        },
      };
    } catch (err) {
      console.warn(
        '[intelligence] Interview Brain failed, falling back to multi-call V2:',
        err.message,
      );
      try {
        const split = await runSplitEvaluation(baseInput, {
          questionText,
          userAnswer,
          session,
        });
        split.intelligence = {
          ...split.intelligence,
          source: 'v2-split-fallback',
          brainError: err.message,
        };
        return split;
      } catch (splitErr) {
        console.warn(
          '[intelligence] split evaluation also failed, using V1:',
          splitErr.message,
        );
        const raw = await runV1Evaluator(baseInput);
        return {
          source: 'v1-fallback',
          rawEvaluation: raw,
          intelligence: {
            source: 'v1-fallback',
            error: splitErr.message,
            brainError: err.message,
          },
          nextQuestion: null,
          objective: null,
          plan: null,
        };
      }
    }
  }

  try {
    return await runSplitEvaluation(baseInput, {
      questionText,
      userAnswer,
      session,
    });
  } catch (err) {
    console.warn('[intelligence] split evaluation failed, using V1:', err.message);
    const raw = await runV1Evaluator(baseInput);
    return {
      source: 'v1-fallback',
      rawEvaluation: raw,
      intelligence: { source: 'v1-fallback', error: err.message },
      nextQuestion: null,
      objective: null,
      plan: null,
    };
  }
}

/**
 * After Question row exists, persist evidence + update CCM dimensions.
 */
export async function persistEvaluationEvidence({
  session,
  questionId,
  turn,
  technical,
  communication,
}) {
  if (!technical && !communication) return { evidenceIds: [] };

  const model = await loadCognitiveModel(session);
  return applyEvidenceToModel({
    sessionId: session.id,
    userId: session.userId,
    questionId,
    turn,
    technical,
    communication,
    model,
  });
}

export async function analyzeResumeAtStart({
  session,
  user,
  jdText,
  roleCurriculum,
}) {
  if (!isIntelligenceV2Enabled()) return null;
  if (!user?.resumeText?.trim()) {
    return {
      source: 'v2-resume-skip',
      reason: 'empty-resume',
      claimCount: 0,
      hypothesisCount: 0,
      uncertaintyCount: 0,
    };
  }

  try {
    const analysis = await runResumeAnalyst({
      resumeText: user.resumeText,
      targetRole: user.targetRole,
      jdText,
      roleCurriculum,
    });
    const seeded = await seedResumeIntelligence({
      sessionId: session.id,
      analysis,
    });
    return {
      source: 'v2-resume-analyst',
      ...seeded,
    };
  } catch (err) {
    console.warn('[intelligence] resume analyst failed:', err.message);
    return {
      source: 'v1-fallback',
      error: err.message,
      claimCount: 0,
      hypothesisCount: 0,
      uncertaintyCount: 0,
    };
  }
}

export {
  isIntelligenceV2Enabled,
  isIntelligenceBrainEnabled,
  loadCognitiveModel,
  ensureCognitiveModel,
};
