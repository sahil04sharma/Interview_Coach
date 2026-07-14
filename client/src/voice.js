export function canUseSpeechSynthesis() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

let speakGeneration = 0;

export function stopSpeaking() {
  speakGeneration += 1;
  if (canUseSpeechSynthesis()) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getVoicesReady() {
  if (!canUseSpeechSynthesis()) return Promise.resolve([]);

  const current = window.speechSynthesis.getVoices();
  if (current.length) return Promise.resolve(current);

  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      try {
        window.speechSynthesis.onvoiceschanged = null;
      } catch {
        // ignore
      }
      resolve(window.speechSynthesis.getVoices() || []);
    };
    window.speechSynthesis.onvoiceschanged = finish;
    // Nudge Chrome to load voices.
    try {
      window.speechSynthesis.getVoices();
    } catch {
      // ignore
    }
    setTimeout(finish, 1000);
  });
}

function norm(s) {
  return String(s || '').toLowerCase();
}

function isEnglishOrHindi(lang) {
  const l = norm(lang).replace('_', '-');
  return l.startsWith('en') || l.startsWith('hi');
}

function isMaleVoice(voice) {
  const name = `${norm(voice.name)} ${norm(voice.voiceURI)}`;
  return (
    /\b(male|man|boy)\b/.test(name) ||
    /\b(david|mark|ravi|george|james|thomas|richard|daniel|fred|sean|guy|ryan|eric|steffan|christopher|tony|microsoft david|microsoft mark|microsoft ravi|google uk english male)\b/.test(
      name,
    )
  );
}

function isArabicVoice(voice) {
  const blob = `${norm(voice.name)} ${norm(voice.voiceURI)} ${norm(voice.lang)}`;
  return /arabic|عربي|\bar[-_]?sa\b|\bar[-_]?eg\b|saudi|naayf|hoda|houda/.test(blob);
}

/** Soft girl voices we want (Zira was the soothing one). */
function isSoftGirlVoice(voice) {
  if (!voice || isMaleVoice(voice) || isArabicVoice(voice)) return false;
  if (!isEnglishOrHindi(voice.lang)) return false;
  const name = `${norm(voice.name)} ${norm(voice.voiceURI)}`;
  return /\b(female|woman|girl|zira|aria|jenny|samantha|victoria|karen|moira|tessa|fiona|veena|neerja|heera|kalpana|ananya|swara|hazel|susan|catherine|linda|heather|michelle|microsoft zira|microsoft neerja|microsoft heera|microsoft hazel|microsoft aria|microsoft jenny)\b/.test(
    name,
  );
}

function scoreSoftGirl(voice, language) {
  if (!isSoftGirlVoice(voice)) return -1;
  const name = `${norm(voice.name)} ${norm(voice.voiceURI)}`;
  const lang = norm(voice.lang).replace('_', '-');
  let score = 10;

  // Prefer the soothing Zira voice the user liked.
  if (/zira/.test(name)) score += 200;
  if (/hazel|neerja|heera/.test(name)) score += 120;
  if (/jenny|aria|samantha/.test(name)) score += 80;
  if (/kalpana|veena|ananya|swara/.test(name)) score += 70;

  const mode = String(language || 'english').toLowerCase();
  if (mode === 'hindi') {
    if (lang.startsWith('hi')) score += 60;
    if (/neerja|heera|kalpana|hindi/.test(name)) score += 40;
  } else {
    // english + hinglish: Zira (en-US) is best
    if (/zira/.test(name)) score += 50;
    if (lang.startsWith('en-us')) score += 30;
    if (lang.startsWith('en')) score += 15;
  }
  return score;
}

function pickSoftGirlVoice(voices, language) {
  const girls = (voices || []).filter(isSoftGirlVoice);
  if (!girls.length) return null;
  girls.sort((a, b) => scoreSoftGirl(b, language) - scoreSoftGirl(a, language));
  return girls[0];
}

function speakOnce(text, { voice, lang, rate, pitch, generation }) {
  return new Promise((resolve, reject) => {
    if (generation !== speakGeneration) {
      resolve('cancelled');
      return;
    }

    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }

    // Tiny gap after cancel — Chrome needs this or speak() is silent.
    setTimeout(() => {
      if (generation !== speakGeneration) {
        resolve('cancelled');
        return;
      }

      try {
        window.speechSynthesis.resume();
      } catch {
        // ignore
      }

      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = rate;
      utter.pitch = pitch;
      utter.volume = 1;
      utter.lang = lang;
      if (voice) {
        utter.voice = voice;
        // Match lang to the chosen voice so Chrome actually plays audio.
        if (voice.lang) utter.lang = voice.lang;
      }

      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };

      utter.onstart = () => {
        // Chrome sometimes pauses; keep it alive.
      };
      utter.onend = () => finish('ended');
      utter.onerror = (event) => {
        const code = event?.error || '';
        if (/interrupted|canceled|cancelled/i.test(String(code))) {
          finish('cancelled');
          return;
        }
        reject(new Error(code || 'Speech failed'));
      };

      window.speechSynthesis.speak(utter);

      // Watchdog: if Chrome ate the utterance, retry path can run.
      setTimeout(() => {
        if (settled) return;
        if (generation !== speakGeneration) {
          finish('cancelled');
          return;
        }
        if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
          finish('silent');
        }
      }, 1200);
    }, 120);
  });
}

/**
 * Soft soothing girl interviewer voice (browser TTS).
 * Prefers Microsoft Zira — the calm voice that worked well before.
 */
export async function speakText(text, { rate = 0.92, pitch = 1.12, language = 'english', signal } = {}) {
  if (!text?.trim()) return;
  if (signal?.aborted) return;

  if (!canUseSpeechSynthesis()) {
    throw new Error('Speech synthesis is not supported in this browser');
  }

  const generation = ++speakGeneration;
  // Cancel anything currently speaking, then wait so Chrome accepts the next utter.
  try {
    window.speechSynthesis.cancel();
  } catch {
    // ignore
  }
  await wait(150);
  if (signal?.aborted || generation !== speakGeneration) return;

  const voices = await getVoicesReady();
  if (signal?.aborted || generation !== speakGeneration) return;

  const girl = pickSoftGirlVoice(voices, language);
  const mode = String(language || 'english').toLowerCase();
  const effectiveRate = mode === 'hindi' ? 0.88 : mode === 'hinglish' ? 0.9 : rate;
  const softPitch = 1.12;

  // Default lang: use the girl’s own lang when available (Zira → en-US).
  // Do NOT force en-IN for Hinglish — that often makes Chrome produce no audio with Zira.
  let lang = girl?.lang || (mode === 'hindi' ? 'hi-IN' : 'en-US');
  if (mode === 'hindi' && girl && norm(girl.lang).startsWith('hi')) {
    lang = girl.lang;
  }

  const spoken = text.trim();

  let result = await speakOnce(spoken, {
    voice: girl,
    lang,
    rate: effectiveRate,
    pitch: softPitch,
    generation,
  });

  // If silent / failed, retry once with default English girl settings (no fancy lang).
  if (result === 'silent' && generation === speakGeneration && !signal?.aborted) {
    const zira =
      (voices || []).find((v) => /zira/i.test(v.name) && isEnglishOrHindi(v.lang)) ||
      girl ||
      (voices || []).find((v) => /^en/i.test(v.lang) && !isMaleVoice(v));

    result = await speakOnce(spoken, {
      voice: zira || null,
      lang: zira?.lang || 'en-US',
      rate: 0.92,
      pitch: 1.12,
      generation,
    });
  }

  if (result === 'silent' && generation === speakGeneration && !signal?.aborted) {
    // Last resort: no voice object at all.
    await speakOnce(spoken, {
      voice: null,
      lang: 'en-US',
      rate: 0.92,
      pitch: 1.12,
      generation,
    });
  }
}

export async function recordAudioChunk({ maxMs = 90000, onStart } = {}) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone access is not available in this browser');
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : '';

  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks = [];

  let stopTimer;
  let finished = false;

  const stop = () => {
    if (finished) return;
    finished = true;
    clearTimeout(stopTimer);
    if (recorder.state !== 'inactive') recorder.stop();
  };

  const blobPromise = new Promise((resolve, reject) => {
    recorder.ondataavailable = (event) => {
      if (event.data?.size) chunks.push(event.data);
    };
    recorder.onerror = () => reject(new Error('Recording failed'));
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const type = recorder.mimeType || mimeType || 'audio/webm';
      resolve(new Blob(chunks, { type }));
    };
  });

  recorder.start(250);
  if (typeof onStart === 'function') onStart({ stop });
  stopTimer = setTimeout(stop, maxMs);

  return {
    stop,
    done: blobPromise,
  };
}
