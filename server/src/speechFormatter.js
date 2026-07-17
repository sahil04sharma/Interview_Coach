/**
 * Emma — calm senior interviewer speech formatter.
 * Turns raw question/feedback text into conversational spoken delivery.
 * Never softens the question or adds hints; only adds natural interview framing.
 */

const TRANSITIONS = {
  english: {
    open: ['Alright.', 'Okay.', "Let's continue.", 'Next up.'],
    dig: ["I'd like to dig a little deeper.", "Let's dig a little deeper.", 'Interesting.'],
    resume: ['I noticed this on your resume.', 'Going back to something on your resume.'],
    pace: ['Take your time.', "I'm curious to hear your reasoning."],
  },
  hinglish: {
    open: ['Achha.', 'Theek hai.', 'Alright.', 'Chalo aage badhte hain.'],
    dig: ['Thoda aur depth mein jaate hain.', "Interesting — let's dig a little deeper."],
    resume: ['Maine tumhare resume pe yeh dekha.', 'Resume pe yeh mention tha.'],
    pace: ['Apna time lo.', 'Mujhe tumhara reasoning samajhna hai.'],
  },
  hindi: {
    // Romanized for Orpheus English TTS (natural spoken Hindi).
    open: ['Achha.', 'Theek hai.', 'Chalo aage badhte hain.'],
    dig: ['Thoda aur detail mein jaate hain.', 'Interesting.'],
    resume: ['Maine aapke resume mein yeh dekha.'],
    pace: ['Apna time lijiye.', 'Mujhe aapka reasoning samajhna hai.'],
  },
};

function pick(list, salt = 0) {
  if (!list?.length) return '';
  const i = Math.abs(salt) % list.length;
  return list[i];
}

function cleanRaw(text) {
  return String(text || '')
    .replace(/[*_`#]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordSalt(text) {
  let n = 0;
  const s = String(text || '');
  for (let i = 0; i < s.length; i += 1) n = (n + s.charCodeAt(i) * (i + 1)) % 997;
  return n;
}

function looksLikeFollowUp(text) {
  return /follow[- ]?up|dig deeper|can you (elaborate|clarify|expand)|specifically|you mentioned|earlier you/i.test(
    text,
  );
}

function looksLikeResumeProbe(text) {
  return /resume|you (mentioned|wrote|worked|built|used)|your (project|experience|role)/i.test(text);
}

function stripLeadPhrases(text) {
  return text
    .replace(/^(alright|okay|ok|so|well|now|next|achha|theek hai|chalo)[,.]?\s+/i, '')
    .trim();
}

/**
 * Format interview question speech for Emma.
 * @returns {{ spokenText: string, sentences: string[], persona: string, language: string }}
 */
export function formatInterviewerSpeech(rawText, { language = 'english', kind = 'question' } = {}) {
  const lang = ['hindi', 'hinglish', 'english'].includes(String(language).toLowerCase())
    ? String(language).toLowerCase()
    : 'english';
  const t = TRANSITIONS[lang] || TRANSITIONS.english;
  const salt = wordSalt(rawText);
  let body = cleanRaw(rawText);
  if (!body) {
    return { spokenText: '', sentences: [], persona: 'Emma', language: lang };
  }

  if (kind === 'feedback') {
    const open = pick(t.open, salt);
    const spoken =
      lang === 'hinglish'
        ? `${open} Quick feedback. ${body}`
        : lang === 'hindi'
          ? `${open} Short feedback. ${body}`
          : `${open} Quick feedback. ${body}`;
    return finalize(spoken, lang);
  }

  body = stripLeadPhrases(body);

  const parts = [];
  if (looksLikeFollowUp(body)) {
    parts.push(pick(t.dig, salt));
  } else {
    parts.push(pick(t.open, salt + 1));
  }

  if (looksLikeResumeProbe(body) && !looksLikeFollowUp(body)) {
    parts.push(pick(t.resume, salt + 2));
  }

  // Keep the technical question intact — just frame it.
  parts.push(body);

  // Light closing cue — not every time, and only when question is not already long.
  if (salt % 3 === 0 && body.length < 220) {
    parts.push(pick(t.pace, salt + 3));
  }

  let spoken = parts.filter(Boolean).join(' ');

  // Soft length preference for ~30s: keep FULL question body; trim only optional framing.
  if (spoken.length > 700) {
    spoken = `${pick(t.open, salt)} ${body}`.trim();
  }

  return finalize(spoken, lang);
}

function finalize(spokenText, language) {
  const cleaned = cleanRaw(spokenText);
  const sentences = cleaned
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    spokenText: cleaned,
    sentences,
    persona: 'Emma',
    language,
  };
}

/** Direction tags for Orpheus vocal style (Emma persona). */
export function orpheusDirectionTags(language = 'english') {
  const lang = String(language || 'english').toLowerCase();
  // Keep tags short so they never force truncation of spoken content.
  if (lang === 'hinglish') return '[warm][friendly]';
  if (lang === 'hindi') return '[warm][calm]';
  return '[warm][calm]';
}
