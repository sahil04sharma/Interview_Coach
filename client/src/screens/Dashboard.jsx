import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Alert, Button, Loading, Page, PageHeader, Panel } from '../components/ui.jsx';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [statsRes, sessionsRes] = await Promise.all([api.getStats(), api.listSessions()]);
        if (cancelled) return;
        setStats(statsRes);
        setSessions(sessionsRes.slice(0, 5));
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

  if (loading) return <Loading label="Loading your workspace…" />;

  const needsSetup = !user?.resumeText?.trim() || !user?.targetRole?.trim();
  const resumable = sessions.find((s) => s.resumable);

  return (
    <Page>
      <PageHeader
        eyebrow="Your booth"
        title={`Welcome back${user?.name ? `, ${user.name.split(' ')[0]}` : ''}`}
        subtitle="Step in and rehearse — built for global roles and Indian hiring styles."
        action={
          <Link to="/session/new">
            <Button>Start a rehearsal</Button>
          </Link>
        }
      />

      {error && <Alert>{error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-3">
        <Panel>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
            Sessions
          </p>
          <p className="mt-2 font-display text-4xl font-semibold">{stats?.sessionCount ?? 0}</p>
        </Panel>
        <Panel>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
            Avg score
          </p>
          <p className="mt-2 font-display text-4xl font-semibold">{stats?.averageScore ?? '—'}</p>
        </Panel>
        <Panel>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
            Plan
          </p>
          <p className="mt-2 font-display text-3xl font-semibold capitalize">{user?.plan || 'free'}</p>
          <Link to="/pricing" className="mt-2 inline-block text-xs font-semibold text-[var(--color-amber)] underline-offset-2 hover:underline">
            Compare plans
          </Link>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)] lg:items-start">
        <div className="space-y-4">
          {resumable && (
            <Panel className="border-[color-mix(in_srgb,var(--color-amber)_45%,var(--color-line))]">
              <p className="text-sm font-semibold">Resume unfinished rehearsal</p>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                You have an in-progress {resumable.mode} round ({resumable.questionCount}/
                {resumable.plannedCount || '?'} answered).
              </p>
              <Link to={`/session/${resumable.id}`} className="mt-3 inline-block">
                <Button>Continue interview</Button>
              </Link>
            </Panel>
          )}

          {needsSetup && (
            <Panel className="border-[color-mix(in_srgb,var(--color-amber)_45%,var(--color-line))]">
              <p className="text-sm font-semibold">Finish onboarding</p>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                Add your resume and target role so questions match what you are actually applying for.
              </p>
              <Link to="/setup" className="mt-3 inline-block">
                <Button variant="ghost">Complete setup</Button>
              </Link>
            </Panel>
          )}

          <Panel>
            <h2 className="font-display text-xl font-semibold">Quick actions</h2>
            <div className="mt-4 flex flex-col gap-2">
              <Link to="/session/new"><Button className="w-full">New interview round</Button></Link>
              <Link to="/progress"><Button variant="ghost" className="w-full">View progress</Button></Link>
              <Link to="/history"><Button variant="ghost" className="w-full">Session history</Button></Link>
              <Link to="/settings"><Button variant="ghost" className="w-full">Settings</Button></Link>
            </div>
          </Panel>
        </div>

        <Panel>
          <h2 className="font-display text-xl font-semibold">Recent sessions</h2>
          <div className="mt-4 space-y-3">
            {sessions.length === 0 && (
              <p className="text-sm text-[var(--color-muted)]">Empty booth. Start your first rehearsal.</p>
            )}
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 border-b border-[var(--color-line)] pb-3 text-sm last:border-0 last:pb-0">
                <div>
                  <p className="font-medium capitalize">
                    {s.companyStyle} · {s.mode}
                  </p>
                  <p className="text-xs text-[var(--color-muted)]">
                    {s.finished ? s.hiringVerdict || 'Finished' : s.resumable ? 'In progress' : 'In progress'}
                    {s.overallScore != null ? ` · ${s.overallScore}` : ''}
                  </p>
                </div>
                {s.finished ? (
                  <Link
                    to={`/session/${s.id}/report`}
                    className="text-xs font-semibold text-[var(--color-amber)] underline-offset-2 hover:underline"
                  >
                    Report
                  </Link>
                ) : s.resumable ? (
                  <Link
                    to={`/session/${s.id}`}
                    className="text-xs font-semibold text-[var(--color-amber)] underline-offset-2 hover:underline"
                  >
                    Resume
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </Page>
  );
}
