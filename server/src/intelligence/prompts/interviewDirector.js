export function buildInterviewDirectorMessages({
  companyName,
  styleNotes,
  mode,
  difficulty,
  practicePack,
  interviewLanguage,
  targetRole,
  memory,
  intelligenceContext,
  lastEvaluation,
  questionIndex,
  companyProfile,
}) {
  const ctx = intelligenceContext || {};
  const framing =
    String(companyName || '').toLowerCase() === 'general'
      ? 'You are the Interview Director for a practice interview.'
      : `You are the Interview Director for a ${companyName} interview.`;

  const lastBlock = lastEvaluation
    ? `Last answer scores: technical=${lastEvaluation.technicalScore}, communication=${lastEvaluation.communicationScore}, depth=${lastEvaluation.depthScore}, structure=${lastEvaluation.structureScore}
Topics: ${(lastEvaluation.topicTags || []).join(', ') || '(none)'}
Missing: ${(lastEvaluation.missingPoints || []).slice(0, 5).join('; ') || '(none)'}
Incorrect concepts: ${(lastEvaluation.conceptsIncorrect || []).join(', ') || '(none)'}`
    : '(first question — no prior answer)';

  const userPrompt = `${framing}

${styleNotes ? `Style notes:\n${styleNotes}\n` : ''}
Target role: ${targetRole || 'software engineer'}
Mode: ${mode}
Difficulty: ${difficulty}
Practice pack: ${practicePack || 'mixed'}
Question index (0-based): ${questionIndex}
Interview language: ${interviewLanguage}

Company weights:
${companyProfile ? JSON.stringify(companyProfile, null, 2) : '(default)'}

Interview memory:
${JSON.stringify(
  {
    difficulty: memory?.difficulty,
    followUpBudget: memory?.followUpBudget,
    weakTopics: memory?.weakTopics,
    strongTopics: memory?.strongTopics,
    topicsCovered: memory?.topicsCovered,
  },
  null,
  2,
)}

Cognitive model dimensions (scores):
${JSON.stringify(ctx.cognitiveModel?.dimensions || {}, null, 2)}

Open hypotheses:
${JSON.stringify(ctx.hypotheses || [], null, 2)}

Open uncertainties:
${JSON.stringify(ctx.uncertainties || [], null, 2)}

Resume claims:
${JSON.stringify(ctx.resumeClaims || [], null, 2)}

Suspected misconceptions:
${JSON.stringify(ctx.misconceptions || [], null, 2)}

Concept beliefs (session):
${JSON.stringify(ctx.conceptBeliefs || [], null, 2)}

Prerequisite gaps (probe prerequisites before deepening dependents — inferred, unverified):
${JSON.stringify(ctx.prerequisiteGaps || [], null, 2)}

Covered topics: ${(ctx.coveredTopics || []).join(', ') || '(none)'}

Session objectives from curriculum planner (prefer these; resume is capped):
${JSON.stringify(ctx.sessionObjectives || [], null, 2)}

Progress brief:
${JSON.stringify(ctx.progressBrief || null, null, 2)}

Resume budget: ${JSON.stringify(ctx.resumeBudget || null)}

Priority queue: ${(ctx.priorityQueue || []).join(', ') || '(none)'}

${lastBlock}

STRICT RULES:
- You are the strategist ONLY. Do NOT write question text.
- Choose the SINGLE most valuable objective for the next question.
- When sessionObjectives exist, prefer the first unused curriculum objective over resume deep-dives.
- Resume verification only when resumeBudget.remaining > 0 and it is high information value.
- Maximize information gain: verify hypotheses, reduce uncertainty, probe misconceptions, or cover required mode areas.
- Respect followUpBudget (${memory?.followUpBudget ?? 0}). Only set followUp=true when a targeted drill-down is worth it.
- Avoid repeating covered topics narrowly unless verifying a claim.
- When prerequisiteGaps exist, prefer probing the prerequisite concept before deepening the dependent topic.
- Treat neighborhoodInfluence adjustments as unverified guesses — verify with a direct question.
- Output BOTH an objective AND a concrete question plan in one JSON object.

Respond ONLY as JSON:
{
  "objective": {
    "objectiveType": "verify-hypothesis|reduce-uncertainty|probe-misconception|stretch-strength|cover-required|behavioral|re-probe-weak",
    "targetHypothesisId": "uuid or null",
    "targetUncertaintyId": "uuid or null",
    "targetConceptSlugs": ["slug"],
    "difficulty": "easy|medium|hard",
    "followUp": false,
    "expectedConfidenceGain": 0.4,
    "rationale": "one sentence why this is the best next move"
  },
  "plan": {
    "intent": "ROLE_FUNDAMENTAL|RESUME_DEEP_DIVE|TRICK_OR_EDGE|SCENARIO|RECRUITER_SOFT|ADVANCED|WEAK_TOPIC_PROBE",
    "questionType": "technical|behavioral|system-design|database|architecture|...",
    "topic": "short topic label",
    "targetConceptSlug": "slug or null",
    "expectedConcepts": ["concept"],
    "verificationGoal": "what this question should prove or disprove",
    "difficulty": "easy|medium|hard",
    "starRequired": false
  }
}`;

  return [{ role: 'user', content: userPrompt }];
}
