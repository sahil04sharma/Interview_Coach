import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../db.js';
import { publicUser, requireAuth } from '../auth.js';
import { extractTextFromPdf } from '../pdf.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (file.mimetype !== 'application/pdf') {
      cb(new Error('Only PDF files are allowed'));
      return;
    }
    cb(null, true);
  },
});

router.use(requireAuth);

router.get('/me', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(publicUser(user));
  } catch (err) {
    next(err);
  }
});

router.put('/me', async (req, res, next) => {
  try {
    const { name, resumeText, targetRole, preferredLanguage } = req.body || {};
    const data = {};
    if (typeof name === 'string') data.name = name;
    if (typeof resumeText === 'string') data.resumeText = resumeText;
    if (targetRole === null || typeof targetRole === 'string') data.targetRole = targetRole;
    if (typeof preferredLanguage === 'string' && ['english', 'hinglish', 'hindi'].includes(preferredLanguage)) {
      data.preferredLanguage = preferredLanguage;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const user = await prisma.user.update({
      where: { id: req.userId },
      data,
    });
    res.json(publicUser(user));
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    next(err);
  }
});

router.post('/me/resume-pdf', upload.single('resume'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Upload a PDF file as "resume"' });
    }

    const { text, pages } = await extractTextFromPdf(req.file.buffer);
    if (!text) {
      return res.status(400).json({ error: 'Could not extract text from that PDF' });
    }

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { resumeText: text },
    });

    res.json({
      user: publicUser(user),
      extractedChars: text.length,
      pages,
    });
  } catch (err) {
    if (err.message === 'Only PDF files are allowed') {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

router.get('/me/stats', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const sessions = await prisma.session.findMany({
      where: { userId: req.userId },
      include: { questions: true },
      orderBy: { createdAt: 'desc' },
    });

    const topicMap = new Map();
    let answeredQuestions = 0;
    let scoreSum = 0;
    let scoreCount = 0;

    for (const session of sessions) {
      for (const q of session.questions) {
        answeredQuestions += 1;
        scoreSum += q.technicalScore + q.communicationScore + q.depthScore + q.structureScore;
        scoreCount += 4;
        for (const tag of q.topicTags || []) {
          const key = tag.trim();
          if (!key) continue;
          const entry = topicMap.get(key) || { topic: key, count: 0, technicalSum: 0 };
          entry.count += 1;
          entry.technicalSum += q.technicalScore;
          topicMap.set(key, entry);
        }
      }
    }

    const topics = [...topicMap.values()]
      .map((t) => ({
        topic: t.topic,
        count: t.count,
        avgTechnical: Math.round((t.technicalSum / t.count) * 10) / 10,
      }))
      .sort((a, b) => a.avgTechnical - b.avgTechnical);

    res.json({
      weakTopics: user.weakTopics,
      strongTopics: user.strongTopics,
      sessionCount: sessions.length,
      finishedCount: sessions.filter((s) => s.hiringVerdict).length,
      answeredQuestions,
      averageScore: scoreCount ? Math.round((scoreSum / scoreCount) * 100) / 100 : null,
      topicStats: topics,
      recentSessions: sessions.slice(0, 12).map((s) => ({
        id: s.id,
        companyStyle: s.companyStyle,
        mode: s.mode,
        overallScore: s.overallScore,
        hiringVerdict: s.hiringVerdict,
        createdAt: s.createdAt,
        questionCount: s.questions.length,
      })),
      scoreTrend: sessions
        .filter((s) => s.overallScore != null)
        .slice(0, 10)
        .reverse()
        .map((s) => ({
          id: s.id,
          score: s.overallScore,
          date: s.createdAt,
          label: s.companyStyle,
        })),
      deliveryAverages: (() => {
        const withSpeech = sessions.flatMap((s) => s.questions).filter((q) => q.wordsPerMinute != null);
        if (!withSpeech.length) return null;
        const avg = (key) =>
          Math.round(
            (withSpeech.reduce((sum, q) => sum + (q[key] || 0), 0) / withSpeech.length) * 10,
          ) / 10;
        return {
          wordsPerMinute: avg('wordsPerMinute'),
          fillerWordCount: avg('fillerWordCount'),
          samples: withSpeech.length,
        };
      })(),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
