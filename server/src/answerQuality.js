/**
 * Reject empty / gibberish answers before spending an LLM evaluation call.
 */
export function assessAnswerQuality(text) {
  const raw = String(text || '');
  const t = raw.trim();
  if (!t) {
    return { ok: false, error: 'Please write or speak an answer before submitting.' };
  }
  if (t.length < 12) {
    return { ok: false, error: 'Answer is too short — add a bit more substance (at least a sentence).' };
  }

  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < 3) {
    return { ok: false, error: 'Please answer in at least a few words so coaching can be useful.' };
  }

  const compact = t.replace(/\s+/g, '');
  if (/^(.)\1{10,}$/.test(compact)) {
    return { ok: false, error: 'That looks like filler characters. Try a real answer.' };
  }

  const uniqueChars = new Set(compact.toLowerCase()).size;
  if (compact.length > 20 && uniqueChars < 4) {
    return { ok: false, error: 'Answer looks like keyboard mash. Please try again with a real response.' };
  }

  // Very short replies with almost no vowels (Latin or Devanagari) — likely smash.
  const hasSpeechSound = /[aeiouअ-औा-ौिीुूेैोौंःािीुूृेैोौ्]/i.test(t);
  if (words.length <= 4 && t.length < 35 && !hasSpeechSound) {
    return { ok: false, error: 'Could not detect a clear answer. Please rephrase and submit again.' };
  }

  return { ok: true };
}
