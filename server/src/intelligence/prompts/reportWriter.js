import { languageGuide } from '../../prompts.js';

function isGeneralStyle(companyName) {
  return String(companyName || '').toLowerCase() === 'general';
}

export function buildReportWriterMessages({
  companyName,
  interviewLanguage = 'english',
  targetRole,
  reportContext,
  overallScore,
}) {
  const ctx = reportContext || {};
  const lang = languageGuide(interviewLanguage);

  const role = isGeneralStyle(companyName)
    ? 'You are an experienced hiring manager writing an explainable interview debrief.'
    : `You are a hiring manager at ${companyName} writing an explainable interview debrief.`;

  const userPrompt = `${role}

Target role: ${targetRole || 'software engineer'}
Session average score (legacy aggregate): ${overallScore ?? 'n/a'}
Interview language: ${interviewLanguage}

${lang.verdict}

You must write a debrief that traces conclusions to evidence: hypothesis → probe → observation → conclusion.
Use ONLY evidence IDs that appear in the evidence list below — do not invent IDs.
Neighborhood-influence concept adjustments are unverified unless direct evidence exists — say so in narratives.

Cognitive model dimensions:
${JSON.stringify(ctx.cognitiveModel?.dimensions || {}, null, 2)}

Concept beliefs:
${JSON.stringify(ctx.conceptBeliefs || [], null, 2)}

Hypotheses:
${JSON.stringify(ctx.hypotheses || [], null, 2)}

Evidence (cite these IDs in strengths/weaknesses/dimensionReport):
${JSON.stringify(ctx.evidence || [], null, 2)}

Misconceptions:
${JSON.stringify(ctx.misconceptions || [], null, 2)}

Resume claims:
${JSON.stringify(ctx.resumeClaims || [], null, 2)}

Open / resolved uncertainties:
${JSON.stringify(ctx.uncertainties || [], null, 2)}

Transcript:
${JSON.stringify(ctx.transcript || [], null, 2)}

STRICT RULES:
- Every strength and weakness MUST include at least one evidenceId from the evidence list.
- Every dimensionReport entry MUST include at least one evidenceId.
- Narrate the interview story: what you suspected, what you asked, what you observed, what you concluded.
- Do NOT average communication into technical scores — keep dimensions separate.
- Emit legacy-compatible fields so existing report UI keeps working.

Respond ONLY as JSON:
{
  "hiringVerdict": "Strong Hire | Hire | Leaning Hire | Leaning No Hire | No Hire",
  "hireProbability": 0-100,
  "readiness": 0-10,
  "reasoning": "2-4 sentences citing evidence-backed patterns",
  "dimensionReport": [
    {
      "dimension": "knowledge",
      "score": 0-10,
      "confidence": 0-1,
      "narrative": "hypothesis → probe → evidence → conclusion",
      "evidenceIds": ["uuid-from-evidence-list"]
    }
  ],
  "strengths": [{ "text": "strength", "evidenceIds": ["uuid"] }],
  "weaknesses": [{ "text": "weakness", "evidenceIds": ["uuid"] }],
  "resolvedHypotheses": [
    { "id": "hypothesis-uuid", "status": "supported|refuted|open", "summary": "one sentence" }
  ],
  "misconceptions": [
    { "conceptSlug": "slug", "status": "suspected|confirmed", "summary": "one sentence", "evidenceIds": ["uuid"] }
  ],
  "repeatedMistakes": ["pattern seen more than once"],
  "missedConcepts": ["concept they lacked"],
  "bestAnswerQ": "short label",
  "worstAnswerQ": "short label",
  "confidenceAnalysis": "1-2 sentences",
  "communicationAnalysis": "1-2 sentences",
  "technicalAnalysis": "1-2 sentences",
  "recommendedLearningPath": "2-4 sentences"
}`;

  return [{ role: 'user', content: userPrompt }];
}
