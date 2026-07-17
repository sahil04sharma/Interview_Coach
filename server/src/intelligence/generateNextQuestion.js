import { runInterviewDirector } from './agents/interviewDirector.js';
import { runQuestionGenerator } from './agents/questionGenerator.js';
import { generateQuestionV1 } from './fallback.js';
import { loadSessionIntelligenceContext } from './intelligenceContext.js';
import {
  isIntelligenceV2Enabled,
  isIntelligenceBrainEnabled,
} from './cognitiveModel.js';
import { runInterviewBrain } from './interviewBrain.js';
import { planCurriculumObjectives } from './curriculumPlanner.js';
import { isRoleCurriculumEnabled } from './roleCurriculumService.js';

function parseCurriculum(raw) {
  if (!raw) return null;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

/**
 * Strategic next-question pipeline.
 * With INTELLIGENCE_BRAIN + no prior answer: Brain open mode (1 call).
 * Otherwise: Director → Generator (multi-call V2) or V1 fallback.
 */
export async function generateNextQuestion({
  session,
  company,
  user,
  previousQuestions,
  lastEvaluation,
  memory,
  knowledgeProfile,
  jdContext,
  companyProfile,
  stream = false,
  onToken,
}) {
  const questionIndex = previousQuestions?.length || 0;
  const v1Args = {
    companyName: company.name,
    styleNotes: company.styleNotes,
    resumeText: user?.resumeText,
    targetRole: user?.targetRole,
    jdText: session.jdText,
    weakTopics: user?.weakTopics,
    strongTopics: user?.strongTopics,
    previousQuestions,
    mode: session.mode,
    jdContext,
    roleCurriculum: memory?.roleCurriculum || parseCurriculum(session.roleCurriculum),
    questionIndex,
    difficulty: memory?.difficulty || session.difficulty || 'medium',
    practicePack: session.practicePack || 'mixed',
    interviewLanguage: session.interviewLanguage || 'english',
    lastEvaluation,
    coveredTopics: memory?.topicsCovered || session.coveredTopics || [],
    focusWeakTopics: user?.weakTopics,
    memory,
    knowledgeProfile,
    companyProfile,
  };

  if (!isIntelligenceV2Enabled()) {
    const question = await generateQuestionV1(v1Args, { stream, onToken });
    return {
      question,
      isFollowUp: false,
      source: 'v1',
      objective: null,
      plan: null,
    };
  }

  // First question via Interview Brain (open mode) — no streaming of JSON
  if (isIntelligenceBrainEnabled() && !lastEvaluation) {
    try {
      const brain = await runInterviewBrain({
        mode: 'open',
        session,
        company,
        companyProfile,
        previousQuestions: previousQuestions || [],
        targetRole: user?.targetRole || null,
      });
      if (!brain?.nextQuestion?.text) {
        throw new Error('Interview Brain open mode missing nextQuestion');
      }
      if (stream && onToken) {
        onToken(brain.nextQuestion.text);
      }
      return {
        question: brain.nextQuestion.text,
        isFollowUp: Boolean(brain.nextQuestion.isFollowUp),
        source: 'v2-brain',
        objective: brain.objective,
        plan: brain.plan,
        brainMeta: brain._meta || null,
      };
    } catch (err) {
      console.warn(
        '[intelligence] Brain open failed, falling back to Director+Generator:',
        err.message,
      );
    }
  }

  try {
    const intelligenceContext = await loadSessionIntelligenceContext(session);

    if (isRoleCurriculumEnabled()) {
      try {
        const plan = await planCurriculumObjectives({
          userId: session.userId,
          targetRole: user?.targetRole,
          session,
          practicePack: session.practicePack || 'mixed',
          coveredTopics: intelligenceContext.coveredTopics || [],
          resumeClaims: intelligenceContext.resumeClaims || [],
          objectiveCount: 4,
        });
        if (plan?.matched) {
          intelligenceContext.sessionObjectives = plan.objectives;
          intelligenceContext.progressBrief = plan.progressBrief;
          intelligenceContext.roleCurriculumBrief = plan.roleCurriculumBrief;
          intelligenceContext.resumeBudget = {
            remaining: plan.resumeBudgetRemaining,
            max: plan.resumeBudgetMax,
            used: plan.resumeBudgetUsed,
          };
          intelligenceContext.priorityQueue = plan.priorityQueue;
        }
      } catch (err) {
        console.warn('[intelligence] curriculum planner (director path) failed:', err.message);
      }
    }

    const { objective, plan } = await runInterviewDirector({
      companyName: company.name,
      styleNotes: company.styleNotes,
      mode: session.mode,
      difficulty: memory?.difficulty || session.difficulty || 'medium',
      practicePack: session.practicePack || 'mixed',
      interviewLanguage: session.interviewLanguage || 'english',
      targetRole: user?.targetRole,
      memory,
      intelligenceContext,
      lastEvaluation,
      questionIndex,
      companyProfile,
    });

    const question = await runQuestionGenerator(
      {
        companyName: company.name,
        styleNotes: company.styleNotes,
        plan,
        objective,
        previousQuestions,
        interviewLanguage: session.interviewLanguage || 'english',
      },
      { stream, onToken },
    );

    return {
      question,
      isFollowUp: Boolean(objective.followUp),
      source: 'v2-director',
      objective,
      plan,
    };
  } catch (err) {
    console.warn('[intelligence] strategic question failed, using V1:', err.message);
    const question = await generateQuestionV1(v1Args, { stream, onToken });
    return {
      question,
      isFollowUp: false,
      source: 'v1-fallback',
      objective: null,
      plan: null,
      error: err.message,
    };
  }
}
