import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { prisma } from '../db.js';
import { requireAuth } from '../auth.js';
import { chatJson } from '../llm.js';
import {
  buildJdExtractMessages,
} from '../prompts.js';
import { analyzeSpeechDelivery } from '../speech.js';
import { assessAnswerQuality } from '../answerQuality.js';
import { getOrCreateCurriculum } from '../curriculumCache.js';
import {
  emptyMemory,
  formatKnowledgeProfile,
  readMemory,
  updateMemoryAfterAnswer,
} from '../services/interviewMemory.js';
import {
  applyEvaluationToKnowledge,
  createProgressSnapshot,
  getKnowledgeProfile,
  syncUserTopicCaches,
} from '../services/knowledgeService.js';
import {
  evaluationPayload,
  normalizeEvaluation,
  questionCreateData,
  clampScore,
} from '../services/evaluationService.js';
import { generateStudyPlan } from '../services/studyPlanService.js';
import {
  evaluateAnswer,
  persistEvaluationEvidence,
  ensureCognitiveModel,
  analyzeResumeAtStart,
  isIntelligenceV2Enabled,
} from '../intelligence/evaluateAnswer.js';
import { generateNextQuestion } from '../intelligence/generateNextQuestion.js';
import { persistMisconceptions } from '../intelligence/hypothesisEngine.js';
import { applyBrainResult } from '../intelligence/applyBrainResult.js';
import { generateSessionReport } from '../intelligence/generateSessionReport.js';
import { loadCognitiveModel } from '../intelligence/cognitiveModel.js';
import {
  ensurePrimaryEnrollment,
  isRoleCurriculumEnabled,
} from '../intelligence/roleCurriculumService.js';

const router = Router();
const publicRouter = Router();

function makeShareToken() {
  return randomBytes(18).toString('hex');
}
const VALID_MODES = new Set(['technical', 'behavioral', 'coding', 'system-design']);
const VALID_DIFFICULTY = new Set(['easy', 'medium', 'hard']);
const VALID_PACKS = new Set(['mixed', 'behavioral_star', 'fundamentals', 'tricks', 'weak_topics']);
const VALID_LANGUAGES = new Set(['english', 'hinglish', 'hindi']);

router.use(requireAuth);

function averageScores(questions) {
  if (!questions.length) return 0;
  let total = 0;
  let count = 0;
  for (const q of questions) {
    total += q.technicalScore + q.communicationScore + q.depthScore + q.structureScore;
    count += 4;
  }
  return Math.round((total / count) * 100) / 100;
}

function uniqueMerge(existing, incoming) {
  return [...new Set([...(existing || []), ...(incoming || [])].map((t) => t.trim()).filter(Boolean))];
}

function parseCurriculum(raw) {
  if (!raw) return null;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

function wantsStream(req) {
  const accept = String(req.headers.accept || '');
  return accept.includes('application/x-ndjson') || req.query.stream === '1' || req.body?.stream === true;
}

function writeNdjson(res, obj) {
  res.write(`${JSON.stringify(obj)}\n`);
}

function companyProfile(company) {
  if (!company) return null;
  return {
    philosophy: company.philosophy,
    difficulty: company.difficulty,
    followUpAggressiveness: company.followUpAggressiveness,
    behavioralWeight: company.behavioralWeight,
    codingWeight: company.codingWeight,
    systemDesignWeight: company.systemDesignWeight,
    communicationExpect: company.communicationExpect,
    preferredAnswerStyle: company.preferredAnswerStyle,
  };
}

function interviewerArgs({
  session,
  company,
  user,
  previousQuestions,
  jdContext = null,
  forcedFollowUp = null,
  lastEvaluation = null,
  memory = null,
  knowledgeProfile = null,
}) {
  const mem = memory || readMemory(session);
  return {
    companyName: company.name,
    styleNotes: company.styleNotes,
    resumeText: user.resumeText,
    targetRole: user.targetRole,
    jdText: session.jdText,
    weakTopics: user.weakTopics,
    strongTopics: user.strongTopics,
    previousQuestions,
    mode: session.mode,
    jdContext,
    roleCurriculum: parseCurriculum(session.roleCurriculum),
    questionIndex: previousQuestions.length,
    difficulty: mem.difficulty || session.difficulty || 'medium',
    practicePack: session.practicePack || 'mixed',
    interviewLanguage: session.interviewLanguage || 'english',
    forcedFollowUp,
    lastEvaluation,
    coveredTopics: mem.topicsCovered?.length ? mem.topicsCovered : session.coveredTopics || [],
    focusWeakTopics: user.weakTopics,
    memory: mem,
    knowledgeProfile,
    companyProfile: companyProfile(company),
  };
}

function shouldAskFollowUp({ evaluation, lastWasFollowUp, sessionComplete }) {
  if (lastWasFollowUp || sessionComplete) return false;
  if (evaluation.needsFollowUp !== true) return false;
  const followUp = String(evaluation.followUpQuestion || '').trim();
  if (!followUp) return false;

  const avg =
    (clampScore(evaluation.technicalScore) +
      clampScore(evaluation.communicationScore) +
      clampScore(evaluation.depthScore) +
      clampScore(evaluation.structureScore)) /
    4;

  // Only follow up on mid-range answers — not clear misses or clear hits.
  return avg >= 4 && avg <= 7.5;
}

async function loadSessionContext(sessionId) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      user: true,
      questions: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!session) return null;

  const company = await prisma.companyStyle.findUnique({
    where: { name: session.companyStyle },
  });

  return { session, company };
}

router.get('/', async (req, res, next) => {
  try {
    const sessions = await prisma.session.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { questions: true } },
      },
    });

    res.json(
      sessions.map((s) => ({
        id: s.id,
        companyStyle: s.companyStyle,
        mode: s.mode,
        overallScore: s.overallScore,
        hiringVerdict: s.hiringVerdict,
        createdAt: s.createdAt,
        questionCount: s._count.questions,
        finished: Boolean(s.hiringVerdict),
        resumable: !s.hiringVerdict && Boolean(s.currentQuestion),
        plannedCount: s.plannedCount,
        practicePack: s.practicePack,
        interviewLanguage: s.interviewLanguage,
      })),
    );
  } catch (err) {
    next(err);
  }
});

router.post('/start', async (req, res, next) => {
  const stream = wantsStream(req);
  try {
    const {
      companyStyle,
      jdText,
      mode,
      plannedCount = 8,
      difficulty = 'medium',
      practicePack = 'mixed',
      interviewLanguage = 'english',
    } = req.body || {};
    const userId = req.userId;

    if (!companyStyle || !mode) {
      return res.status(400).json({ error: 'companyStyle and mode are required' });
    }
    if (!VALID_MODES.has(mode)) {
      return res.status(400).json({ error: `mode must be one of: ${[...VALID_MODES].join(', ')}` });
    }
    if (!VALID_DIFFICULTY.has(difficulty)) {
      return res.status(400).json({ error: 'difficulty must be easy, medium, or hard' });
    }
    if (!VALID_PACKS.has(practicePack)) {
      return res.status(400).json({ error: 'invalid practicePack' });
    }
    if (!VALID_LANGUAGES.has(interviewLanguage)) {
      return res.status(400).json({ error: 'interviewLanguage must be english, hinglish, or hindi' });
    }

    if (practicePack === 'weak_topics') {
      const userCheck = await prisma.user.findUnique({ where: { id: userId } });
      if (!userCheck?.weakTopics?.length) {
        return res.status(400).json({
          error: 'Weak-topic practice needs saved weak topics. Finish a few sessions first, or pick Mixed.',
        });
      }
    }

    const count = Math.max(3, Math.min(15, Number(plannedCount) || 8));

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const company = await prisma.companyStyle.findUnique({ where: { name: companyStyle } });
    if (!company) {
      return res.status(400).json({ error: `Unknown companyStyle: ${companyStyle}` });
    }

    if (stream) {
      res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('X-Accel-Buffering', 'no');
      if (typeof res.flushHeaders === 'function') res.flushHeaders();
      writeNdjson(res, { type: 'status', message: 'Preparing your interview…' });
    }

    let jdContext = null;
    if (jdText && String(jdText).trim()) {
      if (stream) writeNdjson(res, { type: 'status', message: 'Reading job description…' });
      try {
        jdContext = await chatJson({
          messages: buildJdExtractMessages(String(jdText).trim()),
          temperature: 0.2,
        });
      } catch (err) {
        console.warn('JD extract failed:', err.message);
      }
    }

    const resolvedMode = practicePack === 'behavioral_star' ? 'behavioral' : mode;

    let roleCurriculum = null;
    try {
      if (stream) writeNdjson(res, { type: 'status', message: 'Loading role curriculum…' });
      roleCurriculum = await getOrCreateCurriculum({
        targetRole: user.targetRole,
        mode: resolvedMode,
        jdText: jdText ? String(jdText).trim() : null,
        resumeText: user.resumeText,
      });
    } catch (err) {
      console.warn('Role curriculum generation failed, continuing without it:', err.message);
    }

    const session = await prisma.session.create({
      data: {
        userId,
        companyStyle: company.name,
        jdText: jdText ? String(jdText) : null,
        mode: resolvedMode,
        roleCurriculum: roleCurriculum ? JSON.stringify(roleCurriculum) : null,
        plannedCount: count,
        difficulty,
        practicePack,
        interviewLanguage,
        coveredTopics: [],
        memory: emptyMemory({ difficulty }),
      },
    });

    try {
      await ensureCognitiveModel(session);
    } catch (err) {
      console.warn('[intelligence] ensure CCM on start failed:', err.message);
    }

    if (isRoleCurriculumEnabled()) {
      try {
        await ensurePrimaryEnrollment(userId, user.targetRole);
      } catch (err) {
        console.warn('[intelligence] role enrollment failed:', err.message);
      }
    }

    let startIntelligence = null;
    try {
      startIntelligence = await analyzeResumeAtStart({
        session,
        user,
        jdText: jdText ? String(jdText).trim() : null,
        roleCurriculum,
      });
    } catch (err) {
      console.warn('[intelligence] start analysis failed:', err.message);
    }

    if (stream) writeNdjson(res, { type: 'session', sessionId: session.id, plannedCount: count });

    const masteryRows = await getKnowledgeProfile(userId, { limit: 30 });
    const knowledgeProfile = formatKnowledgeProfile(masteryRows);

    const startMemory = emptyMemory({ difficulty });

    let questionResult;
    if (stream) {
      writeNdjson(res, { type: 'status', message: 'Interviewer is drafting your first question…' });
      questionResult = await generateNextQuestion({
        session,
        company,
        user,
        previousQuestions: [],
        lastEvaluation: null,
        memory: startMemory,
        knowledgeProfile,
        jdContext,
        companyProfile: companyProfile(company),
        stream: true,
        onToken: (delta) => writeNdjson(res, { type: 'token', delta }),
      });
    } else {
      questionResult = await generateNextQuestion({
        session,
        company,
        user,
        previousQuestions: [],
        lastEvaluation: null,
        memory: startMemory,
        knowledgeProfile,
        jdContext,
        companyProfile: companyProfile(company),
      });
    }
    const question = questionResult.question;

    if (startIntelligence && questionResult.objective) {
      startIntelligence.questionSource = questionResult.source;
      startIntelligence.objective = questionResult.objective;
      startIntelligence.plan = questionResult.plan;
      startIntelligence.rationale = questionResult.objective.rationale;
    }

    await prisma.session.update({
      where: { id: session.id },
      data: { currentQuestion: question, currentIsFollowUp: false },
    });

    const payload = {
      sessionId: session.id,
      question,
      plannedCount: count,
      difficulty,
      practicePack,
      interviewLanguage,
      mode: resolvedMode,
      roleCurriculum: roleCurriculum || null,
      ...(startIntelligence ? { intelligence: startIntelligence } : {}),
    };

    if (stream) {
      writeNdjson(res, { type: 'done', ...payload });
      return res.end();
    }

    res.json(payload);
  } catch (err) {
    if (stream && !res.headersSent) {
      return next(err);
    }
    if (stream && res.headersSent) {
      try {
        writeNdjson(res, { type: 'error', error: err.message || 'Start failed' });
        res.end();
      } catch {
        // ignore
      }
      return;
    }
    next(err);
  }
});

router.post('/:id/resume', async (req, res, next) => {
  try {
    const ctx = await loadSessionContext(req.params.id);
    if (!ctx) return res.status(404).json({ error: 'Session not found' });
    const { session } = ctx;
    if (session.userId !== req.userId) return res.status(403).json({ error: 'Forbidden' });
    if (session.hiringVerdict) {
      return res.status(400).json({ error: 'This session is already finished' });
    }
    if (!session.currentQuestion) {
      return res.status(400).json({ error: 'No question saved to resume. Start a new session.' });
    }

    const answeredMain = session.questions.filter((q) => !q.isFollowUp).length;

    res.json({
      sessionId: session.id,
      question: session.currentQuestion,
      isFollowUp: Boolean(session.currentIsFollowUp),
      mode: session.mode,
      plannedCount: session.plannedCount,
      answeredCount: answeredMain,
      interviewLanguage: session.interviewLanguage || 'english',
      practicePack: session.practicePack,
      difficulty: session.difficulty,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/answer', async (req, res, next) => {
  const stream = wantsStream(req);
  try {
    const {
      questionText,
      userAnswer,
      speakingSeconds,
      isFollowUpAnswer,
      isRetry,
    } = req.body || {};
    if (!questionText || !userAnswer) {
      return res.status(400).json({ error: 'questionText and userAnswer are required' });
    }

    const quality = assessAnswerQuality(userAnswer);
    if (!quality.ok) {
      return res.status(400).json({ error: quality.error });
    }

    const ctx = await loadSessionContext(req.params.id);
    if (!ctx) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const { session, company } = ctx;
    if (session.userId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (!company) {
      return res.status(500).json({ error: 'Company style missing for session' });
    }
    if (session.hiringVerdict) {
      return res.status(400).json({ error: 'Session already finished' });
    }

    if (stream) {
      res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('X-Accel-Buffering', 'no');
      if (typeof res.flushHeaders === 'function') res.flushHeaders();
      writeNdjson(res, { type: 'status', message: 'Evaluating your answer…' });
    }

    // Retry replaces the latest attempt for this question text.
    if (isRetry) {
      const prior = [...session.questions]
        .reverse()
        .find((q) => q.questionText === questionText);
      if (prior) {
        await prisma.question.delete({ where: { id: prior.id } });
        session.questions = session.questions.filter((q) => q.id !== prior.id);
      }
    }

    const delivery = analyzeSpeechDelivery(userAnswer, speakingSeconds);

    const turn =
      session.questions.filter((q) => !q.isFollowUp).length +
      (isFollowUpAnswer ? 0 : 1);

    const previousQuestionsForEval = session.questions.map((q) => q.questionText);

    const evalResult = await evaluateAnswer({
      session,
      company,
      questionText,
      userAnswer,
      delivery,
      companyProfile: companyProfile(company),
      previousQuestions: previousQuestionsForEval,
      targetRole: session.user?.targetRole || null,
    });

    const evaluation = evalResult.normalized
      ? evalResult.normalized
      : normalizeEvaluation(evalResult.rawEvaluation);

    const saved = await prisma.question.create({
      data: {
        sessionId: session.id,
        questionText,
        userAnswer,
        ...questionCreateData(evaluation, {
          fillerWordCount: delivery.fillerWordCount,
          wordCount: delivery.wordCount,
          speakingSeconds: delivery.speakingSeconds,
          wordsPerMinute: delivery.wordsPerMinute,
          isFollowUp: Boolean(isFollowUpAnswer),
        }),
      },
    });

    if (evalResult.source === 'v2-brain' && evalResult.brain) {
      try {
        const applied = await applyBrainResult({
          session,
          questionId: saved.id,
          turn,
          brain: evalResult.brain,
        });
        if (evalResult.intelligence) {
          evalResult.intelligence.evidenceCount = applied.evidenceIds?.length || 0;
          evalResult.intelligence.pendingEvidence = false;
          evalResult.intelligence.updatedHypotheses = applied.updatedHypotheses || 0;
          evalResult.intelligence.resolvedUncertainties =
            applied.resolvedUncertainties || 0;
          evalResult.intelligence.neighborhoodInfluenceCount =
            applied.neighborhoodInfluences?.length || 0;
          evalResult.intelligence.misconceptionCount =
            applied.misconceptionIds?.length || 0;
        }
      } catch (err) {
        console.warn('[intelligence] apply Brain result failed:', err.message);
      }
    } else if (evalResult.technical || evalResult.communication) {
      try {
        const { evidenceIds, updatedHypotheses, resolvedUncertainties, neighborhoodInfluences } =
          await persistEvaluationEvidence({
          session,
          questionId: saved.id,
          turn,
          technical: evalResult.technical,
          communication: evalResult.communication,
        });
        if (evalResult.intelligence) {
          evalResult.intelligence.evidenceCount = evidenceIds.length;
          evalResult.intelligence.pendingEvidence = false;
          evalResult.intelligence.updatedHypotheses = updatedHypotheses || 0;
          evalResult.intelligence.resolvedUncertainties = resolvedUncertainties || 0;
          evalResult.intelligence.neighborhoodInfluenceCount =
            neighborhoodInfluences?.length || 0;
        }
      } catch (err) {
        console.warn('[intelligence] persist evidence failed:', err.message);
      }

      if (evalResult.misconceptions?.length) {
        try {
          const misconceptionIds = await persistMisconceptions({
            sessionId: session.id,
            misconceptions: evalResult.misconceptions,
          });
          if (evalResult.intelligence) {
            evalResult.intelligence.misconceptionCount = misconceptionIds.length;
          }
        } catch (err) {
          console.warn('[intelligence] persist misconceptions failed:', err.message);
        }
      }
    }

    try {
      await applyEvaluationToKnowledge({
        userId: session.userId,
        questionId: saved.id,
        evaluation,
      });
    } catch (err) {
      console.warn('Knowledge graph update failed:', err.message);
    }

    const prevMemory = readMemory(session);
    const nextMemory = updateMemoryAfterAnswer(prevMemory, {
      questionText,
      evaluation,
      isFollowUp: Boolean(isFollowUpAnswer),
    });

    const coveredTopics = uniqueMerge(session.coveredTopics, saved.topicTags);
    await prisma.session.update({
      where: { id: session.id },
      data: { coveredTopics, memory: nextMemory },
    });
    session.coveredTopics = coveredTopics;
    session.memory = nextMemory;

    const answeredMain =
      session.questions.filter((q) => !q.isFollowUp).length + (isFollowUpAnswer ? 0 : 1);
    const planned = session.plannedCount || 8;
    const sessionComplete = answeredMain >= planned;

    const previousQuestions = [...session.questions.map((q) => q.questionText), questionText];

    const lastEvaluationCtx = {
      technicalScore: saved.technicalScore,
      communicationScore: saved.communicationScore,
      depthScore: saved.depthScore,
      structureScore: saved.structureScore,
      topicTags: saved.topicTags,
      missingPoints: saved.missingPoints,
      conceptsIncorrect: saved.conceptsIncorrect,
      conceptsPartial: saved.conceptsPartial,
      feedback: saved.feedback,
    };

    const lastWasFollowUp = Boolean(isFollowUpAnswer);
    const wantsFollowUp = shouldAskFollowUp({
      evaluation,
      lastWasFollowUp,
      sessionComplete,
    });

    const lastEvalPayload = evaluationPayload(saved);

    if (stream) {
      writeNdjson(res, {
        type: 'evaluation',
        lastEvaluation: lastEvalPayload,
        answeredCount: answeredMain,
        plannedCount: planned,
        sessionComplete,
        coveredTopics,
        ...(evalResult.intelligence ? { intelligence: evalResult.intelligence } : {}),
      });
    }

    const refreshedUser = await prisma.user.findUnique({ where: { id: session.userId } });
    const masteryRows = await getKnowledgeProfile(session.userId, { limit: 30 });
    const knowledgeProfile = formatKnowledgeProfile(masteryRows);

    let nextQuestion = null;
    let isFollowUp = false;

    if (!sessionComplete) {
      const useV2Questions = isIntelligenceV2Enabled();
      const brainAlreadyHasNext =
        evalResult.source === 'v2-brain' && evalResult.nextQuestion?.text;

      if (brainAlreadyHasNext) {
        nextQuestion = evalResult.nextQuestion.text;
        isFollowUp = Boolean(
          evalResult.nextQuestion.isFollowUp || evalResult.objective?.followUp,
        );
        if (stream) {
          writeNdjson(res, { type: 'status', message: 'Preparing your next question…' });
          writeNdjson(res, { type: 'token', delta: nextQuestion });
        }
      } else if (!useV2Questions && wantsFollowUp && (nextMemory.followUpBudget ?? 0) >= 0) {
        nextQuestion = String(evaluation.followUpQuestion).trim();
        isFollowUp = true;
      } else {
        const questionArgs = {
          session,
          company,
          user: refreshedUser || session.user,
          previousQuestions,
          lastEvaluation: lastEvaluationCtx,
          memory: nextMemory,
          knowledgeProfile,
          companyProfile: companyProfile(company),
        };

        if (stream) {
          writeNdjson(res, { type: 'status', message: 'Preparing your next question…' });
          questionArgs.stream = true;
          questionArgs.onToken = (delta) => writeNdjson(res, { type: 'token', delta });
        }

        const questionResult = await generateNextQuestion(questionArgs);
        nextQuestion = questionResult.question;
        isFollowUp = questionResult.isFollowUp;

        if (evalResult.intelligence) {
          evalResult.intelligence.questionSource = questionResult.source;
          if (questionResult.objective) {
            evalResult.intelligence.objective = questionResult.objective;
            evalResult.intelligence.plan = questionResult.plan;
            evalResult.intelligence.rationale = questionResult.objective.rationale;
          }
        }
      }
    }

    await prisma.session.update({
      where: { id: session.id },
      data: {
        currentQuestion: sessionComplete ? null : nextQuestion,
        currentIsFollowUp: Boolean(isFollowUp),
        coveredTopics,
        memory: nextMemory,
      },
    });

    const payload = {
      nextQuestion,
      isFollowUp,
      sessionComplete,
      answeredCount: answeredMain,
      plannedCount: planned,
      coveredTopics,
      lastEvaluation: lastEvalPayload,
      memory: nextMemory,
      ...(evalResult.intelligence ? { intelligence: evalResult.intelligence } : {}),
    };

    if (stream) {
      writeNdjson(res, { type: 'done', ...payload });
      return res.end();
    }

    res.json(payload);
  } catch (err) {
    if (stream && res.headersSent) {
      try {
        writeNdjson(res, { type: 'error', error: err.message || 'Answer failed' });
        res.end();
      } catch {
        // ignore
      }
      return;
    }
    next(err);
  }
});

router.post('/:id/finish', async (req, res, next) => {
  try {
    const ctx = await loadSessionContext(req.params.id);
    if (!ctx) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const { session, company } = ctx;
    if (session.userId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (!company) {
      return res.status(500).json({ error: 'Company style missing for session' });
    }

    const overallScore = averageScores(session.questions);

    const reportResult = await generateSessionReport({
      session,
      company,
      questions: session.questions,
      overallScore,
    });

    const verdict = reportResult.verdict;
    const hiringVerdict = verdict.hiringVerdict;
    const reasoning = verdict.reasoning;

    const shareToken = session.shareToken || makeShareToken();

    const previousSession = await prisma.session.findFirst({
      where: {
        userId: session.userId,
        id: { not: session.id },
        hiringVerdict: { not: null },
        mode: session.mode,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        overallScore: true,
        hiringVerdict: true,
        createdAt: true,
        companyStyle: true,
      },
    });

    let comparison = null;
    if (previousSession && previousSession.overallScore != null) {
      const delta = Math.round((overallScore - previousSession.overallScore) * 100) / 100;
      comparison = {
        previousSessionId: previousSession.id,
        previousScore: previousSession.overallScore,
        previousVerdict: previousSession.hiringVerdict,
        previousCompanyStyle: previousSession.companyStyle,
        previousDate: previousSession.createdAt,
        currentScore: overallScore,
        delta,
        improved: delta > 0,
      };
    }

    const reportAnalysis = reportResult.reportAnalysis;

    const [updatedSession] = await prisma.$transaction([
      prisma.session.update({
        where: { id: session.id },
        data: {
          overallScore,
          hiringVerdict,
          shareToken,
          currentQuestion: null,
          currentIsFollowUp: false,
          hireProbability: verdict.hireProbability,
          readinessScore: verdict.readinessScore,
          strengths: verdict.strengths,
          weaknesses: verdict.weaknesses,
          repeatedMistakes: verdict.repeatedMistakes,
          recommendedPath: verdict.recommendedLearningPath,
          verdictReasoning: reasoning,
          reportAnalysis,
        },
        include: { questions: { orderBy: { createdAt: 'asc' } } },
      }),
    ]);

    const { weakTopics, strongTopics } = await syncUserTopicCaches(session.userId);

    let studyPlan = null;
    try {
      studyPlan = await generateStudyPlan({
        userId: session.userId,
        session: { ...updatedSession, user: session.user },
        company,
        verdict,
        questions: updatedSession.questions,
        intelligenceReport: reportResult.reportAnalysis,
      });
    } catch (err) {
      console.warn('Study plan generation failed:', err.message);
    }

    try {
      const avgComm =
        updatedSession.questions.length > 0
          ? updatedSession.questions.reduce((s, q) => s + q.communicationScore, 0) /
            updatedSession.questions.length
          : null;
      await createProgressSnapshot(session.userId, {
        accuracy: overallScore,
        communication: avgComm,
        readiness: verdict.readinessScore,
      });
    } catch (err) {
      console.warn('Progress snapshot failed:', err.message);
    }

    res.json({
      session: updatedSession,
      hiringVerdict,
      reasoning,
      overallScore,
      hireProbability: verdict.hireProbability,
      readinessScore: verdict.readinessScore,
      strengths: verdict.strengths,
      weaknesses: verdict.weaknesses,
      repeatedMistakes: verdict.repeatedMistakes,
      missedConcepts: verdict.missedConcepts,
      recommendedLearningPath: verdict.recommendedLearningPath,
      confidenceAnalysis: verdict.confidenceAnalysis,
      communicationAnalysis: verdict.communicationAnalysis,
      technicalAnalysis: verdict.technicalAnalysis,
      bestAnswerQ: verdict.bestAnswerQ,
      worstAnswerQ: verdict.worstAnswerQ,
      weakTopics,
      strongTopics,
      shareUrl: `/r/${shareToken}`,
      comparison,
      studyPlan,
      ...(reportResult.intelligence ? { intelligence: reportResult.intelligence } : {}),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/share', async (req, res, next) => {
  try {
    const session = await prisma.session.findUnique({ where: { id: req.params.id } });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.userId !== req.userId) return res.status(403).json({ error: 'Forbidden' });
    if (!session.hiringVerdict) {
      return res.status(400).json({ error: 'Finish the session before sharing the report' });
    }

    const shareToken = session.shareToken || makeShareToken();
    if (!session.shareToken) {
      await prisma.session.update({
        where: { id: session.id },
        data: { shareToken },
      });
    }

    res.json({ shareToken, shareUrl: `/r/${shareToken}` });
  } catch (err) {
    next(err);
  }
});

/**
 * Read-only CCM projection for the intelligence UI.
 * GET /session/:id/cognitive-model
 */
router.get('/:id/cognitive-model', async (req, res, next) => {
  try {
    const session = await prisma.session.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        userId: true,
        difficulty: true,
        memory: true,
        hiringVerdict: true,
        reportAnalysis: true,
      },
    });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (session.userId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const model = await loadCognitiveModel(session);
    const dimensions = model.dimensions || {};
    const dimensionList = Object.entries(dimensions).map(([key, belief]) => ({
      key,
      score: belief?.score ?? null,
      confidence: belief?.confidence ?? 0,
      verification: belief?.verification || 'unverified',
      trend: belief?.trend || 'unknown',
      lastUpdatedTurn: belief?.lastUpdatedTurn ?? 0,
    }));

    const concepts = (model.concepts || []).map((c) => ({
      conceptSlug: c.conceptSlug,
      score: c.knowledge?.score ?? null,
      confidence: c.knowledge?.confidence ?? 0,
      verification: c.knowledge?.verification || 'unverified',
      status: c.status || 'unknown',
      neighborhoodInfluence: c.neighborhoodInfluence ?? 0,
      timesProbed: c.timesProbed ?? 0,
    }));

    const reportAnalysis =
      session.reportAnalysis && typeof session.reportAnalysis === 'object'
        ? session.reportAnalysis
        : null;

    res.json({
      sessionId: session.id,
      enabled: isIntelligenceV2Enabled(),
      source: model.meta?.source || 'unknown',
      dimensions: dimensionList,
      concepts,
      growth: model.growth ?? null,
      dimensionReport: reportAnalysis?.dimensionReport || [],
      misconceptions: reportAnalysis?.misconceptions || [],
      intelligenceSource: reportAnalysis?.intelligenceSource || null,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Hypotheses + linked evidence chains for the intelligence UI.
 * GET /session/:id/hypotheses
 */
router.get('/:id/hypotheses', async (req, res, next) => {
  try {
    const session = await prisma.session.findUnique({
      where: { id: req.params.id },
      select: { id: true, userId: true, reportAnalysis: true },
    });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (session.userId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const [hypotheses, evidence, misconceptions, resumeClaims] = await Promise.all([
      prisma.hypothesis.findMany({
        where: { sessionId: session.id },
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      }),
      prisma.evidence.findMany({
        where: { sessionId: session.id },
        orderBy: [{ turn: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.misconception.findMany({
        where: { sessionId: session.id },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.resumeClaim.findMany({
        where: { sessionId: session.id },
        orderBy: { createdAt: 'asc' },
        take: 20,
      }),
    ]);

    const evidenceByHypothesis = new Map();
    const unlinkedEvidence = [];
    for (const e of evidence) {
      const item = {
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
      };
      if (e.hypothesisId) {
        const list = evidenceByHypothesis.get(e.hypothesisId) || [];
        list.push(item);
        evidenceByHypothesis.set(e.hypothesisId, list);
      } else {
        unlinkedEvidence.push(item);
      }
    }

    const reportAnalysis =
      session.reportAnalysis && typeof session.reportAnalysis === 'object'
        ? session.reportAnalysis
        : null;

    res.json({
      sessionId: session.id,
      enabled: isIntelligenceV2Enabled(),
      hypotheses: hypotheses.map((h) => ({
        id: h.id,
        statement: h.statement,
        conceptSlugs: h.conceptSlugs,
        origin: h.origin,
        status: h.status,
        confidence: h.confidence,
        priority: h.priority,
        createdTurn: h.createdTurn,
        lastTestedTurn: h.lastTestedTurn,
        evidence: evidenceByHypothesis.get(h.id) || [],
      })),
      misconceptions: misconceptions.map((m) => ({
        id: m.id,
        conceptSlug: m.conceptSlug,
        statement: m.statement,
        correctStatement: m.correctStatement,
        status: m.status,
        candidateConfidence: m.candidateConfidence,
        ourConfidence: m.ourConfidence,
      })),
      resumeClaims: resumeClaims.map((c) => ({
        id: c.id,
        claim: c.claim,
        conceptSlugs: c.conceptSlugs,
        importance: c.importance,
        verification: c.verification,
      })),
      resolvedHypotheses: reportAnalysis?.resolvedHypotheses || [],
      unlinkedEvidenceCount: unlinkedEvidence.length,
      evidenceCount: evidence.length,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const session = await prisma.session.findUnique({
      where: { id: req.params.id },
      include: {
        questions: { orderBy: { createdAt: 'asc' } },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            weakTopics: true,
            strongTopics: true,
            targetRole: true,
          },
        },
      },
    });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (session.userId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(session);
  } catch (err) {
    next(err);
  }
});

publicRouter.get('/report/:token', async (req, res, next) => {
  try {
    const session = await prisma.session.findUnique({
      where: { shareToken: req.params.token },
      include: {
        questions: { orderBy: { createdAt: 'asc' } },
        user: { select: { name: true, targetRole: true } },
      },
    });
    if (!session || !session.hiringVerdict) {
      return res.status(404).json({ error: 'Shared report not found' });
    }

    res.json({
      companyStyle: session.companyStyle,
      mode: session.mode,
      difficulty: session.difficulty,
      practicePack: session.practicePack,
      interviewLanguage: session.interviewLanguage,
      overallScore: session.overallScore,
      hiringVerdict: session.hiringVerdict,
      createdAt: session.createdAt,
      candidateName: session.user?.name || 'Candidate',
      targetRole: session.user?.targetRole || null,
      questions: session.questions.map((q) => ({
        questionText: q.questionText,
        userAnswer: q.userAnswer,
        feedback: q.feedback,
        technicalScore: q.technicalScore,
        communicationScore: q.communicationScore,
        depthScore: q.depthScore,
        structureScore: q.structureScore,
        improvedAnswer: q.improvedAnswer,
        studyTips: q.studyTips,
        conceptExplanation: q.conceptExplanation,
        isFollowUp: q.isFollowUp,
        fillerWordCount: q.fillerWordCount,
        wordsPerMinute: q.wordsPerMinute,
      })),
    });
  } catch (err) {
    next(err);
  }
});

export { publicRouter };
export default router;
