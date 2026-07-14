import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { prisma } from '../db.js';
import { requireAuth } from '../auth.js';
import { chatCompletion, chatCompletionStream, chatJson } from '../llm.js';
import {
  buildEvaluatorMessages,
  buildInterviewerMessages,
  buildJdExtractMessages,
  buildVerdictMessages,
} from '../prompts.js';
import { analyzeSpeechDelivery } from '../speech.js';
import { assessAnswerQuality } from '../answerQuality.js';
import { fallbackQuestion } from '../fallbackQuestions.js';
import { getOrCreateCurriculum } from '../curriculumCache.js';

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

function clampScore(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(10, n));
}

function optionalScore(value) {
  if (value === null || value === undefined || value === '') return null;
  return clampScore(value);
}

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

function interviewerArgs({
  session,
  company,
  user,
  previousQuestions,
  jdContext = null,
  forcedFollowUp = null,
  lastEvaluation = null,
}) {
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
    difficulty: session.difficulty || 'medium',
    practicePack: session.practicePack || 'mixed',
    interviewLanguage: session.interviewLanguage || 'english',
    forcedFollowUp,
    lastEvaluation,
    coveredTopics: session.coveredTopics || [],
    focusWeakTopics: user.weakTopics,
  };
}

function evaluationPayload(saved) {
  return {
    id: saved.id,
    technicalScore: saved.technicalScore,
    communicationScore: saved.communicationScore,
    depthScore: saved.depthScore,
    structureScore: saved.structureScore,
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
    fillerWordCount: saved.fillerWordCount,
    wordCount: saved.wordCount,
    speakingSeconds: saved.speakingSeconds,
    wordsPerMinute: saved.wordsPerMinute,
  };
}

async function generateQuestionText(args, { stream = false, onToken } = {}) {
  try {
    if (stream && typeof onToken === 'function') {
      const text = await chatCompletionStream({
        messages: buildInterviewerMessages(args),
        temperature: 0.65,
        onToken,
      });
      if (text?.trim()) return text.trim();
    } else {
      const text = await chatCompletion({
        messages: buildInterviewerMessages(args),
        temperature: 0.65,
      });
      if (text?.trim()) return text.trim();
    }
  } catch (err) {
    console.warn('Question generation failed, using fallback:', err.message);
  }

  const weak =
    args.practicePack === 'weak_topics' && args.focusWeakTopics?.length
      ? args.focusWeakTopics[args.questionIndex % args.focusWeakTopics.length]
      : null;

  return fallbackQuestion({
    mode: args.mode,
    index: args.questionIndex,
    weakTopic: weak,
    interviewLanguage: args.interviewLanguage,
  });
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
      },
    });

    if (stream) writeNdjson(res, { type: 'session', sessionId: session.id, plannedCount: count });

    const args = interviewerArgs({
      session,
      company,
      user,
      previousQuestions: [],
      jdContext,
    });

    let question;
    if (stream) {
      writeNdjson(res, { type: 'status', message: 'Interviewer is drafting your first question…' });
      question = await generateQuestionText(args, {
        stream: true,
        onToken: (delta) => writeNdjson(res, { type: 'token', delta }),
      });
    } else {
      question = await generateQuestionText(args);
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

    const evaluation = await chatJson({
      messages: buildEvaluatorMessages({
        companyName: company.name,
        questionText,
        userAnswer,
        mode: session.mode,
        delivery,
        interviewLanguage: session.interviewLanguage || 'english',
      }),
      temperature: 0.2,
    });

    const saved = await prisma.question.create({
      data: {
        sessionId: session.id,
        questionText,
        userAnswer,
        idealAnswer: String(evaluation.idealAnswer || ''),
        improvedAnswer: String(evaluation.improvedAnswer || ''),
        conceptExplanation: String(evaluation.conceptExplanation || ''),
        missingPoints: Array.isArray(evaluation.missingPoints)
          ? evaluation.missingPoints.map(String)
          : [],
        topicTags: Array.isArray(evaluation.topicTags) ? evaluation.topicTags.map(String) : [],
        technicalScore: clampScore(evaluation.technicalScore),
        communicationScore: clampScore(evaluation.communicationScore),
        depthScore: clampScore(evaluation.depthScore),
        structureScore: clampScore(evaluation.structureScore),
        starSituation: optionalScore(evaluation.starSituation),
        starTask: optionalScore(evaluation.starTask),
        starAction: optionalScore(evaluation.starAction),
        starResult: optionalScore(evaluation.starResult),
        fillerWordCount: delivery.fillerWordCount,
        wordCount: delivery.wordCount,
        speakingSeconds: delivery.speakingSeconds,
        wordsPerMinute: delivery.wordsPerMinute,
        isFollowUp: Boolean(isFollowUpAnswer),
        studyTips: Array.isArray(evaluation.studyTips) ? evaluation.studyTips.map(String) : [],
        feedback: String(evaluation.feedback || ''),
      },
    });

    const coveredTopics = uniqueMerge(session.coveredTopics, saved.topicTags);
    await prisma.session.update({
      where: { id: session.id },
      data: { coveredTopics },
    });
    session.coveredTopics = coveredTopics;

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
      });
    }

    let nextQuestion = null;
    let isFollowUp = false;

    if (!sessionComplete) {
      if (wantsFollowUp) {
        nextQuestion = String(evaluation.followUpQuestion).trim();
        isFollowUp = true;
      } else if (stream) {
        writeNdjson(res, { type: 'status', message: 'Preparing your next question…' });
        nextQuestion = await generateQuestionText(
          interviewerArgs({
            session,
            company,
            user: session.user,
            previousQuestions,
            lastEvaluation: lastEvaluationCtx,
          }),
          {
            stream: true,
            onToken: (delta) => writeNdjson(res, { type: 'token', delta }),
          },
        );
      } else {
        nextQuestion = await generateQuestionText(
          interviewerArgs({
            session,
            company,
            user: session.user,
            previousQuestions,
            lastEvaluation: lastEvaluationCtx,
          }),
        );
      }
    }

    await prisma.session.update({
      where: { id: session.id },
      data: {
        currentQuestion: sessionComplete ? null : nextQuestion,
        currentIsFollowUp: Boolean(isFollowUp),
        coveredTopics,
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

    const weakFromSession = [];
    const strongFromSession = [];
    for (const q of session.questions) {
      if (q.technicalScore < 6) weakFromSession.push(...q.topicTags);
      if (q.technicalScore >= 8) strongFromSession.push(...q.topicTags);
    }

    const weakTopics = uniqueMerge(session.user.weakTopics, weakFromSession);
    const strongTopics = uniqueMerge(session.user.strongTopics, strongFromSession);

    const verdict = await chatJson({
      messages: buildVerdictMessages({
        companyName: company.name,
        questions: session.questions,
        interviewLanguage: session.interviewLanguage || 'english',
      }),
      temperature: 0.3,
    });

    const hiringVerdict = String(verdict.hiringVerdict || 'Leaning No Hire');
    const reasoning = String(verdict.reasoning || '');

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

    const [updatedSession, updatedUser] = await prisma.$transaction([
      prisma.session.update({
        where: { id: session.id },
        data: {
          overallScore,
          hiringVerdict,
          shareToken,
          currentQuestion: null,
          currentIsFollowUp: false,
        },
        include: { questions: { orderBy: { createdAt: 'asc' } } },
      }),
      prisma.user.update({
        where: { id: session.userId },
        data: { weakTopics, strongTopics },
      }),
    ]);

    res.json({
      session: updatedSession,
      hiringVerdict,
      reasoning,
      overallScore,
      weakTopics: updatedUser.weakTopics,
      strongTopics: updatedUser.strongTopics,
      shareUrl: `/r/${shareToken}`,
      comparison,
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
