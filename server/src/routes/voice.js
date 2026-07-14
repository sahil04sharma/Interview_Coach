import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../auth.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

router.use(requireAuth);

const ORPHEUS_MAX_CHARS = 180; // Groq Orpheus limit is 200; leave room for direction tags

function getLlmConfig() {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey || apiKey.includes('paste-your') || apiKey === 'your-api-key-here') {
    return null;
  }
  const baseUrl = (process.env.LLM_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/$/, '');
  return { apiKey, baseUrl };
}

/** Split text into Orpheus-sized chunks at sentence / clause boundaries. */
function chunkForTts(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  if (clean.length <= ORPHEUS_MAX_CHARS) return [clean];

  const parts = [];
  let remaining = clean;
  while (remaining.length > ORPHEUS_MAX_CHARS) {
    let slice = remaining.slice(0, ORPHEUS_MAX_CHARS);
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
    if (breakAt > 40) slice = slice.slice(0, breakAt + 1);
    parts.push(slice.trim());
    remaining = remaining.slice(slice.length).trim();
  }
  if (remaining) parts.push(remaining);
  return parts.filter(Boolean);
}

function prepareSpokenText(text, language) {
  const lang = String(language || 'english').toLowerCase();
  let body = String(text || '').trim();
  if (!body) return '';

  body = body
    .replace(/[*_`#]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Vocal directions make Orpheus sound like a person, not a reader.
  if (lang === 'hinglish') {
    return `[warm][friendly] ${body}`;
  }
  if (lang === 'hindi') {
    return `[warm][calm] ${body}`;
  }
  return `[warm][conversational] ${body}`;
}

function mostlyLatin(text) {
  const chars = String(text || '').replace(/\s/g, '');
  if (!chars.length) return true;
  const latin = (chars.match(/[A-Za-z0-9.,!?;:'"()\-]/g) || []).length;
  return latin / chars.length >= 0.55;
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

  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer.toString('base64');
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
 * Neural AI interviewer voice (Groq Orpheus) — sounds like a person, not browser TTS.
 * Female voice default: hannah (also autumn / diana)
 */
router.post('/speak', async (req, res, next) => {
  try {
    const cfg = getLlmConfig();
    if (!cfg) {
      return res.status(500).json({ error: 'LLM_API_KEY is required for AI voice' });
    }

    const text = String(req.body?.text || '').trim();
    const language = String(req.body?.language || 'english').toLowerCase();
    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    if (language === 'hindi' && !mostlyLatin(text)) {
      return res.status(422).json({
        error: 'AI voice is English/Hinglish optimized. Use browser voice for Hindi script.',
        fallback: 'browser',
      });
    }

    const model = process.env.VOICE_TTS_MODEL || 'canopylabs/orpheus-v1-english';
    const voice = process.env.VOICE_TTS_VOICE || 'hannah';

    const prepared = prepareSpokenText(text, language);
    const directionMatch = prepared.match(/^(\[[^\]]+\]\s*)+/);
    const directions = directionMatch ? directionMatch[0] : '';
    const bodyOnly = directions ? prepared.slice(directions.length).trim() : prepared;
    const rawChunks = chunkForTts(bodyOnly);
    const inputs = rawChunks.map((chunk, i) => {
      const withDir = i === 0 && directions ? `${directions}${chunk}` : chunk;
      return withDir.length > 200 ? withDir.slice(0, 200) : withDir;
    });

    const audioChunks = [];
    for (const input of inputs) {
      const b64 = await synthesizeChunk({
        apiKey: cfg.apiKey,
        baseUrl: cfg.baseUrl,
        model,
        voice,
        input,
      });
      audioChunks.push(b64);
    }

    res.json({
      format: 'wav',
      voice,
      model,
      chunks: audioChunks,
      provider: 'groq-orpheus',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
