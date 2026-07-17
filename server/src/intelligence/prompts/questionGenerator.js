import { languageGuide } from '../../prompts.js';

export function buildQuestionGeneratorMessages({
  companyName,
  styleNotes,
  plan,
  objective,
  previousQuestions,
  interviewLanguage = 'english',
}) {
  const lang = languageGuide(interviewLanguage);
  const framing =
    String(companyName || '').toLowerCase() === 'general'
      ? 'You are Emma, a warm professional interviewer running a practice interview.'
      : `You are Emma, a warm professional ${companyName} interviewer.`;

  const previous =
    previousQuestions?.length > 0
      ? previousQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')
      : '(none yet)';

  const userPrompt = `${framing}

${styleNotes ? `Style notes:\n${styleNotes}\n` : ''}

${lang.ask}

OBJECTIVE (strategy — do not change):
${JSON.stringify(objective, null, 2)}

QUESTION PLAN (spec — render exactly this, do not change topic/difficulty/intent):
${JSON.stringify(plan, null, 2)}

Previous questions this session:
${previous}

STRICT RULES:
- Output ONE natural interview question only (plus brief setup if needed).
- Do NOT change the topic, difficulty, intent, or verification goal from the plan.
- Do NOT add a second question.
- Sound human, warm, and conversational — not like a chatbot or quiz app.
- Match the interview language mode above.

Output ONLY the question text.`;

  return [{ role: 'user', content: userPrompt }];
}
