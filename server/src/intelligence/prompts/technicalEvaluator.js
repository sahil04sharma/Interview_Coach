import { languageGuide } from '../../prompts.js';

export function buildTechnicalEvaluatorMessages({
  companyName,
  questionText,
  userAnswer,
  mode,
  interviewLanguage = 'english',
  difficulty = 'medium',
}) {
  const lang = languageGuide(interviewLanguage);
  const context =
    String(companyName || '').toLowerCase() === 'general'
      ? 'You are a technical interviewer evaluating KNOWLEDGE ONLY for a practice interview.'
      : `You are a technical interviewer at ${companyName} evaluating KNOWLEDGE ONLY.`;

  const userPrompt = `${context}

Question: ${questionText}
Candidate answer: ${userAnswer}
Interview mode: ${mode}
Difficulty context: ${difficulty}

${lang.evaluate}

STRICT RULES — you must follow all of these:
- Judge ONLY: knowledge, understanding, reasoning, depth, terminology, architectureThinking, productionThinking.
- You must NOT score clarity, fluency, structure, delivery, or STAR — another evaluator handles communication.
- Do not penalize Hindi, Hinglish, plain English, or accent — judge meaning and correctness only.
- Do not choose the next question or write coaching feedback paragraphs.
- Every scored dimension must include score (0-10), confidence (0-1), reason, and conceptSlugs when relevant.
- evidence[] must cite observations with polarity (supports|contradicts|neutral), strength, confidence, alternativeInterpretations.

Respond ONLY as JSON:
{
  "knowledge": { "score": 0-10, "confidence": 0-1, "reason": "...", "conceptSlugs": [] },
  "understanding": { "score": 0-10, "confidence": 0-1, "reason": "...", "conceptSlugs": [] },
  "reasoning": { "score": 0-10, "confidence": 0-1, "reason": "...", "conceptSlugs": [] },
  "depth": { "score": 0-10, "confidence": 0-1, "reason": "...", "conceptSlugs": [] },
  "terminology": { "score": 0-10, "confidence": 0-1, "reason": "...", "conceptSlugs": [] },
  "architectureThinking": { "score": 0-10, "confidence": 0-1, "reason": "...", "conceptSlugs": [] },
  "productionThinking": { "score": 0-10, "confidence": 0-1, "reason": "...", "conceptSlugs": [] },
  "conceptsCorrect": ["concept"],
  "conceptsPartial": ["concept"],
  "conceptsIncorrect": ["concept"],
  "knowledgeGaps": ["gap"],
  "topicTags": ["topic1", "topic2"],
  "evidence": [
    {
      "observation": "...",
      "dimension": "knowledge",
      "conceptSlugs": [],
      "polarity": "supports",
      "strength": 0.7,
      "confidence": 0.8,
      "alternativeInterpretations": ["..."]
    }
  ]
}`;

  return [{ role: 'user', content: userPrompt }];
}
