/**
 * Mic recording helpers. TTS is handled by services/ttsService.js (Orpheus / Emma).
 */

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

/** @deprecated Use hooks/useVoice + ttsService instead */
export function canUseSpeechSynthesis() {
  return false;
}

/** @deprecated */
export function stopSpeaking() {
  // no-op for legacy imports — use stopTtsPlayback from ttsService
}

/** @deprecated */
export async function speakText() {
  throw new Error('Browser TTS removed. Use playQuestion from ttsService / useVoice.');
}
