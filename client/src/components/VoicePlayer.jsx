import { Button } from './ui.jsx';

/**
 * Speaking indicator + optional sentence highlight + replay.
 */
export function VoicePlayer({
  speaking = false,
  status = '',
  spokenText = '',
  sentences = [],
  activeSentenceIndex = -1,
  onReplay,
  onRecord,
  listening = false,
  transcribing = false,
  recordDisabled = false,
  replayDisabled = false,
  error = '',
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-line)] ${
            speaking
              ? 'bg-[color-mix(in_srgb,var(--color-amber)_12%,white)]'
              : 'bg-[var(--color-mist)]'
          }`}
          aria-hidden
        >
          <span
            className={`h-2.5 w-2.5 rounded-full bg-[var(--color-amber)] ${
              speaking ? 'loading-dot' : ''
            }`}
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--color-ink)]">
            {speaking ? 'Emma is speaking' : 'Emma · interviewer'}
          </p>
          <p className="text-xs text-[var(--color-muted)]">
            {status ||
              (speaking
                ? 'Natural AI voice · Orpheus'
                : 'Calm senior engineer voice — tap replay anytime.')}
          </p>
        </div>
      </div>

      {sentences?.length > 0 && speaking && (
        <div className="space-y-1.5 rounded-[12px] bg-[var(--color-mist)] px-3 py-2.5">
          {sentences.map((line, i) => (
            <p
              key={`${i}-${line.slice(0, 24)}`}
              className={`text-sm leading-relaxed transition-opacity duration-200 ${
                i === activeSentenceIndex
                  ? 'font-medium text-[var(--color-ink)] opacity-100'
                  : 'text-[var(--color-muted)] opacity-55'
              }`}
            >
              {line}
            </p>
          ))}
        </div>
      )}

      {!speaking && spokenText && !sentences?.length && (
        <p className="text-xs leading-relaxed text-[var(--color-muted)] line-clamp-3">{spokenText}</p>
      )}

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {onReplay && (
          <Button variant="ghost" onClick={onReplay} disabled={replayDisabled || speaking}>
            {speaking ? 'Speaking…' : 'Replay question'}
          </Button>
        )}
        {onRecord && (
          <Button onClick={onRecord} disabled={recordDisabled || speaking || transcribing}>
            {listening ? 'Stop recording' : transcribing ? 'Transcribing…' : 'Record answer'}
          </Button>
        )}
        {listening && (
          <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-danger)]">
            <span className="loading-dot h-2.5 w-2.5 rounded-full bg-[var(--color-danger)]" />
            Recording
          </span>
        )}
      </div>
    </div>
  );
}

export default VoicePlayer;
