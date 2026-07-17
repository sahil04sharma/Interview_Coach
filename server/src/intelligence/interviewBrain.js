import { chatJson } from '../llm.js';
import { buildInterviewBrainMessages } from './prompts/interviewBrain.js';
import { parseInterviewBrainOutput } from './schemas.js';
import {
  buildInterviewContext,
  estimateContextSize,
} from './contextBuilder.js';

/**
 * Run the Interview Brain (one LLM call).
 * @param {'turn'|'open'} mode
 * @returns {Promise<object|null>} parsed brain result or null on failure
 */
export async function runInterviewBrain({
  mode = 'turn',
  session,
  company,
  companyProfile = null,
  questionText = null,
  userAnswer = null,
  delivery = null,
  previousQuestions = [],
  lastEvaluation = null,
  targetRole = null,
  context = null,
}) {
  const built =
    context ||
    (await buildInterviewContext({
      session,
      company,
      companyProfile,
      mode,
      questionText,
      userAnswer,
      delivery,
      previousQuestions,
      lastEvaluation,
      targetRole,
    }));

  const size = estimateContextSize(built);
  const started = Date.now();

  const raw = await chatJson({
    messages: buildInterviewBrainMessages({ mode, context: built }),
    temperature: mode === 'open' ? 0.45 : 0.25,
  });

  const parsed = parseInterviewBrainOutput(raw, mode);
  if (!parsed) {
    console.warn('[intelligence] Interview Brain parse failed');
    return null;
  }

  if (parsed.violations?.length) {
    console.warn(
      '[intelligence] Interview Brain never-do soft violations:',
      parsed.violations.join(', '),
    );
  }

  return {
    ...parsed,
    _meta: {
      mode,
      latencyMs: Date.now() - started,
      contextChars: size.chars,
      contextEstTokens: size.estTokens,
      label: mode === 'open' ? 'brain-open' : 'brain-turn',
    },
  };
}
