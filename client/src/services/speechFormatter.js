/**
 * Client-side mirror of Emma speech framing (server is source of truth).
 * Used for optimistic UI highlights before audio returns.
 */
export function formatSpeechLocal(rawText, { language = 'english', kind = 'question' } = {}) {
  const body = String(rawText || '')
    .replace(/[*_`#]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!body) return { spokenText: '', sentences: [] };

  const lang = String(language || 'english').toLowerCase();
  let open = 'Alright.';
  if (lang === 'hinglish') open = 'Achha.';
  if (lang === 'hindi') open = 'Achha.';

  const spoken =
    kind === 'feedback'
      ? `${open} Quick feedback. ${body}`
      : `${open} ${body}`;

  const sentences = spoken
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  return { spokenText: spoken, sentences, persona: 'Emma', language: lang };
}
