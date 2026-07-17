import { useCallback, useEffect, useRef, useState } from 'react';
import { playEmmaSpeech, stopTtsPlayback } from '../services/ttsService.js';

/**
 * Emma Orpheus voice hook — playQuestion / playFeedback / stop.
 */
export function useVoice({ language = 'english' } = {}) {
  const [speaking, setSpeaking] = useState(false);
  const [spokenText, setSpokenText] = useState('');
  const [sentences, setSentences] = useState([]);
  const [activeSentenceIndex, setActiveSentenceIndex] = useState(-1);
  const [error, setError] = useState('');
  const languageRef = useRef(language);
  const abortRef = useRef(null);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      stopTtsPlayback();
    };
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    stopTtsPlayback();
    setSpeaking(false);
    setActiveSentenceIndex(-1);
  }, []);

  const speak = useCallback(async (text, { kind = 'question', language: langOverride } = {}) => {
    if (!text?.trim()) return;
    stop();
    const controller = new AbortController();
    abortRef.current = controller;
    setError('');
    setSpeaking(true);
    setSpokenText('');
    setSentences([]);
    setActiveSentenceIndex(0);

    try {
      const result = await playEmmaSpeech(text, {
        language: langOverride || languageRef.current,
        kind,
        signal: controller.signal,
        onSpokenText: (s) => setSpokenText(s),
        onSentences: (list) => {
          setSentences(list);
          setActiveSentenceIndex(list.length ? 0 : -1);
        },
        onSentenceIndex: (idx) => setActiveSentenceIndex(idx),
      });

      if (result.status === 'blocked') {
        setError('Browser blocked audio. Click Replay to hear Emma.');
      } else if (result.status === 'error') {
        setError('Could not play Emma voice. You can still read the question.');
      }
      return result;
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err.message || 'Emma voice failed');
      }
      throw err;
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setSpeaking(false);
      setActiveSentenceIndex(-1);
    }
  }, [stop]);

  const playQuestion = useCallback(
    (text, lang) => speak(text, { kind: 'question', language: lang }),
    [speak],
  );

  const playFeedback = useCallback(
    (text, lang) => speak(text, { kind: 'feedback', language: lang }),
    [speak],
  );

  return {
    speaking,
    spokenText,
    sentences,
    activeSentenceIndex,
    error,
    playQuestion,
    playFeedback,
    stop,
  };
}

export default useVoice;
