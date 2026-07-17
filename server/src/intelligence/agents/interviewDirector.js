import { chatJson } from '../../llm.js';
import { buildInterviewDirectorMessages } from '../prompts/interviewDirector.js';
import { parseDirectorPlanOutput } from '../schemas.js';

export async function runInterviewDirector(input) {
  const raw = await chatJson({
    messages: buildInterviewDirectorMessages(input),
    temperature: 0.3,
  });
  const parsed = parseDirectorPlanOutput(raw);
  if (!parsed) {
    throw new Error('Interview Director returned invalid output');
  }
  return parsed;
}
