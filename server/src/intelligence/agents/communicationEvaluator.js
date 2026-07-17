import { chatJson } from '../../llm.js';
import { buildCommunicationEvaluatorMessages } from '../prompts/communicationEvaluator.js';
import { parseCommunicationOutput } from '../schemas.js';

export async function runCommunicationEvaluator(input) {
  const raw = await chatJson({
    messages: buildCommunicationEvaluatorMessages(input),
    temperature: 0.2,
  });
  const parsed = parseCommunicationOutput(raw);
  if (!parsed) {
    throw new Error('Communication evaluator returned invalid output');
  }
  return parsed;
}
