export function buildMisconceptionDetectorMessages({
  questionText,
  userAnswer,
  technical,
  interviewLanguage = 'english',
  confusionPriors = [],
}) {
  const priorsBlock =
    confusionPriors.length > 0
      ? `Commonly-confused concept pairs (check these if relevant):
${JSON.stringify(confusionPriors, null, 2)}`
      : '(no graph priors for these concepts)';

  const userPrompt = `You are a Misconception Detector for an interview intelligence engine.

Question: ${questionText}
Candidate answer: ${userAnswer}
Technical evaluation summary:
${JSON.stringify(
  {
    knowledge: technical?.knowledge,
    conceptsIncorrect: technical?.conceptsIncorrect,
    conceptsPartial: technical?.conceptsPartial,
  },
  null,
  2,
)}

${priorsBlock}

Identify confidently-held WRONG beliefs — distinct from mere knowledge gaps.
Only report a misconception when the candidate stated something incorrect as if it were true.

Do NOT score dimensions. Do NOT write questions.

Respond ONLY as JSON:
{
  "misconceptions": [
    {
      "conceptSlug": "redis-eviction",
      "statement": "what they wrongly believe",
      "correctStatement": "the correct understanding",
      "confidenceOfCandidate": 0.7,
      "ourConfidence": 0.6,
      "conceptSlugs": ["redis-ttl", "redis-eviction"]
    }
  ]
}

If none, return { "misconceptions": [] }`;

  return [{ role: 'user', content: userPrompt }];
}
