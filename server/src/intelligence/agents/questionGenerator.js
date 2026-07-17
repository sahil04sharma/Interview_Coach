import { chatCompletion, chatCompletionStream } from '../../llm.js';
import { buildQuestionGeneratorMessages } from '../prompts/questionGenerator.js';

export async function runQuestionGenerator(input, { stream = false, onToken } = {}) {
  const messages = buildQuestionGeneratorMessages(input);

  if (stream && typeof onToken === 'function') {
    const text = await chatCompletionStream({
      messages,
      temperature: 0.65,
      onToken,
    });
    const question = String(text || '').trim();
    if (!question) throw new Error('Question Generator returned empty output');
    return question;
  }

  const text = await chatCompletion({
    messages,
    temperature: 0.65,
  });
  const question = String(text || '').trim();
  if (!question) throw new Error('Question Generator returned empty output');
  return question;
}
