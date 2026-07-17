import { chatCompletion, chatCompletionStream } from '../llm.js';
import { buildInterviewerMessages } from '../prompts.js';
import { fallbackQuestion } from '../fallbackQuestions.js';

/**
 * V1 question generation fallback (buildInterviewerMessages + intent modulo).
 */
export async function generateQuestionV1(args, { stream = false, onToken } = {}) {
  try {
    if (stream && typeof onToken === 'function') {
      const text = await chatCompletionStream({
        messages: buildInterviewerMessages(args),
        temperature: 0.65,
        onToken,
      });
      if (text?.trim()) return text.trim();
    } else {
      const text = await chatCompletion({
        messages: buildInterviewerMessages(args),
        temperature: 0.65,
      });
      if (text?.trim()) return text.trim();
    }
  } catch (err) {
    console.warn('[intelligence] V1 question generation failed, using fallback:', err.message);
  }

  const weak =
    args.practicePack === 'weak_topics' && args.focusWeakTopics?.length
      ? args.focusWeakTopics[args.questionIndex % args.focusWeakTopics.length]
      : null;

  return fallbackQuestion({
    mode: args.mode,
    index: args.questionIndex,
    weakTopic: weak,
    interviewLanguage: args.interviewLanguage,
  });
}
