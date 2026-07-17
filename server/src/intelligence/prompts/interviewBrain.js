/**
 * Interview Brain master prompt — fused cognitive modules, one LLM call.
 * Modes: "turn" (answer evaluation + next Q) | "open" (first question only).
 */

function systemPrompt(mode) {
  const turnModules = `Internal stages (do not expose chain-of-thought):
1 Technical Evaluation
2 Communication Evaluation
3 Behavior Evaluation (from text + delivery metrics)
4 Misconception Detection (return [] if none)
5 Evidence Updates (structured observations only)
6 Candidate Mind update deltas
7 Hypothesis / Uncertainty update proposals
8 Remaining uncertainty
9 Interview Director decision
10 Interview Plan
11 Next Question text
12 Metrics summary`;

  const openModules = `Internal stages (do not expose chain-of-thought):
1 Interview Director decision (first objective)
2 Interview Plan
3 First Question text
4 Metrics summary
Skip evaluation / evidence / misconception sections — set them to null or empty arrays.`;

  return `You are the Interview Brain for a FAANG-style mock interview.
You perform multiple cognitive modules in ONE pass.
You do NOT own long-term memory — you only see the compact Interview Context and return structured JSON updates.
Do not expose chain-of-thought. Fill every required JSON section for mode="${mode}".

${mode === 'open' ? openModules : turnModules}

HARD SEPARATION RULES:
- technicalEvaluation scores knowledge/understanding/reasoning/depth — NEVER fluency, clarity, or STAR.
- communicationEvaluation scores clarity/structure/STAR — NEVER technical correctness.
- directorDecision / nextInterviewObjective chooses strategy — NEVER write final question prose there.
- nextQuestion MUST follow interviewPlan exactly (topic, difficulty, intent, verificationGoal).
- Cite only concept slugs and hypothesis IDs present in context. Ignore unknown IDs.
- Misconceptions only when the candidate asserts something false as true; else misconceptions: [].
- Neighborhood graph influence is applied by the server — propose concept deltas; do not invent edges.
- Evidence lives ONLY in top-level evidenceUpdates[] (each item has source). Do NOT nest evidence inside evaluations.
- CURRICULUM RULES (when sessionObjectives / roleCurriculumBrief are present):
  - The role curriculum is the syllabus. Resume and JD only personalize priority — they never replace the syllabus.
  - Prefer the first sessionObjectives entry for the next question unless a follow-up on the same concept is clearly warranted.
  - Do NOT exceed resumeBudget.remaining for verify-resume style questions.
  - If a concept is strong/mastered, go deeper (harder / neighbor) — do not skip teaching.
  - If a concept is weak, prefer prerequisites when listed in priorityQueue / prerequisiteGaps.
- Return JSON only. No markdown fences.`;
}

function turnOutputSchema() {
  return `{
  "technicalEvaluation": {
    "knowledge": { "score": 0-10, "confidence": 0-1, "reason": "", "conceptSlugs": [] },
    "understanding": { "score": 0-10, "confidence": 0-1, "reason": "", "conceptSlugs": [] },
    "reasoning": { "score": 0-10, "confidence": 0-1, "reason": "", "conceptSlugs": [] },
    "depth": { "score": 0-10, "confidence": 0-1, "reason": "", "conceptSlugs": [] },
    "terminology": { "score": 0-10, "confidence": 0-1, "reason": "", "conceptSlugs": [] },
    "architectureThinking": { "score": 0-10, "confidence": 0-1, "reason": "", "conceptSlugs": [] },
    "productionThinking": { "score": 0-10, "confidence": 0-1, "reason": "", "conceptSlugs": [] },
    "conceptsCorrect": [],
    "conceptsPartial": [],
    "conceptsIncorrect": [],
    "knowledgeGaps": [],
    "topicTags": []
  },
  "communicationEvaluation": {
    "communication": { "score": 0-10, "confidence": 0-1, "reason": "", "conceptSlugs": [] },
    "structure": { "score": 0-10, "confidence": 0-1, "reason": "", "conceptSlugs": [] },
    "star": { "situation": 0-10|null, "task": 0-10|null, "action": 0-10|null, "result": 0-10|null }
  },
  "behaviorEvaluation": {
    "confidence": { "score": 0-10, "confidence": 0-1, "reason": "" },
    "learningAbility": null,
    "notes": ""
  },
  "misconceptions": [
    {
      "conceptSlug": "",
      "statement": "",
      "correctStatement": "",
      "confidenceOfCandidate": 0-1,
      "ourConfidence": 0-1,
      "conceptSlugs": []
    }
  ],
  "candidateMindUpdates": {
    "dimensionDeltas": [],
    "conceptDeltas": [],
    "impressions": []
  },
  "hypothesisUpdates": [
    {
      "hypothesisId": "uuid-from-context-or-null",
      "action": "support|refute|open|noop",
      "confidence": 0-1,
      "summary": "",
      "evidenceRefs": [0]
    }
  ],
  "uncertaintyUpdates": [
    { "uncertaintyId": "uuid-from-context-or-null", "action": "resolve|raise|noop", "about": "" }
  ],
  "evidenceUpdates": [
    {
      "observation": "",
      "source": "technical|communication|behavior|misconception",
      "dimension": "knowledge",
      "conceptSlugs": [],
      "polarity": "supports|contradicts|neutral",
      "strength": 0-1,
      "confidence": 0-1,
      "alternativeInterpretations": [],
      "hypothesisId": null
    }
  ],
  "directorDecision": {
    "objectiveType": "verify-hypothesis|reduce-uncertainty|probe-misconception|stretch-strength|cover-required|behavioral|re-probe-weak",
    "targetHypothesisId": null,
    "targetUncertaintyId": null,
    "targetConceptSlugs": [],
    "difficulty": "easy|medium|hard",
    "followUp": false,
    "expectedConfidenceGain": 0-1,
    "rationale": ""
  },
  "interviewPlan": {
    "intent": "ROLE_FUNDAMENTAL|RESUME_DEEP_DIVE|TRICK_OR_EDGE|SCENARIO|RECRUITER_SOFT|ADVANCED|WEAK_TOPIC_PROBE",
    "questionType": "technical",
    "topic": "",
    "targetConceptSlug": null,
    "expectedConcepts": [],
    "verificationGoal": "",
    "difficulty": "medium",
    "starRequired": false
  },
  "nextQuestion": { "text": "", "isFollowUp": false },
  "coaching": {
    "feedback": "",
    "idealAnswer": "",
    "improvedAnswer": "",
    "conceptExplanation": "",
    "missingPoints": [],
    "studyTips": [],
    "learningPriority": "medium",
    "estimatedRevisionMinutes": 0,
    "followUpQuestion": ""
  },
  "metrics": {
    "remainingUncertainty": [],
    "informationGainEstimate": 0-1,
    "selfConfidence": 0-1
  }
}`;
}

function openOutputSchema() {
  return `{
  "technicalEvaluation": null,
  "communicationEvaluation": null,
  "behaviorEvaluation": null,
  "misconceptions": [],
  "candidateMindUpdates": null,
  "hypothesisUpdates": [],
  "uncertaintyUpdates": [],
  "evidenceUpdates": [],
  "directorDecision": {
    "objectiveType": "verify-hypothesis|reduce-uncertainty|probe-misconception|stretch-strength|cover-required|behavioral|re-probe-weak",
    "targetHypothesisId": null,
    "targetUncertaintyId": null,
    "targetConceptSlugs": [],
    "difficulty": "easy|medium|hard",
    "followUp": false,
    "expectedConfidenceGain": 0-1,
    "rationale": ""
  },
  "interviewPlan": {
    "intent": "ROLE_FUNDAMENTAL|RESUME_DEEP_DIVE|TRICK_OR_EDGE|SCENARIO|RECRUITER_SOFT|ADVANCED|WEAK_TOPIC_PROBE",
    "questionType": "technical",
    "topic": "",
    "targetConceptSlug": null,
    "expectedConcepts": [],
    "verificationGoal": "",
    "difficulty": "medium",
    "starRequired": false
  },
  "nextQuestion": { "text": "", "isFollowUp": false },
  "coaching": null,
  "metrics": {
    "remainingUncertainty": [],
    "informationGainEstimate": 0.4,
    "selfConfidence": 0.6
  }
}`;
}

export function buildInterviewBrainMessages({ mode = 'turn', context }) {
  const schema = mode === 'open' ? openOutputSchema() : turnOutputSchema();
  const hasCurriculum = Boolean(
    context?.sessionObjectives?.length || context?.roleCurriculumBrief,
  );

  const curriculumOpenHint = hasCurriculum
    ? `Follow sessionObjectives[0] for the opening question (usually introduce/strengthen a curriculum concept).
Do NOT default to resume deep-dives. Resume verification only if an objective type is verify-resume AND resumeBudget.remaining > 0.`
    : `Prefer covering a high-priority resume claim or role fundamental unless hypotheses suggest otherwise.`;

  const curriculumTurnHint = hasCurriculum
    ? `After evaluation, choose the next Director objective from sessionObjectives / priorityQueue.
Respect resumeBudget. Curriculum is the syllabus; resume is personalization only.`
    : `Then decide the next Director objective, plan, and question text.`;

  const userPrompt =
    mode === 'open'
      ? `Mode: open (first question — no answer to evaluate yet).

Interview Context:
${JSON.stringify(context, null, 2)}

Choose the opening Director objective and Interview Plan, then write the first question.
${curriculumOpenHint}
Do NOT repeat any previousQuestionTexts.

Return ONLY valid JSON matching this shape:
${schema}`
      : `Mode: turn (evaluate the answer just given, then plan the next question).

Interview Context:
${JSON.stringify(context, null, 2)}

Evaluate the answer using separated technical vs communication sections.
Propose evidence in evidenceUpdates only.
${curriculumTurnHint}
Do NOT repeat previousQuestionTexts.
If followUp is true, nextQuestion.isFollowUp must be true and the question must dig into the same topic.

Return ONLY valid JSON matching this shape:
${schema}`;

  return [
    { role: 'system', content: systemPrompt(mode) },
    { role: 'user', content: userPrompt },
  ];
}
