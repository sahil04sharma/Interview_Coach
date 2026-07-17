import { languageGuide } from '../../prompts.js';

export function buildCommunicationEvaluatorMessages({
  companyName,
  questionText,
  userAnswer,
  mode,
  delivery = null,
  interviewLanguage = 'english',
}) {
  const lang = languageGuide(interviewLanguage);
  const context =
    String(companyName || '').toLowerCase() === 'general'
      ? 'You are evaluating COMMUNICATION ONLY for a practice interview.'
      : `You are evaluating COMMUNICATION ONLY the way a thoughtful ${companyName} interviewer would.`;

  const deliveryBlock = delivery
    ? `Delivery metrics (use lightly for communication tips — do not over-penalize accent or plain wording):
${JSON.stringify(delivery)}`
    : '';

  const starRequired =
    mode === 'behavioral' ||
    /tell me about|time when|example of|conflict|challenge|leadership|batao|samjhao|example do/i.test(
      questionText,
    );

  const userPrompt = `${context}

Question: ${questionText}
Candidate answer: ${userAnswer}
Interview mode: ${mode}
${deliveryBlock}

${lang.evaluate}

STRICT RULES — you must follow all of these:
- Judge ONLY: communication clarity, structure${starRequired ? ', and STAR completeness' : ''}, delivery to a human listener.
- You must NOT judge factual correctness, technical depth, or knowledge — a wrong answer can still be well-communicated.
- Do not penalize Hindi, Hinglish, Indian English, or accent — judge clarity of meaning only.
- Do not choose the next question.
- evidence[] dimension must be "communication" only.

Respond ONLY as JSON:
{
  "communication": { "score": 0-10, "confidence": 0-1, "reason": "..." },
  "structure": { "score": 0-10, "confidence": 0-1, "reason": "..." },
  "star": {
    "situation": 0-10 or null,
    "task": 0-10 or null,
    "action": 0-10 or null,
    "result": 0-10 or null
  },
  "deliveryNotes": "short note",
  "evidence": [
    {
      "observation": "...",
      "dimension": "communication",
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
