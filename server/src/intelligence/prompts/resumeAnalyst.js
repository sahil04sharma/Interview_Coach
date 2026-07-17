export function buildResumeAnalystMessages({
  resumeText,
  targetRole,
  jdText,
  roleCurriculum,
}) {
  const role = targetRole?.trim() || 'software engineer';
  const userPrompt = `You are a Resume Analyst for an interview intelligence engine.

Your job is to read the candidate resume and produce:
1) verifiable resume claims,
2) seed hypotheses worth testing in the interview,
3) seed uncertainties that should guide future questioning.

STRICT RULES:
- Do NOT score the candidate.
- Do NOT write interview questions.
- Do NOT judge communication.
- Extract only claims that are realistic to verify in an interview.
- Prefer specific technical/ownership claims over vague adjectives.
- Hypotheses must be testable, not final conclusions.
- Uncertainties should be phrased as things the interviewer still needs to verify.

Target role: ${role}
${jdText ? `Job description:\n${jdText}\n` : ''}
${roleCurriculum ? `Role curriculum:\n${JSON.stringify(roleCurriculum, null, 2)}\n` : ''}

Resume:
${resumeText || '(not provided)'}

Respond ONLY as JSON:
{
  "claims": [
    {
      "claim": "Built Redis caching layer handling 10k rps",
      "conceptSlugs": ["redis", "caching", "redis-eviction"],
      "importance": "high|medium|low"
    }
  ],
  "seedHypotheses": [
    {
      "statement": "Claims deep caching experience; verify operational depth",
      "conceptSlugs": ["redis-eviction"],
      "priority": 0.8
    }
  ],
  "seedUncertainties": [
    {
      "about": "Is claimed 10k rps scale real?",
      "conceptSlugs": ["scalability"],
      "priority": 0.7
    }
  ]
}`;

  return [{ role: 'user', content: userPrompt }];
}
