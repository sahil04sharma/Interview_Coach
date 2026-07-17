function isGeneralStyle(companyName) {
  return String(companyName || '').toLowerCase() === 'general';
}

export function languageGuide(interviewLanguage = 'english') {
  const lang = String(interviewLanguage || 'english').toLowerCase();
  if (lang === 'hindi') {
    return {
      code: 'hindi',
      whisper: 'hi',
      tts: 'hi-IN',
      ask: `INTERVIEW LANGUAGE: Hindi (Devanagari script preferred in text).
- Ask questions in natural Hindi, the way an Indian recruiter/hiring manager would speak in a real interview.
- Technical terms can stay in common English (React, API, database) when that is how recruiters usually say them, but the sentence framing should be Hindi.
- Sound human and conversational, not textbook-translated.`,
      evaluate: `CANDIDATE MAY ANSWER IN HINDI OR HINGLISH.
- Understand meaning even if grammar is mixed.
- Write feedback, idealAnswer, improvedAnswer, and conceptExplanation primarily in Hindi (technical terms may stay in English).
- conceptExplanation must teach with a clear example so a confused candidate can understand.
- Do not penalize for Hindi/Hinglish delivery — judge understanding and clarity.`,
      verdict: 'Write reasoning in Hindi (or clear Hinglish if needed). Judge substance, not English fluency.',
    };
  }
  if (lang === 'hinglish') {
    return {
      code: 'hinglish',
      whisper: 'en',
      tts: 'en-IN',
      ask: `INTERVIEW LANGUAGE: Hinglish (natural Indian recruiter style).
- Ask in Hinglish: mostly easy English mixed with natural Hindi phrases, exactly how many Indian recruiters talk (e.g. "Aapne is project mein state management kaise handle kiya?" or "Explain karo — ek page slow ho raha hai, aap kaise debug karoge?").
- Keep it conversational and warm-professional, not pure formal English and not pure literary Hindi.
- Technical words in English are normal and expected.`,
      evaluate: `CANDIDATE MAY ANSWER IN HINGLISH, HINDI, OR ENGLISH.
- Understand code-switching naturally.
- Write feedback / idealAnswer / improvedAnswer / conceptExplanation in Hinglish (same recruiter tone).
- conceptExplanation must teach with a clear example so a confused candidate can understand.
- Do not punish for mixing Hindi-English — real Indian interviews often sound like this. Judge clarity of thought and correctness.`,
      verdict: 'Write reasoning in Hinglish. Focus on substance and communication clarity, not accent or language purity.',
    };
  }
  return {
    code: 'english',
    whisper: 'en',
    tts: 'en-US',
    ask: `INTERVIEW LANGUAGE: English.
- Ask in clear, natural spoken English like a real interviewer.`,
    evaluate: `Evaluate in English. Candidate answers may still include light Hinglish — understand meaning fairly.
Write conceptExplanation as a clear teaching explanation with a concrete example so a beginner can understand the topic.`,
    verdict: 'Write reasoning in English.',
  };
}

export function buildRoleCurriculumMessages({ targetRole, mode, jdText, resumeText }) {
  const role = targetRole?.trim() || 'software engineer';
  const userPrompt = `You are building a realistic interview topic map for a "${role}" candidate.
Interview mode: ${mode}

Use widely known real interview expectations for this role (what recruiters and engineers actually ask in 2024-2026), not only what appears on one resume.
${jdText ? `Also consider this job description:\n${jdText}\n` : ''}
${resumeText ? `Candidate resume (for context only — do NOT limit topics to resume only):\n${resumeText.slice(0, 2500)}\n` : ''}

Return ONLY JSON:
{
  "role": "${role}",
  "coreTopics": ["8-14 must-know fundamentals for this role"],
  "advancedTopics": ["6-10 deeper / senior topics"],
  "trickTopics": ["5-8 common trick, edge-case, or gotcha topics interviewers use"],
  "recruiterTopics": ["4-6 realistic recruiter / hiring-manager questions: motivation, ownership, conflict, learning, collaboration"],
  "exampleAngles": ["6-10 short example question angles spanning variety — concepts, debugging, tradeoffs, scenario-based, trick"]
}

Be specific to "${role}". Example: for frontend include browser rendering, JS event loop, React/state, CSS layout, accessibility, performance, networking, security XSS/CSRF, testing, etc. For backend include APIs, DB, caching, concurrency, auth, etc.
Do not invent company-secret questions; use widely taught interview topics.`;

  return [{ role: 'user', content: userPrompt }];
}

export function buildInterviewerMessages({
  companyName,
  styleNotes,
  resumeText,
  targetRole,
  jdText,
  weakTopics,
  strongTopics,
  previousQuestions,
  mode,
  jdContext,
  roleCurriculum,
  questionIndex = 0,
  difficulty = 'medium',
  practicePack = null,
  interviewLanguage = 'english',
  forcedFollowUp = null,
  lastEvaluation = null,
  coveredTopics = [],
  focusWeakTopics = null,
  memory = null,
  knowledgeProfile = null,
  companyProfile = null,
}) {
  if (forcedFollowUp) {
    return [
      {
        role: 'user',
        content: `Output ONLY this follow-up question text, nothing else:\n${forcedFollowUp}`,
      },
    ];
  }

  const lang = languageGuide(interviewLanguage);

  const previous =
    previousQuestions?.length > 0
      ? previousQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')
      : '(none yet)';

  const jdBlock = jdText ? `Job description for this role:\n${jdText}` : '';
  const jdExtractBlock = jdContext
    ? `JD extraction (skills/seniority):\n${JSON.stringify(jdContext)}`
    : '';
  const curriculumBlock = roleCurriculum
    ? `Role interview curriculum (wide topic coverage for this role — use this heavily):\n${JSON.stringify(roleCurriculum, null, 2)}`
    : '';
  const roleLine = targetRole?.trim()
    ? `Target role: ${targetRole.trim()}`
    : 'Target role: (not set — assume a general software role)';

  const framing = isGeneralStyle(companyName)
    ? `You are a real interviewer running a ${mode} interview to prepare the candidate for the target role. Act like an experienced recruiter + technical interviewer, not a resume quiz bot.`
    : `You are a real ${companyName} interviewer running a ${mode} interview. Act like an experienced recruiter + technical interviewer, not a resume quiz bot.`;

  const styleHeader = isGeneralStyle(companyName)
    ? `Practice style notes:\n${styleNotes}`
    : `Interview style notes for ${companyName}:\n${styleNotes}`;

  const difficultyGuide = {
    easy: 'Keep questions accessible: fundamentals, clear prompts, lighter follow-up pressure.',
    medium: 'Balanced difficulty: real interview depth with some edge cases.',
    hard: 'Bar-raiser difficulty: deeper tradeoffs, ambiguity, and pressure like a tough onsite.',
  };

  const packGuide = {
    behavioral_star: 'Focus on behavioral storytelling. Push for Situation, Task, Action, Result with concrete outcomes.',
    fundamentals: 'Focus on role fundamentals and core concepts from the curriculum.',
    tricks: 'Bias toward trick questions, misconceptions, and edge cases.',
    weak_topics: 'Focus ONLY on the candidate weak topics listed below. Probe gaps with practical, interview-realistic questions.',
    mixed: 'Mix fundamentals, scenarios, tricks, resume probes, and recruiter questions.',
  };

  const intents = [
    'ROLE_FUNDAMENTAL — ask a core topic from the curriculum that any strong candidate for this role should know, even if it is not on the resume',
    'RESUME_DEEP_DIVE — ask about something specific from their resume experience',
    'TRICK_OR_EDGE — ask a realistic trick, edge-case, misconception, or “what happens if…” question from trickTopics',
    'SCENARIO — give a short practical scenario / debugging / tradeoff question a real interviewer would use',
    'RECRUITER_SOFT — ask a realistic hiring-manager/recruiter question about ownership, learning, conflict, or collaboration',
    'ADVANCED — ask a deeper/advanced curriculum topic to stretch them',
  ];
  let intent = intents[questionIndex % intents.length];
  if (practicePack === 'behavioral_star') intent = 'RECRUITER_SOFT / BEHAVIORAL STAR — require a real story with impact';
  if (practicePack === 'fundamentals') intent = 'ROLE_FUNDAMENTAL';
  if (practicePack === 'tricks') intent = 'TRICK_OR_EDGE';
  if (practicePack === 'weak_topics') {
    intent =
      'WEAK_TOPIC_PROBE — ask about one of the focus weak topics below; go practical and interview-realistic, not textbook trivia';
  }

  let adaptiveBlock = '';
  if (lastEvaluation) {
    const avg =
      (Number(lastEvaluation.technicalScore || 0) +
        Number(lastEvaluation.communicationScore || 0) +
        Number(lastEvaluation.depthScore || 0) +
        Number(lastEvaluation.structureScore || 0)) /
      4;
    adaptiveBlock = `Last answer performance (adapt like a real interviewer):
- Scores: technical=${lastEvaluation.technicalScore}, communication=${lastEvaluation.communicationScore}, depth=${lastEvaluation.depthScore}, structure=${lastEvaluation.structureScore} (avg ~${avg.toFixed(1)})
- Topics just covered: ${(lastEvaluation.topicTags || []).join(', ') || '(none)'}
- Missing points: ${(lastEvaluation.missingPoints || []).join('; ') || '(none)'}
- Concepts incorrect/partial: ${[...(lastEvaluation.conceptsIncorrect || []), ...(lastEvaluation.conceptsPartial || [])].join(', ') || '(none)'}
- Prior feedback summary: ${lastEvaluation.feedback || '(none)'}
Adaptive rules:
- If avg < 5: either gently re-probe the SAME weak topic with a simpler angle, OR switch to a closely related fundamental they need.
- If avg is 5-7.5: go one step deeper on a related gap (missing points), not a brand-new unrelated topic.
- If avg > 7.5: stretch them with a harder adjacent topic; do not repeat the same easy ground.`;
  }

  const covered = (coveredTopics || memory?.topicsCovered || []).filter(Boolean);
  const coveredBlock = covered.length
    ? `Topics already covered this session (avoid repeating these narrowly):\n${covered.join(', ')}`
    : 'Topics already covered this session: (none yet)';

  const focusWeak = (focusWeakTopics || weakTopics || memory?.weakTopics || []).filter(Boolean);
  const weakFocusBlock =
    practicePack === 'weak_topics'
      ? `FOCUS WEAK TOPICS FOR THIS SESSION (must pick from these): ${focusWeak.join(', ') || '(none listed — use general fundamentals)'}`
      : '';

  const companyWeightBlock = companyProfile
    ? `Company mode weights (bias question selection):
- Philosophy: ${companyProfile.philosophy || '(see style notes)'}
- Difficulty default: ${companyProfile.difficulty || difficulty}
- Follow-up aggressiveness: ${companyProfile.followUpAggressiveness || 'medium'}
- Behavioral weight: ${companyProfile.behavioralWeight ?? 3}/5
- Coding weight: ${companyProfile.codingWeight ?? 3}/5
- System design weight: ${companyProfile.systemDesignWeight ?? 3}/5
- Communication expectations: ${companyProfile.communicationExpect || ''}
- Preferred answer style: ${companyProfile.preferredAnswerStyle || ''}`
    : '';

  const memoryBlock = memory
    ? `INTERVIEW MEMORY (maintain continuity — do NOT ask isolated questions):
- Adaptive difficulty: ${memory.difficulty || difficulty}
- Confidence: ${memory.confidenceLevel ?? 'n/a'}
- Communication quality: ${memory.communicationQuality ?? 'n/a'}
- Depth quality: ${memory.depthQuality ?? 'n/a'}
- Session weak topics: ${(memory.weakTopics || []).join(', ') || '(none)'}
- Session strong topics: ${(memory.strongTopics || []).join(', ') || '(none)'}
- Repeated mistakes: ${(memory.repeatedMistakes || []).join('; ') || '(none)'}
- Knowledge gaps: ${(memory.knowledgeGaps || []).slice(0, 10).join('; ') || '(none)'}
- Incorrect concepts: ${(memory.conceptsIncorrect || []).join(', ') || '(none)'}
- Partial concepts: ${(memory.conceptsPartial || []).join(', ') || '(none)'}
- Question types used: ${(memory.questionTypesUsed || []).join(', ') || '(none)'}
- Resume claims verified: ${(memory.resumeClaimsVerified || []).join(', ') || '(none yet)'}
- Follow-up budget remaining: ${memory.followUpBudget ?? 0}
- Last scores: ${memory.lastScores ? JSON.stringify(memory.lastScores) : '(none)'}`
    : '';

  const knowledgeBlock = knowledgeProfile
    ? `CROSS-SESSION KNOWLEDGE PROFILE:
${knowledgeProfile.summary || '(none)'}
- Prioritize weak/learning concepts and frequently failed concepts when choosing the next angle.`
    : '';

  const userPrompt = `${framing}

${styleHeader}
${companyWeightBlock}

${roleLine}
Interview mode: ${mode}
Difficulty: ${difficulty} — ${difficultyGuide[difficulty] || difficultyGuide.medium}
Practice pack: ${practicePack || 'mixed'} — ${packGuide[practicePack] || packGuide.mixed}

${lang.ask}

Candidate resume (context — do NOT only ask about this):
${resumeText || '(not provided yet)'}

${jdBlock}
${jdExtractBlock}
${curriculumBlock}

Candidate's known weak topics (probe these more when relevant): ${(weakTopics || []).join(', ') || '(none)'}
Candidate's known strong topics (don't over-focus here): ${(strongTopics || []).join(', ') || '(none)'}
${weakFocusBlock}

${coveredBlock}

${memoryBlock}

${knowledgeBlock}

${adaptiveBlock}

Previous questions asked this session:
${previous}

This question's required intent: ${intent}

Rules:
- Ask ONE question only. Conduct a continuous interview, not isolated quiz items.
- Cover variety across the session: role fundamentals, real-world scenarios, trick/edge questions, resume verification, debugging, production incidents, architecture/trade-offs — match mode and company weights.
- Prefer curriculum topics that are NOT in the covered list yet.
- Challenge weak areas and verify resume claims that are still unverified.
- Sound like a real interviewer speaking naturally.
- Match difficulty (including memory adaptive difficulty) and mode.
- Do not repeat previous questions or the same narrow topic.
- Output ONLY the question text (and brief setup if needed), nothing else.`;

  return [{ role: 'user', content: userPrompt }];
}

const EVALUATOR_FEW_SHOT = `
Calibration examples (match this scoring discipline):

Example A — vague answer:
Q: How does React reconcile the virtual DOM?
A: "React is fast and uses virtual DOM so UI updates quickly."
Expected: technicalScore ~3-4, depthScore ~2-3, structureScore ~3. Feedback calls out missing diffing/reconciliation detail. needsFollowUp true with a clarifying probe.

Example B — solid answer:
Q: How does React reconcile the virtual DOM?
A: Explains virtual tree, diffing vs previous tree, commits minimal DOM updates, mentions keys for list reconciliation, notes it's not always faster for tiny updates.
Expected: technicalScore ~8-9, depthScore ~8, structureScore ~8. needsFollowUp false unless one advanced edge is worth probing.

Example C — mid answer with partial STAR:
Q: Tell me about a conflict with a teammate.
A: Names a disagreement but skips Result / measurable outcome.
Expected: structureScore and starResult lower (~4-5), needsFollowUp true asking for outcome/impact.
`;

export function buildEvaluatorMessages({
  companyName,
  questionText,
  userAnswer,
  mode,
  delivery = null,
  interviewLanguage = 'english',
}) {
  const context = isGeneralStyle(companyName)
    ? 'You are evaluating a practice interview answer for real-world interview readiness.'
    : `You are evaluating an interview answer the way a thoughtful ${companyName} interviewer would.`;

  const lang = languageGuide(interviewLanguage);

  const deliveryBlock = delivery
    ? `Delivery metrics from speech/text analysis (use for communication tips, do not over-penalize accent or plain wording):
${JSON.stringify(delivery)}`
    : '';

  const starRequired =
    mode === 'behavioral' ||
    /tell me about|time when|example of|conflict|challenge|leadership|batao|samjhao|example do/i.test(
      questionText,
    );

  const userPrompt = `${context}

Question asked: ${questionText}
Candidate's answer: ${userAnswer}
Interview mode: ${mode}
${deliveryBlock}

${lang.evaluate}

Judge like a real recruiter / hiring manager — NOT a keyword checker.

${EVALUATOR_FEW_SHOT}

Scoring philosophy:
- Reward correct meaning in the candidate's own words (English, Hindi, or Hinglish).
- Do NOT deduct for missing jargon if the idea is clear.
- Do NOT deduct for Indian English / Hinglish phrasing if the idea is clear.
- Penalize wrong facts, missing substance, vagueness, or unstructured rambling.
- technicalScore = correctness of ideas/facts.
- communicationScore = clarity to a human interviewer (you may lightly consider filler-heavy delivery).
- depthScore = reasoning, trade-offs, examples.
- structureScore = sensible flow${starRequired ? ' and STAR completeness where relevant' : ''}.
- If this is behavioral / story-based, score STAR dimensions 0-10. Otherwise still estimate STAR-like structure if a story was told, else use nulls.
- improvedAnswer = rewrite THEIR answer into a stronger version in the same interview language style.
- idealAnswer = a full strong interview answer (6-10 sentences) they could say out loud — clear, structured, interview-ready.
- conceptExplanation = TEACH the topic in detail for someone who did not know it. Must include:
  1) simple definition in plain words,
  2) step-by-step how it works,
  3) at least one concrete real-world / code / workplace EXAMPLE,
  4) common mistakes interviewers catch,
  5) a short "how to remember this in an interview" tip.
  Write 8-14 sentences. Assume the candidate may be a beginner on this exact question. Same interview language style.
- studyTips = 1-3 short actionable practice tips tied to weak spots (same language style).
- accuracyScore = factual/technical correctness (align with technicalScore).
- problemSolvingScore = how they approached the problem and trade-offs.
- practicalScore / practicalExperience = evidence of real experience vs textbook.
- productionThinking = ops, failure modes, monitoring, real-world constraints.
- confidenceScore = how assured and crisp the answer sounded (not bluffing).
- conceptsCorrect / conceptsPartial / conceptsIncorrect = specific concept names (e.g. "TTL", "eviction"), not just broad tags.
- knowledgeGaps = what they still need to learn at concept level.
- learningPriority = high|medium|low for studying this topic next.
- estimatedRevisionMinutes = integer minutes to revise this gap (10-90 typical).
- questionType = one of: resume-discussion, technical, behavioral, coding-theory, debugging, production-incident, architecture, trade-offs, system-design, database, api-design, security, scalability, cloud, leadership.
- difficultyLevel = easy|medium|hard for this question.
- needsFollowUp = true ONLY when a real interviewer would ask one clarifying follow-up — typically when the answer is partially solid but incomplete (roughly mid scores), NOT when they clearly nailed it or completely missed it.
- followUpQuestion = the exact follow-up to ask if needsFollowUp is true (same language style), else "".

Respond ONLY in this JSON format:

{
  "technicalScore": 0-10,
  "communicationScore": 0-10,
  "depthScore": 0-10,
  "structureScore": 0-10,
  "accuracyScore": 0-10,
  "problemSolvingScore": 0-10,
  "practicalScore": 0-10,
  "productionThinking": 0-10,
  "confidenceScore": 0-10,
  "starSituation": 0-10 or null,
  "starTask": 0-10 or null,
  "starAction": 0-10 or null,
  "starResult": 0-10 or null,
  "idealAnswer": "full strong interview answer, 6-10 sentences, same interview language style",
  "improvedAnswer": "stronger rewrite of the candidate's own answer, 4-7 sentences",
  "conceptExplanation": "detailed beginner-friendly teaching explanation with a concrete example, 8-14 sentences",
  "missingPoints": ["important substance gap"],
  "topicTags": ["topic1", "topic2"],
  "conceptsCorrect": ["concept"],
  "conceptsPartial": ["concept"],
  "conceptsIncorrect": ["concept"],
  "knowledgeGaps": ["gap"],
  "learningPriority": "high|medium|low",
  "estimatedRevisionMinutes": 30,
  "questionType": "technical",
  "difficultyLevel": "medium",
  "studyTips": ["tip1", "tip2"],
  "feedback": "1-2 sentence direct feedback on understanding and delivery",
  "needsFollowUp": false,
  "followUpQuestion": ""
}

Be fair and discerning, not soft and not pedantic. Teach clearly — after reading conceptExplanation, a confused candidate should understand the topic.`;

  return [{ role: 'user', content: userPrompt }];
}

export function buildVerdictMessages({ companyName, questions, interviewLanguage = 'english' }) {
  const transcript = questions
    .map((q, i) => {
      return `Q${i + 1}: ${q.questionText}
Answer: ${q.userAnswer}
Scores: technical=${q.technicalScore}, communication=${q.communicationScore}, depth=${q.depthScore}, structure=${q.structureScore}
Feedback: ${q.feedback}
Topics: ${(q.topicTags || []).join(', ')}`;
    })
    .join('\n\n');

  const role = isGeneralStyle(companyName)
    ? 'You are an experienced hiring manager reviewing a general mock interview (not company-specific).'
    : `You are a hiring manager at ${companyName} reviewing a full interview transcript.`;

  const lang = languageGuide(interviewLanguage);

  const userPrompt = `${role}

Questions, answers, and scores from this session:
${transcript || '(no questions answered)'}

${lang.verdict}

Judge overall hiring readiness the way a real interviewer would:
- Value clear thinking and correct understanding, even in Hindi/Hinglish/plain English.
- Do not treat missing jargon or mixed-language delivery as a reason to downrank if substance was solid.
- Focus on patterns: correctness, clarity, depth, and ability to communicate under interview pressure.

Give a final verdict in this JSON format:

{
  "hiringVerdict": "Strong Hire | Hire | Leaning Hire | Leaning No Hire | No Hire",
  "hireProbability": 0-100,
  "reasoning": "2-3 sentences explaining the verdict, citing real substance strengths/weaknesses — not vocabulary or language purity",
  "strengths": ["strength1"],
  "weaknesses": ["weakness1"],
  "repeatedMistakes": ["pattern noticed more than once"],
  "missedConcepts": ["concept they lacked"],
  "bestAnswerQ": "short label or snippet of best answer",
  "worstAnswerQ": "short label or snippet of weakest answer",
  "confidenceAnalysis": "1-2 sentences on confidence patterns",
  "communicationAnalysis": "1-2 sentences on clarity and structure",
  "technicalAnalysis": "1-2 sentences on technical correctness and depth",
  "recommendedLearningPath": "2-4 sentences describing what to study next and why",
  "estimatedInterviewReadiness": 0-10
}`;

  return [{ role: 'user', content: userPrompt }];
}

export function buildStudyPlanMessages({
  companyName,
  questions,
  verdict,
  weakConcepts = [],
  interviewLanguage = 'english',
  targetRole,
  intelligenceReport = null,
}) {
  const lang = languageGuide(interviewLanguage);
  const gaps = (questions || [])
    .flatMap((q) => [
      ...(q.knowledgeGaps || []),
      ...(q.missingPoints || []),
      ...(q.conceptsIncorrect || []),
    ])
    .filter(Boolean)
    .slice(0, 20);

  const tips = (questions || []).flatMap((q) => q.studyTips || []).slice(0, 12);

  const userPrompt = `You are an interview coach building tomorrow's personalized study plan for a software engineer.
Target role: ${targetRole || 'software engineer'}
Company style context: ${companyName || 'general'}

Session verdict summary:
${JSON.stringify(
  {
    hiringVerdict: verdict?.hiringVerdict,
    hireProbability: verdict?.hireProbability,
    readiness: verdict?.estimatedInterviewReadiness,
    recommendedLearningPath: verdict?.recommendedLearningPath,
    weaknesses: verdict?.weaknesses,
    missedConcepts: verdict?.missedConcepts,
    repeatedMistakes: verdict?.repeatedMistakes,
  },
  null,
  2,
)}

Weak concept mastery:
${JSON.stringify(weakConcepts, null, 2)}

Knowledge gaps / missing points from this session:
${gaps.join('; ') || '(none)'}

Existing study tips from evaluations:
${tips.join('; ') || '(none)'}

${intelligenceReport?.dimensionReport?.length ? `Explainable dimension narratives (prioritize weak areas):
${JSON.stringify(intelligenceReport.dimensionReport, null, 2)}` : ''}

${intelligenceReport?.misconceptions?.length ? `Confirmed/suspected misconceptions to address:
${JSON.stringify(intelligenceReport.misconceptions, null, 2)}` : ''}

${lang.verdict}

Return ONLY JSON:
{
  "title": "Tomorrow's Study Plan",
  "summary": "2-3 sentence overview of the plan",
  "estimatedMinutes": 45,
  "items": [
    {
      "priority": 1,
      "concept": "concept name",
      "slug": "optional-slug-if-known",
      "estimatedMinutes": 20,
      "explanation": "short teaching note / what to understand",
      "practiceQuestions": ["question to practice out loud", "another"],
      "retryInterviewAngle": "how this may appear in a real interview",
      "revisionNotes": "what they got wrong previously"
    }
  ]
}

Rules:
- 3-6 prioritized items.
- Prefer concrete concept-level items (e.g. TTL, eviction) over vague topics.
- Total estimatedMinutes should be realistic for one focused study day (30-120).
- Practice questions must be say-out-loud interview style.`;

  return [{ role: 'user', content: userPrompt }];
}

export function buildJdExtractMessages(jdText) {
  const userPrompt = `Extract the key hiring signals from this job description.
Respond ONLY as JSON:
{
  "requiredSkills": ["skill1", "skill2"],
  "seniority": "junior|mid|senior|staff|unknown"
}

Job description:
${jdText}`;

  return [{ role: 'user', content: userPrompt }];
}
