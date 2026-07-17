import { chatJson } from '../../llm.js';
import { buildMisconceptionDetectorMessages } from '../prompts/misconceptionDetector.js';
import { parseMisconceptionOutput } from '../schemas.js';

export async function runMisconceptionDetector(input) {
  const raw = await chatJson({
    messages: buildMisconceptionDetectorMessages(input),
    temperature: 0.2,
  });
  return parseMisconceptionOutput(raw);
}

export function shouldRunMisconceptionDetector(technical) {
  if (!technical) return false;
  const knowledgeScore = technical.knowledge?.score ?? 10;
  if (knowledgeScore <= 6) return true;
  if ((technical.conceptsIncorrect || []).length > 0) return true;
  if ((technical.conceptsPartial || []).length > 0) return true;
  return false;
}
