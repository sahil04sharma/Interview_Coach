import { prisma } from '../db.js';
import {
  getRoleCurriculumForTargetRole,
  isRoleCurriculumEnabled,
  toCurriculumBrief,
} from './roleCurriculumService.js';

const WEAK_STATUSES = new Set(['weak', 'needs_review', 'learning', 'not_started']);
const STRONG_STATUSES = new Set(['strong', 'mastered', 'competent']);

function resumeBudgetMax(practicePack, plannedCount) {
  const n = Math.max(1, plannedCount || 8);
  switch (practicePack) {
    case 'fundamentals':
      return 1;
    case 'weak_topics':
      return 0;
    case 'behavioral_star':
      return 1;
    case 'tricks':
      return Math.max(1, Math.floor(n * 0.15));
    case 'mixed':
    default:
      return Math.max(1, Math.floor(n * 0.25));
  }
}

function flattenCurriculum(curriculum) {
  const rows = [];
  for (const comp of curriculum.competencies || []) {
    for (const link of comp.concepts || []) {
      if (!link.concept) continue;
      rows.push({
        conceptId: link.concept.id,
        conceptSlug: link.concept.slug,
        conceptName: link.concept.name,
        competencySlug: comp.slug,
        competencyName: comp.name,
        importance: Number(comp.importance) || 0.5,
        difficultyBand: link.difficultyBand || 'medium',
        isCore: link.isCore !== false,
      });
    }
  }
  return rows;
}

function countResumeUsed(session, resumeConceptSlugs) {
  const slugs = new Set((resumeConceptSlugs || []).map(String));
  if (!slugs.size) return 0;
  let used = 0;
  for (const q of session.questions || []) {
    if (q.isFollowUp) continue;
    const tags = q.topicTags || [];
    if (tags.some((t) => slugs.has(String(t).toLowerCase()) || slugs.has(String(t)))) {
      used += 1;
    }
  }
  return used;
}

function statusOf(mastery) {
  if (!mastery) return 'not_started';
  return mastery.status || 'not_started';
}

function pickDifficulty(row, mastery, practicePack) {
  if (practicePack === 'tricks') return 'hard';
  if (practicePack === 'fundamentals') {
    return row.difficultyBand === 'hard' ? 'medium' : row.difficultyBand || 'easy';
  }
  const st = statusOf(mastery);
  if (st === 'not_started' || st === 'weak') return row.difficultyBand || 'easy';
  if (st === 'strong' || st === 'mastered') {
    if (row.difficultyBand === 'easy') return 'medium';
    return 'hard';
  }
  return row.difficultyBand || 'medium';
}

/**
 * Deterministic curriculum planner — no LLM.
 * Returns session objectives + budget for Interview Brain / Director.
 */
export async function planCurriculumObjectives({
  userId,
  targetRole,
  session,
  practicePack = null,
  coveredTopics = [],
  resumeClaims = [],
  jdPrioritySlugs = [],
  objectiveCount = 3,
} = {}) {
  if (!isRoleCurriculumEnabled()) return null;

  const curriculum = await getRoleCurriculumForTargetRole(targetRole);
  if (!curriculum) {
    return {
      enabled: true,
      matched: false,
      reason: 'no-role-curriculum',
      objectives: [],
      resumeBudgetRemaining: 0,
      resumeBudgetMax: 0,
      coverageBefore: 0,
      priorityQueue: [],
      roleCurriculumBrief: null,
      progressBrief: null,
    };
  }

  const pack = practicePack || session?.practicePack || 'mixed';
  const planned = session?.plannedCount || 8;
  const covered = new Set(
    (coveredTopics || session?.coveredTopics || []).map((t) => String(t).toLowerCase()),
  );

  const flat = flattenCurriculum(curriculum);
  const conceptIds = flat.map((r) => r.conceptId);
  const masteries = conceptIds.length
    ? await prisma.userConceptMastery.findMany({
        where: { userId, conceptId: { in: conceptIds } },
      })
    : [];
  const masteryById = new Map(masteries.map((m) => [m.conceptId, m]));

  const resumeSlugs = [
    ...new Set(
      (resumeClaims || []).flatMap((c) => c.conceptSlugs || []).map(String),
    ),
  ];
  const budgetMax = resumeBudgetMax(pack, planned);
  const budgetUsed = countResumeUsed(session, resumeSlugs);
  const resumeBudgetRemaining = Math.max(0, budgetMax - budgetUsed);

  const now = new Date();
  const due = [];
  const weak = [];
  const untestedCore = [];
  const stretch = [];

  for (const row of flat) {
    const mastery = masteryById.get(row.conceptId);
    const st = statusOf(mastery);
    const slugLower = row.conceptSlug.toLowerCase();
    if (covered.has(slugLower) && st !== 'weak' && st !== 'needs_review') {
      // still allow stretch/review, but de-prioritize introduce
    }

    if (mastery?.nextReviewAt && mastery.nextReviewAt <= now) {
      due.push({ row, mastery, type: 'review', reason: 'spaced-repetition due' });
      continue;
    }

    if (st === 'weak' || st === 'needs_review' || (mastery && mastery.confidence < 0.35)) {
      weak.push({ row, mastery, type: 'strengthen', reason: `status=${st}` });
      continue;
    }

    if (!mastery || st === 'not_started') {
      if (row.isCore || row.importance >= 0.75) {
        untestedCore.push({
          row,
          mastery,
          type: 'introduce',
          reason: 'untested core concept',
        });
      } else if (pack !== 'fundamentals') {
        untestedCore.push({
          row,
          mastery,
          type: 'introduce',
          reason: 'untested concept',
        });
      }
      continue;
    }

    if (STRONG_STATUSES.has(st)) {
      stretch.push({
        row,
        mastery,
        type: 'stretch',
        reason: 'deepen strong concept',
      });
    }
  }

  // Prerequisite gaps: prerequisite edge where dependent is in curriculum and prereq weak/untested
  const prereqGaps = [];
  const slugSet = new Set(flat.map((r) => r.conceptSlug));
  const bySlug = new Map(flat.map((r) => [r.conceptSlug, r]));
  if (slugSet.size) {
    const edges = await prisma.conceptEdge.findMany({
      where: {
        type: 'prerequisite',
        OR: [{ fromSlug: { in: [...slugSet] } }, { toSlug: { in: [...slugSet] } }],
      },
    });
    // Convention in this codebase: prerequisite edge often from dependent→prereq or prereq→dependent.
    // Treat fromSlug as prerequisite of toSlug when type=prerequisite (common graph convention).
    for (const edge of edges) {
      const prereqSlug = edge.fromSlug;
      const dependentSlug = edge.toSlug;
      if (!slugSet.has(prereqSlug) || !slugSet.has(dependentSlug)) continue;
      const depRow = bySlug.get(dependentSlug);
      const preRow = bySlug.get(prereqSlug);
      if (!depRow || !preRow) continue;
      const depM = masteryById.get(depRow.conceptId);
      const preM = masteryById.get(preRow.conceptId);
      const depTouched =
        depM && statusOf(depM) !== 'not_started' && (depM.attempts || 0) > 0;
      const preWeak = !preM || WEAK_STATUSES.has(statusOf(preM));
      if (depTouched && preWeak) {
        prereqGaps.push({
          row: preRow,
          mastery: preM,
          type: 'probe-prerequisite',
          reason: `prerequisite of ${dependentSlug}`,
        });
      }
    }
  }

  const sortByImportance = (a, b) =>
    b.row.importance - a.row.importance || a.row.conceptSlug.localeCompare(b.row.conceptSlug);

  due.sort(sortByImportance);
  weak.sort(sortByImportance);
  prereqGaps.sort(sortByImportance);
  untestedCore.sort(sortByImportance);
  stretch.sort(sortByImportance);

  let ranked = [];
  if (pack === 'weak_topics') {
    ranked = [...weak, ...due, ...prereqGaps];
  } else if (pack === 'fundamentals') {
    ranked = [...untestedCore, ...weak, ...due, ...prereqGaps];
  } else if (pack === 'behavioral_star') {
    ranked = [...flat]
      .filter((r) => r.competencySlug === 'behavioral' || r.conceptSlug.includes('star'))
      .map((row) => ({
        row,
        mastery: masteryById.get(row.conceptId),
        type: 'introduce',
        reason: 'behavioral pack',
      }));
    if (!ranked.length) ranked = [...untestedCore, ...weak];
  } else if (pack === 'tricks') {
    ranked = [...stretch, ...weak, ...untestedCore];
  } else {
    ranked = [...due, ...weak, ...prereqGaps, ...untestedCore, ...stretch];
  }

  // JD boosts: move matching slugs toward front
  const jdSet = new Set((jdPrioritySlugs || []).map(String));
  if (jdSet.size) {
    ranked.sort((a, b) => {
      const aBoost = jdSet.has(a.row.conceptSlug) ? 1 : 0;
      const bBoost = jdSet.has(b.row.conceptSlug) ? 1 : 0;
      return bBoost - aBoost || sortByImportance(a, b);
    });
  }

  // Dedupe by conceptSlug
  const seen = new Set();
  const unique = [];
  for (const item of ranked) {
    if (seen.has(item.row.conceptSlug)) continue;
    seen.add(item.row.conceptSlug);
    unique.push(item);
  }

  const objectives = [];
  for (const item of unique.slice(0, Math.max(1, objectiveCount))) {
    objectives.push({
      type: item.type,
      conceptSlug: item.row.conceptSlug,
      conceptName: item.row.conceptName,
      competencySlug: item.row.competencySlug,
      difficulty: pickDifficulty(item.row, item.mastery, pack),
      reason: item.reason,
    });
  }

  // Resume verification slots (only if budget and pack allows)
  if (resumeBudgetRemaining > 0 && pack !== 'weak_topics' && resumeClaims?.length) {
    const claim = resumeClaims.find((c) => c.verification !== 'verified') || resumeClaims[0];
    if (claim && objectives.length < objectiveCount + 1) {
      objectives.push({
        type: 'verify-resume',
        conceptSlug: claim.conceptSlugs?.[0] || null,
        conceptName: null,
        competencySlug: null,
        difficulty: session?.difficulty || 'medium',
        reason: 'resume claim verification (within budget)',
        resumeClaimId: claim.id || null,
        resumeClaim: String(claim.claim || '').slice(0, 160),
      });
    }
  }

  const competentPlus = masteries.filter((m) =>
    ['competent', 'strong', 'mastered'].includes(m.status),
  ).length;
  const coverageBefore = flat.length ? competentPlus / flat.length : 0;

  const progressBrief = {
    coveragePct: Math.round(coverageBefore * 1000) / 1000,
    totalConcepts: flat.length,
    tracked: masteries.length,
    weak: weak.slice(0, 8).map((w) => w.row.conceptSlug),
    dueReview: due.slice(0, 8).map((d) => d.row.conceptSlug),
    untestedCore: untestedCore.slice(0, 10).map((u) => u.row.conceptSlug),
  };

  return {
    enabled: true,
    matched: true,
    roleSlug: curriculum.roleSlug,
    objectives,
    resumeBudgetRemaining,
    resumeBudgetMax: budgetMax,
    resumeBudgetUsed: budgetUsed,
    coverageBefore,
    priorityQueue: unique.slice(0, 12).map((u) => u.row.conceptSlug),
    roleCurriculumBrief: toCurriculumBrief(curriculum),
    progressBrief,
  };
}
