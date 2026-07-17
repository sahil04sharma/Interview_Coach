import { prisma } from '../db.js';
import { chatJson } from '../llm.js';
import { buildStudyPlanMessages } from '../prompts.js';
import { getKnowledgeProfile } from './knowledgeService.js';

function tomorrowDate() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  return d;
}

/**
 * Generate and persist a study plan after a finished session.
 */
export async function generateStudyPlan({
  userId,
  session,
  company,
  verdict,
  questions,
  intelligenceReport = null,
}) {
  const masteries = await getKnowledgeProfile(userId, { limit: 30 });
  const weak = masteries
    .filter((m) => m.status === 'weak' || m.status === 'learning')
    .slice(0, 12)
    .map((m) => ({
      name: m.concept.name,
      slug: m.concept.slug,
      masteryScore: m.masteryScore,
      mistakes: m.repeatedMistakes,
    }));

  let planJson;
  try {
    planJson = await chatJson({
      messages: buildStudyPlanMessages({
        companyName: company?.name || session.companyStyle,
        questions,
        verdict,
        weakConcepts: weak,
        interviewLanguage: session.interviewLanguage || 'english',
        targetRole: session.user?.targetRole,
        intelligenceReport,
      }),
      temperature: 0.35,
    });
  } catch (err) {
    console.warn('Study plan LLM failed, using heuristic plan:', err.message);
    planJson = heuristicPlan({ weak, questions, verdict });
  }

  const items = Array.isArray(planJson.items) ? planJson.items : [];
  const estimatedMinutes = Math.max(
    20,
    Math.min(180, Number(planJson.estimatedMinutes) || items.length * 25 || 45),
  );

  // Mark prior active plans completed
  await prisma.studyPlan.updateMany({
    where: { userId, status: 'active' },
    data: { status: 'archived' },
  });

  const plan = await prisma.studyPlan.create({
    data: {
      userId,
      sessionId: session.id,
      title: String(planJson.title || "Tomorrow's Study Plan"),
      summary: String(planJson.summary || ''),
      estimatedMinutes,
      readinessScore:
        verdict?.estimatedInterviewReadiness ?? verdict?.readinessScore ?? null,
      items,
      status: 'active',
      forDate: tomorrowDate(),
    },
  });

  return plan;
}

function heuristicPlan({ weak, questions, verdict }) {
  const gaps = [];
  for (const q of questions || []) {
    gaps.push(...(q.knowledgeGaps || []), ...(q.missingPoints || []));
  }
  const uniqueGaps = [...new Set(gaps.map(String).filter(Boolean))].slice(0, 6);

  const items = (weak.length ? weak : uniqueGaps.map((g) => ({ name: g }))).slice(0, 5).map(
    (w, i) => ({
      priority: i + 1,
      concept: w.name,
      slug: w.slug || null,
      estimatedMinutes: 20 + i * 5,
      explanation: `Revise ${w.name} with a concrete example you can say out loud.`,
      practiceQuestions: [
        `Explain ${w.name} as if teaching a junior engineer.`,
        `Describe a production scenario where ${w.name} matters and the trade-offs.`,
      ],
      retryInterviewAngle: `Expect a follow-up on ${w.name} in your next mock.`,
      revisionNotes: (w.mistakes || []).slice(0, 2).join('; ') || uniqueGaps[i] || '',
    }),
  );

  return {
    title: "Tomorrow's Study Plan",
    summary:
      verdict?.recommendedLearningPath ||
      'Focus on your weakest concepts with short, interview-style practice.',
    estimatedMinutes: items.reduce((s, it) => s + (it.estimatedMinutes || 20), 0),
    items,
  };
}

export async function getActiveStudyPlan(userId) {
  return prisma.studyPlan.findFirst({
    where: { userId, status: 'active' },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getStudyPlanById(userId, id) {
  const plan = await prisma.studyPlan.findUnique({ where: { id } });
  if (!plan || plan.userId !== userId) return null;
  return plan;
}

export async function listStudyPlans(userId, { take = 10 } = {}) {
  return prisma.studyPlan.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take,
  });
}
