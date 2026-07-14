import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Alert, Button, Loading, Page, PageHeader, Panel } from '../components/ui.jsx';

function formatDate(value) {
  try {
    return new Date(value).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

export default function History() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.listSessions();
        if (!cancelled) setSessions(data);
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

  if (loading) return <Loading label="Loading history…" />;

  return (
    <Page>
      <PageHeader
        eyebrow="Archive"
        title="Session history"
        subtitle="Revisit finished interviews and continue where you left unfinished ones."
        action={
          <Link to="/session/new">
            <Button>New session</Button>
          </Link>
        }
      />

      {error && <Alert>{error}</Alert>}

      {!error && sessions.length === 0 && (
        <Panel>
          <p className="text-sm text-[var(--color-muted)]">
            No sessions yet. Start your first practice round.
          </p>
        </Panel>
      )}

      <div className="space-y-3">
        {sessions.map((s) => (
          <Panel key={s.id} className="!p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-display text-lg font-semibold capitalize">
                  {s.companyStyle}
                  <span className="mx-2 text-[var(--color-line)]">·</span>
                  <span className="text-base font-medium text-[var(--color-muted)]">{s.mode}</span>
                </p>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  {formatDate(s.createdAt)} · {s.questionCount} answered
                  {s.finished ? ` · ${s.hiringVerdict}` : ' · in progress'}
                  {s.overallScore != null ? ` · score ${s.overallScore}` : ''}
                </p>
              </div>
              <Link to={s.finished ? `/session/${s.id}/report` : s.resumable ? `/session/${s.id}` : '/session/new'}>
                <Button variant="ghost" className="!py-2">
                  {s.finished ? 'View report' : s.resumable ? 'Resume' : 'Start fresh'}
                </Button>
              </Link>
            </div>
          </Panel>
        ))}
      </div>
    </Page>
  );
}
