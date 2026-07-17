export function Page({ children, className = '' }) {
  return <div className={`animate-rise space-y-6 ${className}`}>{children}</div>;
}

export function PageHeader({ eyebrow, title, subtitle, action }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-leaf)]">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-3xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--color-muted)]">
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export function Panel({ children, className = '' }) {
  return <div className={`glass-panel rounded-[12px] p-5 sm:p-6 ${className}`}>{children}</div>;
}

export function Button({
  children,
  variant = 'primary',
  className = '',
  type = 'button',
  ...props
}) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-[12px] px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed';
  const styles = variant === 'primary' ? 'btn-primary' : 'btn-ghost';
  return (
    <button type={type} className={`${base} ${styles} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold text-[var(--color-ink)]">{label}</span>
      {children}
      {hint && <span className="block text-xs text-[var(--color-muted)]">{hint}</span>}
    </label>
  );
}

export function Alert({ tone = 'danger', children }) {
  const styles =
    tone === 'ok'
      ? 'border-[color-mix(in_srgb,var(--color-ok)_35%,var(--color-line))] bg-[color-mix(in_srgb,var(--color-ok)_8%,white)] text-[var(--color-ok)]'
      : 'border-[color-mix(in_srgb,var(--color-danger)_35%,var(--color-line))] bg-[color-mix(in_srgb,var(--color-danger)_8%,white)] text-[var(--color-danger)]';
  return (
    <div className={`rounded-[12px] border px-3.5 py-3 text-sm leading-relaxed ${styles}`}>
      {children}
    </div>
  );
}

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="flex items-center gap-3 text-sm text-[var(--color-muted)]">
      <span className="loading-dot inline-block h-2 w-2 rounded-full bg-[var(--color-leaf)]" />
      {label}
    </div>
  );
}

export function TopicCloud({ title, topics, empty, tone = 'weak' }) {
  const chip =
    tone === 'strong'
      ? 'bg-[color-mix(in_srgb,var(--color-ok)_10%,white)] text-[var(--color-ok)] border border-[color-mix(in_srgb,var(--color-ok)_25%,var(--color-line))]'
      : 'bg-[var(--color-mist)] text-[var(--color-ink)] border border-[var(--color-line)]';
  return (
    <div>
      <h2 className="text-sm font-semibold text-[var(--color-ink)]">{title}</h2>
      <div className="mt-2 flex flex-wrap gap-2">
        {topics?.length ? (
          topics.map((t) => (
            <span key={t} className={`rounded-[10px] px-3 py-1 text-xs font-medium ${chip}`}>
              {t}
            </span>
          ))
        ) : (
          <p className="text-sm text-[var(--color-muted)]">{empty}</p>
        )}
      </div>
    </div>
  );
}

export function ScoreGrid({ evaluation }) {
  const items = [
    ['Technical', evaluation.technicalScore],
    ['Communication', evaluation.communicationScore],
    ['Depth', evaluation.depthScore],
    ['Structure', evaluation.structureScore],
  ];
  if (evaluation.accuracyScore != null) items.push(['Accuracy', evaluation.accuracyScore]);
  if (evaluation.confidenceScore != null) items.push(['Confidence', evaluation.confidenceScore]);
  if (evaluation.problemSolvingScore != null) {
    items.push(['Problem solving', evaluation.problemSolvingScore]);
  }
  if (evaluation.practicalScore != null) items.push(['Practical', evaluation.practicalScore]);
  if (evaluation.productionThinking != null) {
    items.push(['Production', evaluation.productionThinking]);
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div
          key={label}
          className="flex items-center justify-between rounded-[12px] bg-[var(--color-fog)] px-3 py-2 text-sm"
        >
          <span className="text-[var(--color-muted)]">{label}</span>
          <span className="font-semibold tabular-nums">{value}/10</span>
        </div>
      ))}
    </div>
  );
}

export function StatusBadge({ status }) {
  const styles = {
    weak: 'bg-[color-mix(in_srgb,var(--color-danger)_10%,white)] text-[var(--color-danger)]',
    learning: 'bg-[color-mix(in_srgb,var(--color-amber)_12%,white)] text-[var(--color-amber-deep)]',
    strong: 'bg-[color-mix(in_srgb,var(--color-ok)_10%,white)] text-[var(--color-ok)]',
    mastered: 'bg-[color-mix(in_srgb,var(--color-ok)_16%,white)] text-[var(--color-ok)]',
  };
  return (
    <span
      className={`inline-flex rounded-[10px] px-2 py-0.5 text-xs font-semibold capitalize ${
        styles[status] || styles.learning
      }`}
    >
      {status || 'unknown'}
    </span>
  );
}
