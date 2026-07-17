/**
 * Interview Memory — adaptive state carried across questions in a session.
 */

function clamp(n, min = 0, max = 10) {
  const v = Number(n);
  if (Number.isNaN(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function avg(nums) {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function unique(list) {
  return [...new Set((list || []).map((t) => String(t).trim()).filter(Boolean))];
}

export function emptyMemory({ difficulty = 'medium' } = {}) {
  return {
    difficulty,
    confidenceLevel: 5,
    topicsCovered: [],
    weakTopics: [],
    strongTopics: [],
    repeatedMistakes: [],
    communicationQuality: 5,
    depthQuality: 5,
    resumeClaimsVerified: [],
    questionsAsked: [],
    lastScores: null,
    questionTypesUsed: [],
    followUpBudget: 2,
    followUpsUsed: 0,
    knowledgeGaps: [],
    conceptsIncorrect: [],
    conceptsPartial: [],
  };
}

export function readMemory(session) {
  if (session?.memory && typeof session.memory === 'object') {
    return { ...emptyMemory({ difficulty: session.difficulty }), ...session.memory };
  }
  return emptyMemory({ difficulty: session?.difficulty || 'medium' });
}

/**
 * Merge one answered question + evaluation into session memory.
 */
export function updateMemoryAfterAnswer(memory, { questionText, evaluation, isFollowUp }) {
  const next = {
    ...emptyMemory(),
    ...memory,
  };

  const technical = clamp(evaluation.technicalScore ?? evaluation.accuracyScore);
  const communication = clamp(evaluation.communicationScore);
  const depth = clamp(evaluation.depthScore);
  const structure = clamp(evaluation.structureScore);
  const confidence = clamp(evaluation.confidenceScore ?? avg([technical, depth]));

  next.questionsAsked = unique([...next.questionsAsked, questionText]);
  next.topicsCovered = unique([
    ...next.topicsCovered,
    ...(evaluation.topicTags || []),
  ]);
  next.questionTypesUsed = unique([
    ...next.questionTypesUsed,
    evaluation.questionType || 'technical',
  ]);
  next.lastScores = {
    technical,
    communication,
    depth,
    structure,
    confidence,
    accuracy: clamp(evaluation.accuracyScore ?? technical),
  };

  const topicScore = technical;
  if (topicScore < 6) {
    next.weakTopics = unique([...next.weakTopics, ...(evaluation.topicTags || [])]);
  }
  if (topicScore >= 8) {
    next.strongTopics = unique([...next.strongTopics, ...(evaluation.topicTags || [])]);
  }

  next.knowledgeGaps = unique([
    ...next.knowledgeGaps,
    ...(evaluation.knowledgeGaps || []),
    ...(evaluation.missingPoints || []),
  ]);
  next.conceptsIncorrect = unique([
    ...next.conceptsIncorrect,
    ...(evaluation.conceptsIncorrect || []),
  ]);
  next.conceptsPartial = unique([
    ...next.conceptsPartial,
    ...(evaluation.conceptsPartial || []),
  ]);

  const mistakeHints = [
    ...(evaluation.missingPoints || []),
    ...(evaluation.knowledgeGaps || []),
    ...(evaluation.conceptsIncorrect || []),
  ]
    .map(String)
    .filter(Boolean);

  for (const hint of mistakeHints) {
    const already = next.repeatedMistakes.find(
      (m) => m.toLowerCase() === hint.toLowerCase(),
    );
    if (already) {
      // keep as repeated signal — list already has it
    } else if (
      memory.knowledgeGaps?.some((g) => g.toLowerCase() === hint.toLowerCase()) ||
      memory.conceptsIncorrect?.some((g) => g.toLowerCase() === hint.toLowerCase())
    ) {
      next.repeatedMistakes = unique([...next.repeatedMistakes, hint]);
    }
  }

  // Running quality averages (EMA toward latest)
  next.communicationQuality = Math.round((next.communicationQuality * 0.6 + communication * 0.4) * 10) / 10;
  next.depthQuality = Math.round((next.depthQuality * 0.6 + depth * 0.4) * 10) / 10;
  next.confidenceLevel = Math.round((next.confidenceLevel * 0.55 + confidence * 0.45) * 10) / 10;

  if (isFollowUp) {
    next.followUpsUsed = (next.followUpsUsed || 0) + 1;
    next.followUpBudget = Math.max(0, (next.followUpBudget ?? 2) - 1);
  }

  // Difficulty adaptation signal
  const answerAvg = avg([technical, depth, structure]);
  if (answerAvg >= 8 && next.difficulty !== 'hard') {
    next.difficulty = next.difficulty === 'easy' ? 'medium' : 'hard';
  } else if (answerAvg < 4.5 && next.difficulty !== 'easy') {
    next.difficulty = next.difficulty === 'hard' ? 'medium' : 'easy';
  }

  return next;
}

/**
 * Compact profile of cross-session mastery for prompts.
 */
export function formatKnowledgeProfile(masteries = []) {
  if (!masteries.length) {
    return {
      weakConcepts: [],
      strongConcepts: [],
      learningConcepts: [],
      summary: '(no prior concept mastery yet)',
    };
  }

  const weak = masteries.filter((m) => m.status === 'weak' || m.status === 'learning').slice(0, 12);
  const strong = masteries.filter((m) => m.status === 'strong' || m.status === 'mastered').slice(0, 8);
  const frequentlyFailed = [...masteries]
    .sort((a, b) => (b.incorrectCount || 0) - (a.incorrectCount || 0))
    .filter((m) => (m.incorrectCount || 0) > 0)
    .slice(0, 8);

  return {
    weakConcepts: weak.map((m) => m.concept?.name || m.concept?.slug).filter(Boolean),
    strongConcepts: strong.map((m) => m.concept?.name || m.concept?.slug).filter(Boolean),
    learningConcepts: masteries
      .filter((m) => m.status === 'learning')
      .slice(0, 8)
      .map((m) => m.concept?.name || m.concept?.slug)
      .filter(Boolean),
    frequentlyFailed: frequentlyFailed.map((m) => ({
      name: m.concept?.name || m.concept?.slug,
      incorrectCount: m.incorrectCount,
      masteryScore: m.masteryScore,
    })),
    summary: [
      weak.length
        ? `Weak/learning: ${weak.map((m) => m.concept?.name).filter(Boolean).join(', ')}`
        : null,
      strong.length
        ? `Strong: ${strong.map((m) => m.concept?.name).filter(Boolean).join(', ')}`
        : null,
      frequentlyFailed.length
        ? `Often failed: ${frequentlyFailed.map((m) => m.concept?.name).filter(Boolean).join(', ')}`
        : null,
    ]
      .filter(Boolean)
      .join('\n') || '(sparse mastery data)',
  };
}

export function memoryPromptBlock(memory) {
  if (!memory) return '';
  return `INTERVIEW MEMORY (maintain continuity — do NOT ask isolated questions):
- Current adaptive difficulty: ${memory.difficulty}
- Confidence level (0-10): ${memory.confidenceLevel}
- Communication quality: ${memory.communicationQuality}
- Depth quality: ${memory.depthQuality}
- Topics covered: ${(memory.topicsCovered || []).join(', ') || '(none)'}
- Session weak topics: ${(memory.weakTopics || []).join(', ') || '(none)'}
- Session strong topics: ${(memory.strongTopics || []).join(', ') || '(none)'}
- Repeated mistakes this session: ${(memory.repeatedMistakes || []).join('; ') || '(none)'}
- Knowledge gaps: ${(memory.knowledgeGaps || []).slice(0, 10).join('; ') || '(none)'}
- Incorrect concepts: ${(memory.conceptsIncorrect || []).join(', ') || '(none)'}
- Partial concepts: ${(memory.conceptsPartial || []).join(', ') || '(none)'}
- Question types used: ${(memory.questionTypesUsed || []).join(', ') || '(none)'}
- Resume claims verified: ${(memory.resumeClaimsVerified || []).join(', ') || '(none yet)'}
- Follow-up budget remaining: ${memory.followUpBudget ?? 0}
- Last scores: ${memory.lastScores ? JSON.stringify(memory.lastScores) : '(none)'}

Memory rules:
- Probe weak topics and incorrect/partial concepts before repeating strong ground.
- Prefer intelligent follow-ups when answers were shallow or missing specifics.
- Verify at least one unverified resume claim when relevant to mode.
- Detect patterns across prior answers in this session, not just the last one.`;
}
