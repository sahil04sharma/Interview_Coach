import { chatJson } from '../../llm.js';
import { buildReportWriterMessages } from '../prompts/reportWriter.js';
import { parseReportWriterOutput } from '../schemas.js';

export async function runReportWriter(input) {
  const raw = await chatJson({
    messages: buildReportWriterMessages(input),
    temperature: 0.3,
  });
  const parsed = parseReportWriterOutput(raw);
  if (!parsed) {
    throw new Error('Report Writer returned invalid output');
  }
  return parsed;
}
