import { StatusBadge } from './ui.jsx';

function confidenceLabel(confidence) {
  const c = Number(confidence);
  if (Number.isNaN(c)) return 'unknown';
  if (c >= 0.7) return 'high confidence';
  if (c >= 0.4) return 'moderate confidence';
  return 'low confidence';
}

function hypothesisStatusTone(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'supported' || s === 'confirmed') return 'ok';
  if (s === 'refuted') return 'danger';
  return 'muted';
}

/**
 * Progressive-disclosure intelligence section for the session report.
 * Renders nothing when there is no V2 data.
 */
export function IntelligencePanel({ cognitive, hypotheses }) {
  if (!cognitive && !hypotheses) return null;

  const dimensions = cognitive?.dimensions || [];
  const dimensionReport = cognitive?.dimensionReport || [];
  const concepts = (cognitive?.concepts || [])
    .filter((c) => c.status === 'weak' || c.neighborhoodInfluence)
    .slice(0, 8);
  const hypothesisList = hypotheses?.hypotheses || [];
  const misconceptions = hypotheses?.misconceptions || cognitive?.misconceptions || [];
  const resumeClaims = hypotheses?.resumeClaims || [];

  const scoredDimensions = dimensions
    .filter((d) => d.score != null && Number(d.confidence) > 0)
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, 8);

  const hasV2Signal =
    dimensionReport.length > 0 ||
    hypothesisList.length > 0 ||
    misconceptions.length > 0 ||
    resumeClaims.length > 0 ||
    (cognitive?.enabled && (scoredDimensions.length > 0 || concepts.length > 0));

  if (!hasV2Signal) return null;

  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-leaf)]">
          Interview intelligence
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold">Why this verdict</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Evidence-backed beliefs from this session — open a section to see the chain.
        </p>
      </div>

      {scoredDimensions.length > 0 && (
        <details className="group rounded-[18px] border border-[var(--color-line)] bg-[var(--color-booth)] p-4 open:shadow-[0_8px_24px_rgba(26,26,26,0.04)]">
          <summary className="cursor-pointer list-none font-display text-lg font-semibold marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="flex items-center justify-between gap-3">
              Dimension confidence
              <span className="text-xs font-medium text-[var(--color-muted)] group-open:hidden">
                Show
              </span>
              <span className="hidden text-xs font-medium text-[var(--color-muted)] group-open:inline">
                Hide
              </span>
            </span>
          </summary>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {scoredDimensions.map((d) => (
              <div
                key={d.key}
                className="rounded-[12px] bg-[var(--color-fog)] px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium capitalize text-[var(--color-ink)]">
                    {d.key.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                  <span className="font-semibold tabular-nums text-sm">
                    {d.score}/10
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  {confidenceLabel(d.confidence)} · {d.verification}
                  {d.trend && d.trend !== 'unknown' ? ` · ${d.trend}` : ''}
                </p>
              </div>
            ))}
          </div>
        </details>
      )}

      {dimensionReport.length > 0 && (
        <details className="group rounded-[18px] border border-[var(--color-line)] bg-[var(--color-booth)] p-4" open>
          <summary className="cursor-pointer list-none font-display text-lg font-semibold marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="flex items-center justify-between gap-3">
              Dimension narratives
              <span className="text-xs font-medium text-[var(--color-muted)] group-open:hidden">
                Show
              </span>
              <span className="hidden text-xs font-medium text-[var(--color-muted)] group-open:inline">
                Hide
              </span>
            </span>
          </summary>
          <div className="mt-4 space-y-3">
            {dimensionReport.map((item) => (
              <div key={item.dimension} className="rounded-[12px] bg-[var(--color-fog)] p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold capitalize text-[var(--color-ink)]">
                    {item.dimension}
                  </p>
                  <p className="text-xs tabular-nums text-[var(--color-muted)]">
                    {item.score != null ? `${item.score}/10` : ''}
                    {item.confidence != null
                      ? ` · ${Math.round(item.confidence * 100)}% sure`
                      : ''}
                  </p>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
                  {item.narrative}
                </p>
              </div>
            ))}
          </div>
        </details>
      )}

      {hypothesisList.length > 0 && (
        <details className="group rounded-[18px] border border-[var(--color-line)] bg-[var(--color-booth)] p-4">
          <summary className="cursor-pointer list-none font-display text-lg font-semibold marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="flex items-center justify-between gap-3">
              Hypotheses ({hypothesisList.length})
              <span className="text-xs font-medium text-[var(--color-muted)] group-open:hidden">
                Show
              </span>
              <span className="hidden text-xs font-medium text-[var(--color-muted)] group-open:inline">
                Hide
              </span>
            </span>
          </summary>
          <ul className="mt-4 space-y-3">
            {hypothesisList.map((h) => (
              <li key={h.id} className="rounded-[12px] bg-[var(--color-fog)] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-[10px] px-2 py-0.5 text-xs font-semibold capitalize ${
                      hypothesisStatusTone(h.status) === 'ok'
                        ? 'bg-[color-mix(in_srgb,var(--color-ok)_12%,white)] text-[var(--color-ok)]'
                        : hypothesisStatusTone(h.status) === 'danger'
                          ? 'bg-[color-mix(in_srgb,var(--color-danger)_10%,white)] text-[var(--color-danger)]'
                          : 'bg-white text-[var(--color-muted)]'
                    }`}
                  >
                    {h.status}
                  </span>
                  <span className="text-xs text-[var(--color-muted)]">
                    {Math.round((h.confidence || 0) * 100)}% · {h.origin}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[var(--color-ink)]">{h.statement}</p>
                {h.conceptSlugs?.length > 0 && (
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    {h.conceptSlugs.join(', ')}
                  </p>
                )}
                {h.evidence?.length > 0 && (
                  <ul className="mt-2 space-y-1 border-t border-[var(--color-line)] pt-2">
                    {h.evidence.slice(0, 3).map((e) => (
                      <li key={e.id} className="text-xs text-[var(--color-muted)]">
                        <span className="font-medium text-[var(--color-ink)]">
                          Turn {e.turn} · {e.polarity}:
                        </span>{' '}
                        {e.observation}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      {misconceptions.length > 0 && (
        <details className="group rounded-[18px] border border-[var(--color-line)] bg-[var(--color-booth)] p-4" open>
          <summary className="cursor-pointer list-none font-display text-lg font-semibold marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="flex items-center justify-between gap-3">
              Misconceptions ({misconceptions.length})
              <span className="text-xs font-medium text-[var(--color-muted)] group-open:hidden">
                Show
              </span>
              <span className="hidden text-xs font-medium text-[var(--color-muted)] group-open:inline">
                Hide
              </span>
            </span>
          </summary>
          <ul className="mt-4 space-y-3">
            {misconceptions.map((m, i) => (
              <li
                key={m.id || `${m.conceptSlug}-${i}`}
                className="rounded-[12px] border border-[color-mix(in_srgb,var(--color-danger)_18%,var(--color-line))] bg-[color-mix(in_srgb,var(--color-danger)_4%,white)] p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-[var(--color-danger)]">
                    {m.conceptSlug}
                  </span>
                  <span className="rounded-[10px] bg-white px-2 py-0.5 text-xs font-semibold capitalize text-[var(--color-muted)]">
                    {m.status || 'suspected'}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[var(--color-ink)]">
                  {m.statement || m.summary}
                </p>
                {m.correctStatement && (
                  <p className="mt-1 text-sm text-[var(--color-muted)]">
                    <span className="font-semibold text-[var(--color-ink)]">Better: </span>
                    {m.correctStatement}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      {concepts.length > 0 && (
        <details className="group rounded-[18px] border border-[var(--color-line)] bg-[var(--color-booth)] p-4">
          <summary className="cursor-pointer list-none font-display text-lg font-semibold marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="flex items-center justify-between gap-3">
              Concept beliefs
              <span className="text-xs font-medium text-[var(--color-muted)] group-open:hidden">
                Show
              </span>
              <span className="hidden text-xs font-medium text-[var(--color-muted)] group-open:inline">
                Hide
              </span>
            </span>
          </summary>
          <ul className="mt-4 space-y-2">
            {concepts.map((c) => (
              <li
                key={c.conceptSlug}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] bg-[var(--color-fog)] px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{c.conceptSlug}</span>
                  <StatusBadge status={c.status} />
                </div>
                <p className="text-xs tabular-nums text-[var(--color-muted)]">
                  {c.score != null ? `${c.score}/10` : '—'}
                  {c.neighborhoodInfluence
                    ? ` · graph ${c.neighborhoodInfluence > 0 ? '+' : ''}${Number(c.neighborhoodInfluence).toFixed(2)}`
                    : ''}
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}

      {resumeClaims.length > 0 && (
        <details className="group rounded-[18px] border border-[var(--color-line)] bg-[var(--color-booth)] p-4">
          <summary className="cursor-pointer list-none font-display text-lg font-semibold marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="flex items-center justify-between gap-3">
              Resume claims ({resumeClaims.length})
              <span className="text-xs font-medium text-[var(--color-muted)] group-open:hidden">
                Show
              </span>
              <span className="hidden text-xs font-medium text-[var(--color-muted)] group-open:inline">
                Hide
              </span>
            </span>
          </summary>
          <ul className="mt-4 space-y-2">
            {resumeClaims.map((c) => (
              <li key={c.id} className="rounded-[12px] bg-[var(--color-fog)] px-3 py-2">
                <p className="text-sm text-[var(--color-ink)]">{c.claim}</p>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  {c.verification} · {c.importance}
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
