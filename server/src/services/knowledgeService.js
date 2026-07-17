import { prisma } from '../db.js';

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function masteryStatus(score, attempts) {
  if (attempts < 1) return 'weak';
  if (score >= 8.5) return 'mastered';
  if (score >= 7) return 'strong';
  if (score >= 5) return 'learning';
  return 'weak';
}

/**
 * Resolve concept names/tags to Concept rows (create if missing).
 */
export async function ensureConcepts(names = [], { domain = 'general' } = {}) {
  const cleaned = [...new Set(names.map((n) => String(n).trim()).filter(Boolean))];
  const concepts = [];

  for (const name of cleaned) {
    const slug = slugify(name);
    if (!slug) continue;

    const concept = await prisma.concept.upsert({
      where: { slug },
      update: {},
      create: {
        slug,
        name,
        domain,
        description: '',
      },
    });
    concepts.push(concept);
  }

  return concepts;
}

function statusForConcept(name, evaluation) {
  const n = name.toLowerCase();
  const incorrect = (evaluation.conceptsIncorrect || []).map((s) => String(s).toLowerCase());
  const correct = (evaluation.conceptsCorrect || []).map((s) => String(s).toLowerCase());
  const partial = (evaluation.conceptsPartial || []).map((s) => String(s).toLowerCase());
  const gaps = (evaluation.knowledgeGaps || []).map((s) => String(s).toLowerCase());

  if (incorrect.some((x) => x.includes(n) || n.includes(x))) return 'incorrect';
  if (gaps.some((x) => x.includes(n) || n.includes(x))) return 'missing';
  if (correct.some((x) => x.includes(n) || n.includes(x))) return 'correct';
  if (partial.some((x) => x.includes(n) || n.includes(x))) return 'partial';

  const tech = Number(evaluation.technicalScore ?? evaluation.accuracyScore ?? 5);
  if (tech >= 8) return 'correct';
  if (tech >= 5.5) return 'partial';
  if (tech < 4) return 'incorrect';
  return 'missing';
}

function scoreForStatus(status, evaluation) {
  const base = Number(evaluation.technicalScore ?? evaluation.accuracyScore ?? 5);
  if (status === 'correct') return Math.max(base, 8);
  if (status === 'partial') return Math.min(Math.max(base, 4), 7);
  if (status === 'incorrect') return Math.min(base, 3);
  return Math.min(base, 4);
}

/**
 * After saving a Question, link concepts and update mastery.
 */
export async function applyEvaluationToKnowledge({ userId, questionId, evaluation }) {
  const names = uniqueNames([
    ...(evaluation.topicTags || []),
    ...(evaluation.conceptsCorrect || []),
    ...(evaluation.conceptsPartial || []),
    ...(evaluation.conceptsIncorrect || []),
    ...(evaluation.knowledgeGaps || []),
  ]);

  if (!names.length) {
    return { concepts: [], masteries: [] };
  }

  const concepts = await ensureConcepts(names);
  const masteries = [];

  for (const concept of concepts) {
    const status = statusForConcept(concept.name, evaluation);
    const score = scoreForStatus(status, evaluation);

    await prisma.questionConcept.create({
      data: {
        questionId,
        conceptId: concept.id,
        status,
        score,
      },
    });

    const existing = await prisma.userConceptMastery.findUnique({
      where: {
        userId_conceptId: { userId, conceptId: concept.id },
      },
    });

    const mistakes = [
      ...(evaluation.missingPoints || []),
      ...(evaluation.knowledgeGaps || []),
    ]
      .map(String)
      .filter(Boolean)
      .slice(0, 3);

    let attempts = 1;
    let correctCount = status === 'correct' ? 1 : 0;
    let partialCount = status === 'partial' ? 1 : 0;
    let incorrectCount = status === 'incorrect' || status === 'missing' ? 1 : 0;
    let masteryScore = score;
    let repeatedMistakes = mistakes;

    if (existing) {
      attempts = existing.attempts + 1;
      correctCount = existing.correctCount + correctCount;
      partialCount = existing.partialCount + partialCount;
      incorrectCount = existing.incorrectCount + incorrectCount;
      masteryScore = Math.round((existing.masteryScore * 0.65 + score * 0.35) * 100) / 100;
      repeatedMistakes = [
        ...new Set([...(existing.repeatedMistakes || []), ...mistakes]),
      ].slice(0, 12);
    }

    const confidence = Math.min(10, Math.round((attempts * 1.2 + masteryScore * 0.5) * 10) / 10);
    const nextStatus = masteryStatus(masteryScore, attempts);

    const mastery = await prisma.userConceptMastery.upsert({
      where: {
        userId_conceptId: { userId, conceptId: concept.id },
      },
      create: {
        userId,
        conceptId: concept.id,
        masteryScore,
        confidence,
        attempts,
        correctCount,
        partialCount,
        incorrectCount,
        status: nextStatus,
        repeatedMistakes,
        lastSeenAt: new Date(),
      },
      update: {
        masteryScore,
        confidence,
        attempts,
        correctCount,
        partialCount,
        incorrectCount,
        status: nextStatus,
        repeatedMistakes,
        lastSeenAt: new Date(),
      },
      include: { concept: true },
    });

    masteries.push(mastery);
  }

  await syncUserTopicCaches(userId);
  return { concepts, masteries };
}

function uniqueNames(list) {
  const map = new Map();
  for (const item of list) {
    const name = String(item || '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (!map.has(key)) map.set(key, name);
  }
  return [...map.values()].slice(0, 16);
}

/**
 * Derive User.weakTopics / strongTopics from mastery rows.
 */
export async function syncUserTopicCaches(userId) {
  const masteries = await prisma.userConceptMastery.findMany({
    where: { userId },
    include: { concept: true },
    orderBy: { masteryScore: 'asc' },
  });

  const weakTopics = masteries
    .filter((m) => m.status === 'weak' || m.status === 'learning')
    .slice(0, 40)
    .map((m) => m.concept.name);

  const strongTopics = masteries
    .filter((m) => m.status === 'strong' || m.status === 'mastered')
    .slice(0, 40)
    .map((m) => m.concept.name);

  await prisma.user.update({
    where: { id: userId },
    data: { weakTopics, strongTopics },
  });

  return { weakTopics, strongTopics };
}

export async function getKnowledgeProfile(userId, { limit = 40 } = {}) {
  return prisma.userConceptMastery.findMany({
    where: { userId },
    include: { concept: true },
    orderBy: [{ masteryScore: 'asc' }, { lastSeenAt: 'desc' }],
    take: limit,
  });
}

export async function listKnowledge({ userId, status, domain } = {}) {
  const where = { userId };
  if (status) where.status = status;

  const masteries = await prisma.userConceptMastery.findMany({
    where,
    include: {
      concept: {
        include: {
          parent: true,
          children: true,
        },
      },
    },
    orderBy: [{ masteryScore: 'asc' }, { updatedAt: 'desc' }],
  });

  let filtered = masteries;
  if (domain) {
    filtered = masteries.filter((m) => m.concept.domain === domain);
  }

  const roots = await prisma.concept.findMany({
    where: { parentId: null },
    include: {
      children: {
        include: { children: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  const masteryByConceptId = new Map(filtered.map((m) => [m.conceptId, m]));

  function attach(node) {
    const mastery = masteryByConceptId.get(node.id) || null;
    return {
      id: node.id,
      slug: node.slug,
      name: node.name,
      domain: node.domain,
      description: node.description,
      mastery: mastery
        ? {
            masteryScore: mastery.masteryScore,
            status: mastery.status,
            attempts: mastery.attempts,
            confidence: mastery.confidence,
            lastSeenAt: mastery.lastSeenAt,
            incorrectCount: mastery.incorrectCount,
            correctCount: mastery.correctCount,
            partialCount: mastery.partialCount,
            repeatedMistakes: mastery.repeatedMistakes,
          }
        : null,
      children: (node.children || []).map(attach),
    };
  }

  return {
    tree: roots.map(attach),
    flat: filtered.map((m) => ({
      conceptId: m.conceptId,
      slug: m.concept.slug,
      name: m.concept.name,
      domain: m.concept.domain,
      parent: m.concept.parent
        ? { slug: m.concept.parent.slug, name: m.concept.parent.name }
        : null,
      masteryScore: m.masteryScore,
      status: m.status,
      attempts: m.attempts,
      confidence: m.confidence,
      lastSeenAt: m.lastSeenAt,
      incorrectCount: m.incorrectCount,
      correctCount: m.correctCount,
      partialCount: m.partialCount,
      repeatedMistakes: m.repeatedMistakes,
    })),
  };
}

export async function getConceptDetail(userId, slug) {
  const concept = await prisma.concept.findUnique({
    where: { slug },
    include: {
      parent: true,
      children: true,
    },
  });
  if (!concept) return null;

  const mastery = await prisma.userConceptMastery.findUnique({
    where: {
      userId_conceptId: { userId, conceptId: concept.id },
    },
  });

  const links = await prisma.questionConcept.findMany({
    where: {
      conceptId: concept.id,
      question: { session: { userId } },
    },
    include: {
      question: {
        select: {
          id: true,
          questionText: true,
          feedback: true,
          conceptExplanation: true,
          technicalScore: true,
          topicTags: true,
          createdAt: true,
          sessionId: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return {
    concept: {
      id: concept.id,
      slug: concept.slug,
      name: concept.name,
      domain: concept.domain,
      description: concept.description,
      parent: concept.parent
        ? { slug: concept.parent.slug, name: concept.parent.name }
        : null,
      children: concept.children.map((c) => ({
        slug: c.slug,
        name: c.name,
        domain: c.domain,
      })),
    },
    mastery,
    attempts: links.map((l) => ({
      status: l.status,
      score: l.score,
      questionId: l.question.id,
      sessionId: l.question.sessionId,
      questionText: l.question.questionText,
      feedback: l.question.feedback,
      conceptExplanation: l.question.conceptExplanation,
      technicalScore: l.question.technicalScore,
      createdAt: l.question.createdAt,
    })),
  };
}

export async function createProgressSnapshot(userId, { accuracy, communication, readiness }) {
  const masteries = await prisma.userConceptMastery.findMany({ where: { userId } });
  const weakCount = masteries.filter((m) => m.status === 'weak' || m.status === 'learning').length;
  const strongCount = masteries.filter((m) => m.status === 'strong' || m.status === 'mastered').length;

  return prisma.progressSnapshot.create({
    data: {
      userId,
      accuracy,
      communication,
      readiness,
      weakCount,
      strongCount,
    },
  });
}
