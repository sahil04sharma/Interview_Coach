export const FILLER_WORDS = [
  'um',
  'uh',
  'erm',
  'ah',
  'like',
  'basically',
  'literally',
  'actually',
  'so',
  'well',
  'you know',
  'i mean',
  'kind of',
  'sort of',
  'right',
  'matlab',
  'yani',
  'yaani',
  'toh',
  'acha',
  'accha',
  'haan',
  'haanji',
  'basically',
  'actually',
];

export function analyzeSpeechDelivery(answerText, speakingSeconds) {
  const text = String(answerText || '').trim();
  const words = text ? text.split(/\s+/).filter(Boolean) : [];
  const lower = text.toLowerCase();

  let fillerWordCount = 0;
  for (const filler of FILLER_WORDS) {
    const pattern = new RegExp(`\\b${filler.replace(' ', '\\s+')}\\b`, 'gi');
    const matches = lower.match(pattern);
    if (matches) fillerWordCount += matches.length;
  }

  const wordCount = words.length;
  const seconds = Number(speakingSeconds);
  const wordsPerMinute =
    seconds > 0 && wordCount > 0 ? Math.round((wordCount / seconds) * 60) : null;

  return {
    fillerWordCount,
    wordCount,
    speakingSeconds: Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 10) / 10 : null,
    wordsPerMinute,
  };
}

export function paceLabel(wpm) {
  if (wpm == null) return null;
  if (wpm < 110) return 'a bit slow';
  if (wpm > 170) return 'a bit fast';
  return 'good pace';
}
