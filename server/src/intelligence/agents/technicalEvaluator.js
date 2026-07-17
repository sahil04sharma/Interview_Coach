import { chatJson } from '../../llm.js';
import { buildTechnicalEvaluatorMessages } from '../prompts/technicalEvaluator.js';
import { parseTechnicalOutput } from '../schemas.js';

export async function runTechnicalEvaluator(input) {
  const raw = await chatJson({
    messages: buildTechnicalEvaluatorMessages(input),
    temperature: 0.2,
  });
  const parsed = parseTechnicalOutput(raw);
  if (!parsed) {
    throw new Error('Technical evaluator returned invalid output');
  }
  return parsed;
}
