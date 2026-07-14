import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { API_BASE } from '../config.js';
import { Alert, Button, Loading, Page, PageHeader, Panel, ScoreGrid } from '../components/ui.jsx';

export default function SharedReport() {
  const { token } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/public/report/${token}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Report not found');
        if (!cancelled) setReport(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) return <Loading label="Loading shared report…" />;
  if (error) {
    return (
      <Page>
        <Alert>{error}</Alert>
        <Link to="/" className="mt-4 inline-block"><Button>Go home</Button></Link>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        eyebrow="Shared report"
        title={`${report.candidateName}'s interview report`}
        subtitle={`${report.companyStyle} · ${report.mode} · ${report.interviewLanguage || 'english'}`}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Panel>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
            Overall score
          </p>
          <p className="mt-2 font-display text-5xl font-semibold">{report.overallScore ?? '—'}</p>
        </Panel>
        <Panel>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
            Hiring verdict
          </p>
          <p className="mt-2 font-display text-2xl font-semibold">{report.hiringVerdict}</p>
          {report.targetRole && (
            <p className="mt-2 text-sm text-[var(--color-muted)]">Target role: {report.targetRole}</p>
          )}
        </Panel>
      </div>

      <div className="space-y-4">
        {report.questions?.map((q, i) => (
          <Panel key={`${i}-${q.questionText.slice(0, 12)}`} className="space-y-2">
            <p className="text-sm font-semibold">
              {q.isFollowUp ? 'Follow-up' : `Q${i + 1}`}. {q.questionText}
            </p>
            <p className="text-sm text-[var(--color-muted)]">{q.userAnswer}</p>
            <ScoreGrid evaluation={q} />
            <p className="text-sm"><span className="font-semibold">Feedback: </span>{q.feedback}</p>
          </Panel>
        ))}
      </div>

      <p className="text-xs text-[var(--color-muted)]">
        Shared via Interview Grove — <Link to="/" className="underline">try it yourself</Link>
      </p>
    </Page>
  );
}
