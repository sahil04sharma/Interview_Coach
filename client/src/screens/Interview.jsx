import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import {
  Alert,
  Button,
  Field,
  Loading,
  Page,
  PageHeader,
  Panel,
  ScoreGrid,
} from '../components/ui.jsx';
import { canUseSpeechSynthesis, recordAudioChunk, speakText, stopSpeaking } from '../voice.js';

function StarRow({ label, value }) {
  if (value == null) return null;
  return (
    <div className="flex justify-between text-sm">
      <span className="text-[var(--color-muted)]">{label}</span>
      <span className="font-semibold tabular-nums">{value}/10</span>
    </div>
  );
}

export default function Interview() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [question, setQuestion] = useState(location.state?.question || '');
  const [streamPreview, setStreamPreview] = useState('');
  const [mode, setMode] = useState(location.state?.mode || '');
  const [voiceMode, setVoiceMode] = useState(Boolean(location.state?.voiceMode));
  const [plannedCount, setPlannedCount] = useState(location.state?.plannedCount || 8);
  const [interviewLanguage, setInterviewLanguage] = useState(
    location.state?.interviewLanguage || 'hinglish',
  );
  const [answeredCount, setAnsweredCount] = useState(location.state?.answeredCount || 0);
  const [isFollowUp, setIsFollowUp] = useState(Boolean(location.state?.isFollowUp));
  const [answer, setAnswer] = useState('');
  const [submittedAnswer, setSubmittedAnswer] = useState('');
  const [evaluation, setEvaluation] = useState(null);
  const [pendingNext, setPendingNext] = useState(null);
  const [nextPreview, setNextPreview] = useState('');
  const [phase, setPhase] = useState('answering'); // answering | feedback
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [finishing, setFinishing] = useState(false);
  const [loadingSession, setLoadingSession] = useState(!location.state?.question);
  const [runOutput, setRunOutput] = useState(null);
  const [running, setRunning] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('');
  const [error, setError] = useState('');
  const [showIdeal, setShowIdeal] = useState(false);
  const [retryActive, setRetryActive] = useState(false);
  const recorderRef = useRef(null);
  const answerStartedAt = useRef(Date.now());

  useEffect(() => {
    if (phase !== 'answering') return;
    answerStartedAt.current = Date.now();
  }, [question, phase]);

  useEffect(() => {
    if (location.state?.question) {
      setLoadingSession(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const resumed = await api.resumeSession(id);
        if (cancelled) return;
        setQuestion(resumed.question);
        setMode(resumed.mode);
        setPlannedCount(resumed.plannedCount || 8);
        setInterviewLanguage(resumed.interviewLanguage || 'english');
        setAnsweredCount(resumed.answeredCount || 0);
        setIsFollowUp(Boolean(resumed.isFollowUp));
        setPhase('answering');
      } catch {
        try {
          const session = await api.getSession(id);
          if (cancelled) return;
          setMode(session.mode);
          setPlannedCount(session.plannedCount || 8);
          setInterviewLanguage(session.interviewLanguage || 'english');
          setAnsweredCount(session.questions?.filter((q) => !q.isFollowUp).length || 0);
          if (session.hiringVerdict) {
            navigate(`/session/${id}/report`, { replace: true });
            return;
          }
          if (session.currentQuestion) {
            setQuestion(session.currentQuestion);
            setIsFollowUp(Boolean(session.currentIsFollowUp));
          } else {
            setError('This session has no live question. Start a new practice session.');
          }
        } catch (err) {
          if (!cancelled) setError(err.message);
        }
      } finally {
        if (!cancelled) setLoadingSession(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, location.state, navigate]);

  useEffect(() => {
    if (!voiceMode || !question || phase !== 'answering' || submitting || finishing) return;

    const controller = new AbortController();
    // Delay start so React Strict Mode remount does not cancel speech before it begins.
    const timer = setTimeout(() => {
      (async () => {
        try {
          setSpeaking(true);
          setError('');
          setVoiceStatus(isFollowUp ? 'Follow-up…' : 'Interviewer is speaking…');
          await speakText(question, { language: interviewLanguage, signal: controller.signal });
          if (!controller.signal.aborted) {
            setVoiceStatus('Your turn — tap Record answer when ready.');
          }
        } catch {
          if (!controller.signal.aborted) {
            setVoiceStatus('Could not speak this question. You can still read and answer.');
          }
        } finally {
          if (!controller.signal.aborted) setSpeaking(false);
        }
      })();
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
      stopSpeaking();
    };
  }, [question, voiceMode, isFollowUp, interviewLanguage, phase, submitting, finishing]);

  useEffect(() => {
    return () => {
      stopSpeaking();
      recorderRef.current?.stop?.();
    };
  }, []);

  async function finishAndReport() {
    const report = await api.finishSession(id);
    navigate(`/session/${id}/report`, { state: { report } });
  }

  async function submitAnswer({ isRetry = false } = {}) {
    if (!question.trim() || !answer.trim()) return;
    stopSpeaking();
    setSubmitting(true);
    setError('');
    setStatusMessage(isRetry ? 'Re-scoring your improved answer…' : 'Evaluating your answer…');
    setNextPreview('');
    setVoiceStatus(voiceMode ? 'Evaluating your answer…' : '');
    const speakingSeconds = Math.max(5, (Date.now() - answerStartedAt.current) / 1000);
    const currentAnswer = answer;
    let assembledNext = '';
    try {
      const result = await api.answer(
        id,
        {
          questionText: question,
          userAnswer: currentAnswer,
          speakingSeconds,
          isFollowUpAnswer: isFollowUp,
          isRetry,
        },
        {
          onEvent: (event) => {
            if (event.type === 'status') setStatusMessage(event.message || '');
            if (event.type === 'evaluation') {
              setSubmittedAnswer(currentAnswer);
              setEvaluation(event.lastEvaluation);
              setAnsweredCount(event.answeredCount ?? answeredCount);
              setPlannedCount(event.plannedCount ?? plannedCount);
              setPhase('feedback');
              setShowIdeal(false);
              setRetryActive(false);
              setStatusMessage('Feedback ready — next question loading…');
              setVoiceStatus('Review feedback, then continue.');
            }
            if (event.type === 'token') {
              assembledNext += event.delta || '';
              setNextPreview(assembledNext);
            }
          },
        },
      );

      setSubmittedAnswer(currentAnswer);
      setEvaluation(result.lastEvaluation);
      setAnsweredCount(result.answeredCount ?? answeredCount);
      setPlannedCount(result.plannedCount ?? plannedCount);
      setRunOutput(null);
      setPhase('feedback');
      setRetryActive(false);
      setPendingNext({
        nextQuestion: result.nextQuestion || null,
        isFollowUp: Boolean(result.isFollowUp),
        sessionComplete: Boolean(result.sessionComplete || !result.nextQuestion),
      });
      setNextPreview('');
      setStatusMessage('');
      setVoiceStatus('Review feedback, then continue.');

      if (voiceMode && result.lastEvaluation?.feedback) {
        try {
          await speakText(`Feedback. ${result.lastEvaluation.feedback}`, {
            language: interviewLanguage,
          });
        } catch {
          // ignore
        }
      }
    } catch (err) {
      setError(err.message);
      setStatusMessage('');
    } finally {
      setSubmitting(false);
    }
  }

  function onRetry() {
    stopSpeaking();
    setPhase('answering');
    setEvaluation(null);
    setPendingNext(null);
    setNextPreview('');
    setShowIdeal(false);
    setRetryActive(true);
    setAnswer(submittedAnswer || '');
    setError('');
    setStatusMessage('');
    setVoiceStatus(voiceMode ? 'Try the same question again…' : '');
  }

  async function onNextQuestion() {
    if (!pendingNext) return;
    stopSpeaking();

    if (pendingNext.sessionComplete) {
      setFinishing(true);
      setVoiceStatus('Round complete — generating your report…');
      try {
        await finishAndReport();
      } catch (err) {
        setError(err.message);
        setFinishing(false);
      }
      return;
    }

    setQuestion(pendingNext.nextQuestion);
    setIsFollowUp(pendingNext.isFollowUp);
    setEvaluation(null);
    setSubmittedAnswer('');
    setAnswer('');
    setPendingNext(null);
    setShowIdeal(false);
    setRetryActive(false);
    setPhase('answering');
    setError('');
    setVoiceStatus(pendingNext.isFollowUp ? 'Follow-up question…' : '');
  }

  async function onFinish() {
    stopSpeaking();
    recorderRef.current?.stop?.();
    setFinishing(true);
    setError('');
    try {
      await finishAndReport();
    } catch (err) {
      setError(err.message);
      setFinishing(false);
    }
  }

  async function onRunCode() {
    setRunning(true);
    setRunOutput(null);
    setError('');
    try {
      const result = await api.runCode({ code: answer, language: 'javascript' });
      setRunOutput(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  }

  async function speakQuestionAgain() {
    if (!question || phase !== 'answering') return;
    try {
      setError('');
      setSpeaking(true);
      setVoiceStatus('Interviewer is speaking…');
      await speakText(question, { language: interviewLanguage });
      setVoiceStatus('Your turn — tap Record answer when ready.');
    } catch {
      setVoiceStatus('Could not speak this question. You can still read and answer.');
    } finally {
      setSpeaking(false);
    }
  }

  async function toggleRecording() {
    if (listening && recorderRef.current) {
      recorderRef.current.stop();
      return;
    }

    setError('');
    setVoiceStatus('Listening… speak your answer, then tap Stop.');
    try {
      const session = await recordAudioChunk({
        maxMs: 90000,
        onStart: ({ stop }) => {
          recorderRef.current = { stop };
          setListening(true);
        },
      });

      const blob = await session.done;
      recorderRef.current = null;
      setListening(false);

      if (!blob.size) {
        setError('No audio captured. Check your microphone and try again.');
        setVoiceStatus('');
        return;
      }

      setTranscribing(true);
      setVoiceStatus('Transcribing your answer…');
      const { text } = await api.transcribeAudio(blob, interviewLanguage);
      setAnswer((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
      setVoiceStatus('Transcript ready — edit if needed, then submit.');
    } catch (err) {
      setListening(false);
      recorderRef.current = null;
      setError(err.message || 'Voice capture failed');
      setVoiceStatus('');
    } finally {
      setTranscribing(false);
    }
  }

  if (loadingSession) return <Loading label="Opening session…" />;

  if (!question && !streamPreview) {
    return (
      <Page>
        <Alert>{error || 'No question loaded.'}</Alert>
        <Link to="/session/new">
          <Button className="mt-4">New session</Button>
        </Link>
      </Page>
    );
  }

  const isCoding = mode === 'coding';
  const hasStar =
    evaluation &&
    [evaluation.starSituation, evaluation.starTask, evaluation.starAction, evaluation.starResult].some(
      (v) => v != null,
    );
  const showingFeedback = phase === 'feedback' && evaluation;
  const displayQuestion = question || streamPreview;

  return (
    <Page>
      <PageHeader
        eyebrow={voiceMode ? 'Voice interview' : mode || 'Interview'}
        title="In session"
        subtitle={
          showingFeedback
            ? `Feedback for question ${Math.min(answeredCount, plannedCount)} of ${plannedCount}`
            : `Question ${Math.min(answeredCount + 1, plannedCount)} of ${plannedCount}${isFollowUp ? ' · follow-up' : ''}`
        }
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                stopSpeaking();
                setVoiceMode((v) => !v);
              }}
            >
              {voiceMode ? 'Switch to text' : 'Switch to voice'}
            </Button>
            <Button variant="ghost" onClick={onFinish} disabled={finishing || submitting}>
              {finishing ? 'Wrapping up…' : 'Finish early'}
            </Button>
          </div>
        }
      />

      {voiceMode && phase === 'answering' && (
        <Panel className="space-y-3">
          <p className="text-sm text-[var(--color-muted)]">
            {voiceStatus ||
              (canUseSpeechSynthesis()
                ? 'Soft girl interviewer voice on — calm and clear.'
                : 'This browser cannot speak questions aloud, but you can still record answers.')}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={speakQuestionAgain} disabled={speaking || listening || submitting}>
              {speaking ? 'Speaking…' : 'Replay question'}
            </Button>
            <Button onClick={toggleRecording} disabled={speaking || transcribing || submitting || isCoding}>
              {listening ? 'Stop recording' : transcribing ? 'Transcribing…' : 'Record answer'}
            </Button>
            {listening && (
              <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-danger)]">
                <span className="loading-dot h-2.5 w-2.5 rounded-full bg-[var(--color-danger)]" />
                Listening
              </span>
            )}
          </div>
        </Panel>
      )}

      <Panel className="animate-rise space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-leaf)]">
            {isFollowUp ? 'Follow-up' : 'Question'}
          </p>
          <p className="mt-3 whitespace-pre-wrap font-display text-xl leading-snug text-[var(--color-ink)] sm:text-2xl">
            {displayQuestion}
          </p>
        </div>

        {phase === 'answering' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitAnswer({ isRetry: retryActive });
            }}
            className="space-y-4"
          >
            <Field
              label={
                isCoding
                  ? 'Your solution (JavaScript)'
                  : voiceMode
                    ? 'Your answer (editable transcript)'
                    : 'Your answer'
              }
            >
              <textarea
                className={`field-input min-h-44 text-sm ${isCoding ? 'font-mono' : ''}`}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder={
                  isCoding
                    ? '// Write your solution…'
                    : voiceMode
                      ? 'Record your answer, or type here…'
                      : 'Type your answer…'
                }
                required
              />
            </Field>

            <div className="flex flex-wrap gap-3">
              {isCoding && (
                <Button type="button" variant="ghost" onClick={onRunCode} disabled={running || !answer.trim()}>
                  {running ? 'Running…' : 'Run code'}
                </Button>
              )}
              <Button type="submit" disabled={submitting || !answer.trim() || listening || transcribing}>
                {submitting ? 'Evaluating…' : retryActive ? 'Resubmit improved answer' : 'Submit answer'}
              </Button>
            </div>

            {runOutput && (
              <div className="rounded-xl bg-[var(--color-ink)] p-4 font-mono text-xs text-[var(--color-fog)]">
                {runOutput.error ? (
                  <pre className="whitespace-pre-wrap text-red-300">{runOutput.error}</pre>
                ) : (
                  <>
                    {runOutput.stdout && (
                      <pre className="mb-2 whitespace-pre-wrap opacity-90">{runOutput.stdout}</pre>
                    )}
                    <pre className="whitespace-pre-wrap">{runOutput.result ?? '(no return value)'}</pre>
                  </>
                )}
              </div>
            )}

            {submitting && <Loading label={statusMessage || 'Scoring content, STAR, and delivery…'} />}
          </form>
        )}

        {showingFeedback && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold">Your answer</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-muted)]">
                {submittedAnswer}
              </p>
            </div>

            <div className="border-t border-[var(--color-line)] pt-4 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
                Feedback
              </p>
              <ScoreGrid evaluation={evaluation} />
              {hasStar && (
                <div className="grid gap-2 rounded-xl bg-[var(--color-fog)] p-3 sm:grid-cols-2">
                  <p className="sm:col-span-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-leaf)]">
                    STAR breakdown
                  </p>
                  <StarRow label="Situation" value={evaluation.starSituation} />
                  <StarRow label="Task" value={evaluation.starTask} />
                  <StarRow label="Action" value={evaluation.starAction} />
                  <StarRow label="Result" value={evaluation.starResult} />
                </div>
              )}
              {(evaluation.wordsPerMinute != null || evaluation.fillerWordCount != null) && (
                <div className="flex flex-wrap gap-3 text-xs text-[var(--color-muted)]">
                  {evaluation.wordsPerMinute != null && (
                    <span>Pace ~{evaluation.wordsPerMinute} WPM</span>
                  )}
                  {evaluation.fillerWordCount != null && (
                    <span>Fillers: {evaluation.fillerWordCount}</span>
                  )}
                  {evaluation.wordCount != null && <span>Words: {evaluation.wordCount}</span>}
                </div>
              )}
              <p className="text-sm leading-relaxed">
                <span className="font-semibold">Feedback: </span>
                {evaluation.feedback}
              </p>
              {evaluation.missingPoints?.length > 0 && (
                <div>
                  <p className="text-sm font-semibold">What was missing</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[var(--color-muted)]">
                    {evaluation.missingPoints.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </div>
              )}
              {evaluation.conceptExplanation && (
                <div className="rounded-xl bg-[var(--color-fog)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-leaf)]">
                    Learn this properly
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-ink)]">
                    {evaluation.conceptExplanation}
                  </p>
                </div>
              )}
              {evaluation.improvedAnswer && (
                <div>
                  <p className="text-sm font-semibold">Stronger version of your answer</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-muted)]">
                    {evaluation.improvedAnswer}
                  </p>
                </div>
              )}
              {evaluation.idealAnswer && (
                <div>
                  <button
                    type="button"
                    className="text-sm font-semibold text-[var(--color-leaf-deep)] underline-offset-2 hover:underline"
                    onClick={() => setShowIdeal((v) => !v)}
                  >
                    {showIdeal ? 'Hide full model interview answer' : 'Show full model interview answer'}
                  </button>
                  {showIdeal && (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-muted)]">
                      {evaluation.idealAnswer}
                    </p>
                  )}
                </div>
              )}
              {evaluation.studyTips?.length > 0 && (
                <div>
                  <p className="text-sm font-semibold">Practice next</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[var(--color-muted)]">
                    {evaluation.studyTips.map((tip) => (
                      <li key={tip}>{tip}</li>
                    ))}
                  </ul>
                </div>
              )}
              {nextPreview && !pendingNext?.nextQuestion && (
                <p className="text-xs text-[var(--color-muted)]">
                  Next question drafting… {nextPreview.slice(0, 80)}
                  {nextPreview.length > 80 ? '…' : ''}
                </p>
              )}
              {statusMessage && submitting && (
                <p className="text-xs text-[var(--color-muted)]">{statusMessage}</p>
              )}
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button onClick={onNextQuestion} disabled={finishing || (!pendingNext && submitting)}>
                {pendingNext?.sessionComplete
                  ? finishing
                    ? 'Opening report…'
                    : 'See full report'
                  : pendingNext?.isFollowUp
                    ? 'Next: follow-up question'
                    : 'Next question'}
              </Button>
              <Button variant="ghost" onClick={onRetry} disabled={finishing || submitting}>
                Try this question again
              </Button>
              <Button variant="ghost" onClick={onFinish} disabled={finishing}>
                Finish early
              </Button>
            </div>
          </div>
        )}

        {error && <Alert>{error}</Alert>}
      </Panel>
    </Page>
  );
}
