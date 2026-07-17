import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../auth.js';
import {
  formatInterviewerSpeech,
  orpheusDirectionTags,
} from '../speechFormatter.js';
import { concatWavBuffers } from '../wavConcat.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

router.use(requireAuth);

const ORPHEUS_HARD_LIMIT = 200;

function getLlmConfig() {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey || apiKey.includes('paste-your') || apiKey === 'your-api-key-here') {
    return null;
  }
  const baseUrl = (process.env.LLM_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/$/, '');
  return { apiKey, baseUrl };
}

/**
 * Split spoken text into Orpheus-safe pieces. Never drops characters.
 * maxChars should already account for any prefix (direction tags).
 */
function chunkForTts(text, maxChars = 170) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];

  const parts = [];
  let remaining = clean;
  while (remaining.length > maxChars) {
    let slice = remaining.slice(0, maxChars);
    const breakAt = Math.max(
      slice.lastIndexOf('. '),
      slice.lastIndexOf('? '),
      slice.lastIndexOf('! '),
      slice.lastIndexOf('; '),
      slice.lastIndexOf(', '),
      slice.lastIndexOf(' — '),
      slice.lastIndexOf(' - '),
      slice.lastIndexOf(' '),
    );
    // Prefer a natural break, but never skip the start of remaining.
    if (breakAt >= 24) {
      slice = slice.slice(0, breakAt + 1);
    }
    const piece = slice.trim();
    if (!piece) {
      // Safety: force progress if whitespace/punctuation edge case.
      parts.push(remaining.slice(0, maxChars).trim());
      remaining = remaining.slice(maxChars).trim();
      continue;
    }
    parts.push(piece);
    remaining = remaining.slice(slice.length).trim();
  }
  if (remaining) parts.push(remaining);
  return parts.filter(Boolean);
}

/**
 * Build Orpheus inputs: keep FULL spoken text, prefix tags only when they fit.
 * Critical: never slice(0, 200) after tagging — that used to erase the opening.
 */
function buildOrpheusInputs(spokenText, language) {
  const directions = orpheusDirectionTags(language);
  const tagPrefix = `${directions} `;
  // Leave room for tags on every chunk so each call stays under 200.
  const bodyBudget = Math.max(80, ORPHEUS_HARD_LIMIT - tagPrefix.length);
  const bodies = chunkForTts(spokenText, bodyBudget);

  return bodies.map((body) => {
    const withTags = `${tagPrefix}${body}`;
    if (withTags.length <= ORPHEUS_HARD_LIMIT) return withTags;
    // Should never happen with bodyBudget, but fail safe without dropping head of text.
    return body.slice(0, ORPHEUS_HARD_LIMIT);
  });
}

function mostlyLatin(text) {
  const chars = String(text || '').replace(/\s/g, '');
  if (!chars.length) return true;
  const latin = (chars.match(/[A-Za-z0-9.,!?;:'"()\-]/g) || []).length;
  return latin / chars.length >= 0.45;
}

function stripDevanagariToLatinHint(text) {
  return String(text || '')
    .replace(/[\u0900-\u097F]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function synthesizeChunk({ apiKey, baseUrl, model, voice, input }) {
  const response = await fetch(`${baseUrl}/audio/speech`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      voice,
      input,
      response_format: 'wav',
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    const error = new Error(
      response.status === 401
        ? 'AI voice rejected the API key'
        : /terms|accept/i.test(errText)
          ? 'Accept the Orpheus TTS model terms in your Groq console, then retry.'
          : `AI voice failed (${response.status}): ${errText.slice(0, 220)}`,
    );
    error.status = 502;
    throw error;
  }

  return Buffer.from(await response.arrayBuffer());
}

async function synthesizeEmmaSpeech({ text, language, kind = 'question', formatSpeech = true }) {
  const cfg = getLlmConfig();
  if (!cfg) {
    const err = new Error('LLM_API_KEY is required for AI voice');
    err.status = 500;
    throw err;
  }

  const lang = String(language || 'english').toLowerCase();
  const formatted = formatSpeech
    ? formatInterviewerSpeech(text, { language: lang, kind })
    : {
        spokenText: String(text || '').trim(),
        sentences: [],
        persona: 'Emma',
        language: lang,
      };

  let spoken = formatted.spokenText;
  if (!spoken) {
    const err = new Error('text is required');
    err.status = 400;
    throw err;
  }

  if (!mostlyLatin(spoken)) {
    spoken = stripDevanagariToLatinHint(spoken);
    if (!spoken) {
      const err = new Error(
        'Emma voice needs Latin script for Hindi/Hinglish delivery. Rephrase or use Hinglish mode.',
      );
      err.status = 422;
      throw err;
    }
  }

  // Keep Emma speech as complete as possible (no hard mid-cut of the question).
  if (spoken.length > 900) {
    spoken = `${spoken.slice(0, 900).replace(/\s+\S*$/, '')}.`;
    formatted.spokenText = spoken;
    formatted.sentences = spoken
      .split(/(?<=[.?!])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const model = process.env.VOICE_TTS_MODEL || 'canopylabs/orpheus-v1-english';
  const voice = process.env.VOICE_TTS_VOICE || 'hannah';
  const inputs = buildOrpheusInputs(spoken, lang);

  const wavChunks = [];
  for (const input of inputs) {
    const buf = await synthesizeChunk({
      apiKey: cfg.apiKey,
      baseUrl: cfg.baseUrl,
      model,
      voice,
      input,
    });
    wavChunks.push(buf);
  }

  const audio = concatWavBuffers(wavChunks);
  return {
    audio,
    chunks: wavChunks,
    formatted,
    voice,
    model,
    provider: 'groq-orpheus',
    persona: 'Emma',
  };
}

router.post('/transcribe', upload.single('audio'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Upload an audio file as "audio"' });
    }

    const cfg = getLlmConfig();
    if (!cfg) {
      return res.status(500).json({ error: 'LLM_API_KEY is required for voice transcription' });
    }

    const model = process.env.VOICE_TRANSCRIBE_MODEL || 'whisper-large-v3-turbo';
    const languageHint = String(req.body?.language || req.query?.language || '').toLowerCase();
    const whisperLang =
      languageHint === 'hindi' || languageHint === 'hi'
        ? 'hi'
        : languageHint === 'hinglish'
          ? undefined
          : languageHint === 'english' || languageHint === 'en'
            ? 'en'
            : undefined;

    const form = new FormData();
    const blob = new Blob([req.file.buffer], {
      type: req.file.mimetype || 'audio/webm',
    });
    const filename = req.file.originalname || 'answer.webm';
    form.append('file', blob, filename);
    form.append('model', model);
    form.append('response_format', 'json');
    form.append('temperature', '0');
    if (whisperLang) {
      form.append('language', whisperLang);
    }
    const promptHint =
      languageHint === 'hindi'
        ? 'यह एक जॉब इंटरव्यू का उत्तर है। तकनीकी शब्द जैसे React, API, database अंग्रेज़ी में हो सकते हैं।'
        : languageHint === 'hinglish'
          ? 'This is a job interview answer in Hinglish. Mixed Hindi-English is expected. Keep technical terms like React, API, database.'
          : 'This is a spoken job interview answer. Keep technical terms accurate.';
    form.append('prompt', promptHint);
    const response = await fetch(`${cfg.baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: form,
    });

    if (!response.ok) {
      const errText = await response.text();
      const error = new Error(
        response.status === 401
          ? 'Voice transcription rejected the API key'
          : `Transcription failed (${response.status}): ${errText.slice(0, 200)}`,
      );
      error.status = 502;
      throw error;
    }

    const data = await response.json();
    const text = String(data.text || '').trim();
    if (!text) {
      return res.status(400).json({ error: 'No speech detected. Try again closer to the mic.' });
    }

    res.json({ text });
  } catch (err) {
    next(err);
  }
});

/**
 * Preferred TTS endpoint for Emma (Groq Orpheus).
 * Returns audio/wav binary. Optional ?meta=1 returns JSON with base64 + spoken script.
 */
router.post('/tts', async (req, res, next) => {
  try {
    const text = String(req.body?.text || '').trim();
    const language = String(req.body?.language || 'english').toLowerCase();
    const kind = String(req.body?.kind || 'question').toLowerCase();
    const wantMeta = req.query?.meta === '1' || req.body?.meta === true;

    const result = await synthesizeEmmaSpeech({
      text,
      language,
      kind: kind === 'feedback' ? 'feedback' : 'question',
      formatSpeech: req.body?.format !== false,
    });

    if (wantMeta) {
      return res.json({
        format: 'wav',
        voice: result.voice,
        model: result.model,
        provider: result.provider,
        persona: result.persona,
        spokenText: result.formatted.spokenText,
        sentences: result.formatted.sentences,
        // Prefer sequential chunks on the client (avoids broken WAV merges skipping the start).
        chunks: (result.chunks || []).map((buf) => Buffer.from(buf).toString('base64')),
        audioBase64: result.audio.toString('base64'),
      });
    }

    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('X-Voice-Persona', 'Emma');
    res.setHeader('X-Voice-Provider', 'groq-orpheus');
    res.setHeader('X-Spoken-Text', encodeURIComponent(result.formatted.spokenText.slice(0, 400)));
    return res.send(result.audio);
  } catch (err) {
    next(err);
  }
});

/**
 * Legacy JSON chunks endpoint — still uses Emma formatter + Orpheus.
 */
router.post('/speak', async (req, res, next) => {
  try {
    const text = String(req.body?.text || '').trim();
    const language = String(req.body?.language || 'english').toLowerCase();
    const kind = String(req.body?.kind || 'question').toLowerCase();

    const result = await synthesizeEmmaSpeech({
      text,
      language,
      kind: kind === 'feedback' ? 'feedback' : 'question',
      formatSpeech: req.body?.format !== false,
    });

    res.json({
      format: 'wav',
      voice: result.voice,
      model: result.model,
      provider: result.provider,
      persona: result.persona,
      spokenText: result.formatted.spokenText,
      sentences: result.formatted.sentences,
      chunks: (result.chunks || []).map((buf) => Buffer.from(buf).toString('base64')),
      audioBase64: result.audio.toString('base64'),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
