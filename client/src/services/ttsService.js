import { API_BASE, getToken } from '../config.js';

let playGeneration = 0;
let activeAudio = null;
let activeUrls = [];

function revokeUrls() {
  for (const url of activeUrls) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  }
  activeUrls = [];
}

export function stopTtsPlayback() {
  playGeneration += 1;
  if (activeAudio) {
    try {
      activeAudio.pause();
      activeAudio.src = '';
    } catch {
      // ignore
    }
    activeAudio = null;
  }
  revokeUrls();
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function base64ToBlob(b64, type = 'audio/wav') {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

function playBlob(blob, { signal, generation, onPlay, onProgress, progressBase = 0, progressCount = 1 } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted || generation !== playGeneration) {
      resolve('cancelled');
      return;
    }

    const url = URL.createObjectURL(blob);
    activeUrls.push(url);
    const audio = new Audio(url);
    activeAudio = audio;
    let progressTimer = null;

    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      if (progressTimer) clearInterval(progressTimer);
      if (activeAudio === audio) activeAudio = null;
      resolve(result);
    };

    audio.onended = () => finish('ended');
    audio.onerror = () => finish('error');
    audio.onplay = () => {
      if (typeof onPlay === 'function') onPlay();
      if (typeof onProgress === 'function' && progressCount > 1) {
        progressTimer = setInterval(() => {
          if (!audio.duration || Number.isNaN(audio.duration)) return;
          const local = Math.min(1, audio.currentTime / audio.duration);
          const idx = Math.min(
            progressCount - 1,
            progressBase + Math.floor(local * Math.max(1, progressCount - progressBase)),
          );
          onProgress(idx);
        }, 200);
      }
    };

    // Always start from the beginning of this chunk.
    audio.currentTime = 0;

    if (signal) {
      const onAbort = () => {
        try {
          audio.pause();
        } catch {
          // ignore
        }
        finish('cancelled');
      };
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
    }

    audio.play().catch((err) => {
      if (/NotAllowedError|interrupted/i.test(String(err?.name || err?.message || ''))) {
        finish('blocked');
        return;
      }
      reject(err instanceof Error ? err : new Error('Audio playback failed'));
    });
  });
}

/**
 * Play one or more WAV blobs in order from the first chunk.
 */
async function playBlobsInOrder(blobs, { signal, generation, onSentenceIndex, sentences } = {}) {
  const list = (blobs || []).filter(Boolean);
  if (!list.length) return 'error';

  for (let i = 0; i < list.length; i += 1) {
    if (signal?.aborted || generation !== playGeneration) return 'cancelled';
    if (typeof onSentenceIndex === 'function' && sentences?.length) {
      const approx = Math.min(
        sentences.length - 1,
        Math.floor((i / list.length) * sentences.length),
      );
      onSentenceIndex(approx);
    }
    const status = await playBlob(list[i], {
      signal,
      generation,
      progressBase: i,
      progressCount: list.length,
      onProgress: onSentenceIndex,
    });
    if (status !== 'ended') return status;
  }
  return 'ended';
}

/**
 * Request Emma Orpheus TTS from the API (JSON meta + base64 wav).
 */
export async function fetchEmmaSpeech(text, { language = 'english', kind = 'question', signal } = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const body = JSON.stringify({ text, language, kind, format: true, meta: true });

  let res = await fetch(`${API_BASE}/voice/tts?meta=1`, {
    method: 'POST',
    headers,
    body,
    signal,
  });

  if (res.status === 404) {
    res = await fetch(`${API_BASE}/voice/speak`, {
      method: 'POST',
      headers,
      body,
      signal,
    });
  }

  if (res.status === 401) {
    throw new Error('Sign in again to use Emma voice');
  }

  const raw = await res.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = {};
  }

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(
        'Voice API not found (404). Restart the server with: cd server && npm run dev',
      );
    }
    throw new Error(data?.error || `Voice request failed (${res.status})`);
  }

  const chunkList = Array.isArray(data.chunks)
    ? data.chunks.filter((c) => typeof c === 'string' && c.length > 0)
    : [];

  let blobs;
  if (chunkList.length > 0) {
    // Play each Orpheus piece in order — preserves the full spoken text from the start.
    blobs = chunkList.map((c) => base64ToBlob(c));
  } else if (data.audioBase64) {
    blobs = [base64ToBlob(data.audioBase64)];
  } else {
    throw new Error('Voice response missing audio');
  }

  return {
    blobs,
    spokenText: data.spokenText || text,
    sentences: data.sentences || [],
    persona: data.persona || 'Emma',
    provider: data.provider || 'groq-orpheus',
    voice: data.voice,
  };
}

export async function playQuestion(text, language = 'english', options = {}) {
  return playEmmaSpeech(text, { ...options, language, kind: 'question' });
}

export async function playFeedback(text, language = 'english', options = {}) {
  return playEmmaSpeech(text, { ...options, language, kind: 'feedback' });
}

export async function playEmmaSpeech(
  text,
  {
    language = 'english',
    kind = 'question',
    signal,
    onStart,
    onSpokenText,
    onSentences,
    onSentenceIndex,
  } = {},
) {
  if (!text?.trim()) return { status: 'empty' };
  if (signal?.aborted) return { status: 'cancelled' };

  stopTtsPlayback();
  const generation = playGeneration;
  await wait(60);
  if (signal?.aborted || generation !== playGeneration) return { status: 'cancelled' };

  const speech = await fetchEmmaSpeech(text, { language, kind, signal });
  if (signal?.aborted || generation !== playGeneration) return { status: 'cancelled' };

  if (typeof onSpokenText === 'function') onSpokenText(speech.spokenText);
  if (typeof onSentences === 'function') onSentences(speech.sentences || []);
  if (typeof onStart === 'function') onStart(speech);

  const status = await playBlobsInOrder(speech.blobs, {
    signal,
    generation,
    sentences: speech.sentences,
    onSentenceIndex,
  });

  return {
    status,
    spokenText: speech.spokenText,
    sentences: speech.sentences,
    persona: speech.persona,
  };
}
