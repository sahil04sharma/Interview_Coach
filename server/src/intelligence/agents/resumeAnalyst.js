import { chatJson } from '../../llm.js';
import { buildResumeAnalystMessages } from '../prompts/resumeAnalyst.js';
import { parseResumeAnalysisOutput } from '../schemas.js';

export async function runResumeAnalyst(input) {
  const raw = await chatJson({
    messages: buildResumeAnalystMessages(input),
    temperature: 0.2,
  });
  const parsed = parseResumeAnalysisOutput(raw);
  if (!parsed) {
    throw new Error('Resume analyst returned invalid output');
  }
  return parsed;
}
