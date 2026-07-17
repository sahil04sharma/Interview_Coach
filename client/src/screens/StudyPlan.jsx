import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Alert, Button, Loading, Page, PageHeader, Panel } from '../components/ui.jsx';

export default function StudyPlan() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getStudyPlan();
        if (!cancelled) setData(res);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <Loading label="Loading study plan…" />;
  if (error) return <Alert>{error}</Alert>;

  const active = data?.active;
  const items = Array.isArray(active?.items) ? active.items : [];

  return (
    <Page>
      <PageHeader
        eyebrow="Study"
        title="Study plan"
        subtitle="A focused plan for tomorrow built from your latest interview gaps."
        action={
          <Link to="/session/new">
            <Button>Start practice</Button>
          </Link>
        }
      />

      {!active ? (
        <Panel>
          <p className="text-sm text-[var(--color-muted)]">
            No active study plan yet. Finish an interview session and we will generate tomorrow&apos;s
            plan from your weaknesses and missed concepts.
          </p>
          <div className="mt-4">
            <Link to="/session/new">
              <Button>Run a mock interview</Button>
            </Link>
          </div>
        </Panel>
      ) : (
        <>
          <Panel className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-semibold">{active.title}</h2>
                <p className="mt-1 text-sm text-[var(--color-muted)]">{active.summary}</p>
              </div>
              <div className="text-right text-sm text-[var(--color-muted)]">
                <p className="font-semibold tabular-nums text-[var(--color-ink)]">
                  ~{active.estimatedMinutes} min
                </p>
                {active.readinessScore != null && (
                  <p>Readiness {active.readinessScore}/10</p>
                )}
              </div>
            </div>
          </Panel>

          <div className="space-y-4">
            {items
              .slice()
              .sort((a, b) => (a.priority || 0) - (b.priority || 0))
              .map((item, idx) => (
                <Panel key={`${item.concept}-${idx}`} className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-leaf)]">
                        Priority {item.priority || idx + 1}
                      </p>
                      <h3 className="font-display text-lg font-semibold">
                        {item.slug ? (
                          <Link to={`/knowledge/${item.slug}`} className="hover:text-[var(--color-amber)]">
                            {item.concept}
                          </Link>
                        ) : (
                          item.concept
                        )}
                      </h3>
                    </div>
                    <span className="text-xs tabular-nums text-[var(--color-muted)]">
                      {item.estimatedMinutes || 20} min
                    </span>
                  </div>
                  {item.explanation && (
                    <p className="text-sm leading-relaxed text-[var(--color-ink)]">{item.explanation}</p>
                  )}
                  {item.revisionNotes && (
                    <p className="text-sm text-[var(--color-muted)]">
                      <span className="font-semibold text-[var(--color-ink)]">Revise: </span>
                      {item.revisionNotes}
                    </p>
                  )}
                  {item.practiceQuestions?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold">Practice out loud</h4>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[var(--color-muted)]">
                        {item.practiceQuestions.map((q) => (
                          <li key={q}>{q}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {item.retryInterviewAngle && (
                    <p className="text-sm text-[var(--color-muted)]">
                      <span className="font-semibold text-[var(--color-ink)]">Interview angle: </span>
                      {item.retryInterviewAngle}
                    </p>
                  )}
                </Panel>
              ))}
          </div>
        </>
      )}

      {data?.recent?.length > 1 && (
        <Panel className="space-y-2">
          <h2 className="text-sm font-semibold">Earlier plans</h2>
          {data.recent
            .filter((p) => p.id !== active?.id)
            .map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between border-t border-[var(--color-line)] pt-2 text-sm first:border-0 first:pt-0"
              >
                <span>{p.title}</span>
                <span className="text-xs text-[var(--color-muted)]">
                  {new Date(p.createdAt).toLocaleDateString()} · {p.status}
                </span>
              </div>
            ))}
        </Panel>
      )}
    </Page>
  );
}
