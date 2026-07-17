import { prisma } from '../db.js';

function dedupeByText(list, key) {
  const seen = new Set();
  return list.filter((item) => {
    const value = String(item[key] || '').trim().toLowerCase();
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

export async function seedResumeIntelligence({
  sessionId,
  analysis,
}) {
  const claims = dedupeByText(analysis?.claims || [], 'claim');
  const hypotheses = dedupeByText(analysis?.seedHypotheses || [], 'statement');
  const uncertainties = dedupeByText(analysis?.seedUncertainties || [], 'about');

  if (claims.length) {
    await prisma.resumeClaim.createMany({
      data: claims.map((item) => ({
        sessionId,
        claim: item.claim,
        conceptSlugs: item.conceptSlugs || [],
        importance: item.importance || 'medium',
      })),
      skipDuplicates: false,
    });
  }

  if (hypotheses.length) {
    await prisma.hypothesis.createMany({
      data: hypotheses.map((item) => ({
        sessionId,
        statement: item.statement,
        conceptSlugs: item.conceptSlugs || [],
        origin: 'resume-analyst',
        status: 'open',
        confidence: 0.5,
        priority: item.priority ?? 0.5,
        createdTurn: 0,
      })),
      skipDuplicates: false,
    });
  }

  if (uncertainties.length) {
    await prisma.uncertainty.createMany({
      data: uncertainties.map((item) => ({
        sessionId,
        about: item.about,
        conceptSlugs: item.conceptSlugs || [],
        priority: item.priority ?? 0.5,
        status: 'open',
      })),
      skipDuplicates: false,
    });
  }

  return {
    claimCount: claims.length,
    hypothesisCount: hypotheses.length,
    uncertaintyCount: uncertainties.length,
  };
}

export async function reconcileHypothesesFromEvidence({
  sessionId,
  evidenceIds = [],
  technical,
  turn,
}) {
  if (!technical) {
    return { updatedHypotheses: 0, resolvedUncertainties: 0 };
  }

  const relatedConcepts = [
    ...(technical.conceptsIncorrect || []),
    ...(technical.conceptsPartial || []),
    ...(technical.conceptsCorrect || []),
  ];

  if (!relatedConcepts.length) {
    return { updatedHypotheses: 0, resolvedUncertainties: 0 };
  }

  const hypotheses = await prisma.hypothesis.findMany({
    where: { sessionId, status: 'open' },
  });

  let updatedHypotheses = 0;
  for (const hypothesis of hypotheses) {
    const intersects = (hypothesis.conceptSlugs || []).some((slug) =>
      relatedConcepts.includes(slug),
    );
    if (!intersects) continue;

    const negativeSignal =
      (technical.conceptsIncorrect || []).some((slug) => hypothesis.conceptSlugs.includes(slug)) ||
      (technical.conceptsPartial || []).some((slug) => hypothesis.conceptSlugs.includes(slug));

    const confidence = negativeSignal
      ? Math.max(0.15, Number(hypothesis.confidence || 0.5) * 0.5)
      : Math.min(0.85, Number(hypothesis.confidence || 0.5) + 0.15);

    const status = negativeSignal
      ? confidence <= 0.3
        ? 'refuted'
        : 'open'
      : confidence >= 0.75
        ? 'supported'
        : 'open';

    await prisma.hypothesis.update({
      where: { id: hypothesis.id },
      data: {
        confidence,
        status,
        lastTestedTurn: turn ?? hypothesis.lastTestedTurn,
      },
    });
    updatedHypotheses += 1;
  }

  const uncertainties = await prisma.uncertainty.findMany({
    where: { sessionId, status: 'open' },
  });

  let resolvedUncertainties = 0;
  for (const uncertainty of uncertainties) {
    const intersects = (uncertainty.conceptSlugs || []).some((slug) =>
      relatedConcepts.includes(slug),
    );
    if (!intersects) continue;

    await prisma.uncertainty.update({
      where: { id: uncertainty.id },
      data: { status: 'resolved' },
    });
    resolvedUncertainties += 1;
  }

  return { updatedHypotheses, resolvedUncertainties };
}

export async function persistMisconceptions({ sessionId, misconceptions = [] }) {
  if (!misconceptions.length) return [];
  const ids = [];
  for (const item of misconceptions) {
    const row = await prisma.misconception.create({
      data: {
        sessionId,
        conceptSlug: item.conceptSlug,
        statement: item.statement,
        correctStatement: item.correctStatement || '',
        candidateConfidence: item.candidateConfidence ?? 0.5,
        ourConfidence: item.ourConfidence ?? 0.5,
        status: 'suspected',
      },
    });
    ids.push(row.id);
  }
  return ids;
}
