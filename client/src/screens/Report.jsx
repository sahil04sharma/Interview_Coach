import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { IntelligencePanel } from '../components/IntelligencePanel.jsx';
import {
  Alert,
  Button,
  Loading,
  Page,
  PageHeader,
  Panel,
  ScoreGrid,
  TopicCloud,
} from '../components/ui.jsx';

export default function Report() {
  const { id } = useParams();
  const location = useLocation();
  const [report, setReport] = useState(location.state?.report || null);
  const [loading, setLoading] = useState(!location.state?.report);
  const [error, setError] = useState('');
  const [shareUrl, setShareUrl] = useState(location.state?.report?.shareUrl || '');
  const [shareMsg, setShareMsg] = useState('');
  const [cognitive, setCognitive] = useState(null);
  const [hypotheses, setHypotheses] = useState(null);

  useEffect(() => {
    if (report) return;
    let cancelled = false;
    (async () => {
      try {
        const session = await api.getSession(id);
        if (cancelled) return;
        setReport({
          session,
          overallScore: session.overallScore,
          hiringVerdict: session.hiringVerdict,
          reasoning: session.verdictReasoning || '',
          hireProbability: session.hireProbability,
          readinessScore: session.readinessScore,
          strengths: session.strengths || [],
          weaknesses: session.weaknesses || [],
          repeatedMistakes: session.repeatedMistakes || [],
          recommendedLearningPath: session.recommendedPath || '',
          confidenceAnalysis: session.reportAnalysis?.confidenceAnalysis || '',
          communicationAnalysis: session.reportAnalysis?.communicationAnalysis || '',
          technicalAnalysis: session.reportAnalysis?.technicalAnalysis || '',
          missedConcepts: session.reportAnalysis?.missedConcepts || [],
          bestAnswerQ: session.reportAnalysis?.bestAnswerQ,
          worstAnswerQ: session.reportAnalysis?.worstAnswerQ,
          weakTopics: session.user?.weakTopics || [],
          strongTopics: session.user?.strongTopics || [],
        });
        if (session.shareToken) setShareUrl(`/r/${session.shareToken}`);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, report]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const [ccm, hyps] = await Promise.all([
          api.getCognitiveModel(id),
          api.getHypotheses(id),
        ]);
        if (cancelled) return;
        setCognitive(ccm);
        setHypotheses(hyps);
      } catch {
        // Intelligence endpoints are additive — report still works without them.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function onShare() {
    setShareMsg('');
    try {
      const result = await api.shareReport(id);
      const full = `${window.location.origin}${result.shareUrl}`;
      setShareUrl(result.shareUrl);
      await navigator.clipboard.writeText(full);
      setShareMsg('Share link copied to clipboard.');
    } catch (err) {
      setShareMsg(err.message);
    }
  }

  function onExport() {
    const session = report.session;
    const lines = [
      `# Interview Grove Report`,
      ``,
      `- Style: ${session?.companyStyle}`,
      `- Mode: ${session?.mode}`,
      `- Score: ${report.overallScore ?? session?.overallScore ?? '—'}`,
      `- Verdict: ${report.hiringVerdict || session?.hiringVerdict || '—'}`,
      report.reasoning ? `- Reasoning: ${report.reasoning}` : '',
      ``,
      `## Questions`,
      ...(session?.questions || []).map(
        (q, i) =>
          `### ${q.isFollowUp ? 'Follow-up' : `Q${i + 1}`}\n${q.questionText}\n\n**Answer:** ${q.userAnswer}\n\n**Feedback:** ${q.feedback}\n`,
      ),
    ].filter(Boolean);
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interview-grove-report-${id.slice(0, 8)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <Loading label="Loading report…" />;
  if (error) return <Alert>{error}</Alert>;
  if (!report) return <Alert>No report found.</Alert>;

  const session = report.session;
  const questions = session?.questions || [];

  return (
    <Page>
      <PageHeader
        eyebrow="Report"
        title="Session closed"
        subtitle={`${session?.companyStyle} · ${session?.mode}`}
        action={
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button variant="ghost" onClick={onShare}>
              Copy share link
            </Button>
            <Button variant="ghost" onClick={onExport}>
              Export Markdown
            </Button>
            <Button variant="ghost" onClick={() => window.print()}>
              Print / PDF
            </Button>
            <Link to="/session/new">
              <Button>Practice again</Button>
            </Link>
          </div>
        }
      />

      {shareMsg && (
        <div className="print:hidden">
          <Alert tone={shareMsg.includes('copied') ? 'ok' : 'danger'}>{shareMsg}</Alert>
          {shareUrl && (
            <p className="mt-2 text-xs text-[var(--color-muted)]">
              Public link: <span className="font-mono">{window.location.origin}{shareUrl}</span>
            </p>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
        <Panel>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
            Overall score
          </p>
          <p className="mt-2 font-display text-5xl font-semibold tabular-nums">
            {report.overallScore ?? session?.overallScore ?? '—'}
          </p>
          {report.comparison && (
            <div className="mt-4 border-t border-[var(--color-line)] pt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-leaf)]">
                vs last {session?.mode} session
              </p>
              <p className="mt-2 font-display text-2xl font-semibold tabular-nums">
                {report.comparison.delta > 0 ? '+' : ''}
                {report.comparison.delta} points
              </p>
              <p className="mt-2 text-sm text-[var(--color-muted)]">
                Previous score {report.comparison.previousScore}
                {report.comparison.previousVerdict ? ` · ${report.comparison.previousVerdict}` : ''}
                {report.comparison.improved
                  ? ' — you improved since last time.'
                  : report.comparison.delta < 0
                    ? ' — slightly down; keep drilling weak topics.'
                    : ' — flat vs last round.'}
              </p>
            </div>
          )}
        </Panel>
        <Panel>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
            Hiring verdict
          </p>
          <p className="mt-2 font-display text-2xl font-semibold">
            {report.hiringVerdict || session?.hiringVerdict || '—'}
          </p>
          {(report.hireProbability != null || session?.hireProbability != null) && (
            <p className="mt-2 text-sm tabular-nums text-[var(--color-muted)]">
              Hire probability {report.hireProbability ?? session?.hireProbability}%
            </p>
          )}
          {(report.readinessScore != null || session?.readinessScore != null) && (
            <p className="text-sm tabular-nums text-[var(--color-muted)]">
              Readiness {report.readinessScore ?? session?.readinessScore}/10
            </p>
          )}
          {report.reasoning && (
            <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
              {report.reasoning}
            </p>
          )}
        </Panel>
      </div>

      {(report.strengths?.length > 0 ||
        report.weaknesses?.length > 0 ||
        report.repeatedMistakes?.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Panel>
            <TopicCloud title="Strengths" topics={report.strengths} empty="—" tone="strong" />
          </Panel>
          <Panel>
            <TopicCloud title="Weaknesses" topics={report.weaknesses} empty="—" />
          </Panel>
          <Panel>
            <TopicCloud title="Repeated mistakes" topics={report.repeatedMistakes} empty="—" />
          </Panel>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] lg:items-start">
        <div className="space-y-4">
          {(report.technicalAnalysis ||
            report.communicationAnalysis ||
            report.confidenceAnalysis ||
            report.recommendedLearningPath) && (
            <Panel className="space-y-3">
              <h2 className="font-display text-lg font-semibold">Coach analysis</h2>
              {report.technicalAnalysis && (
                <p className="text-sm text-[var(--color-muted)]">
                  <span className="font-semibold text-[var(--color-ink)]">Technical: </span>
                  {report.technicalAnalysis}
                </p>
              )}
              {report.communicationAnalysis && (
                <p className="text-sm text-[var(--color-muted)]">
                  <span className="font-semibold text-[var(--color-ink)]">Communication: </span>
                  {report.communicationAnalysis}
                </p>
              )}
              {report.confidenceAnalysis && (
                <p className="text-sm text-[var(--color-muted)]">
                  <span className="font-semibold text-[var(--color-ink)]">Confidence: </span>
                  {report.confidenceAnalysis}
                </p>
              )}
              {report.recommendedLearningPath && (
                <p className="text-sm text-[var(--color-muted)]">
                  <span className="font-semibold text-[var(--color-ink)]">Learning path: </span>
                  {report.recommendedLearningPath}
                </p>
              )}
              {(report.bestAnswerQ || report.worstAnswerQ) && (
                <p className="text-xs text-[var(--color-muted)]">
                  Best: {report.bestAnswerQ || '—'} · Weakest: {report.worstAnswerQ || '—'}
                </p>
              )}
            </Panel>
          )}

          <IntelligencePanel cognitive={cognitive} hypotheses={hypotheses} />

          <div className="space-y-4">
            <h2 className="font-display text-2xl font-semibold">Breakdown</h2>
            {questions.length === 0 && (
              <p className="text-sm text-[var(--color-muted)]">No answered questions.</p>
            )}
            {questions.map((q, index) => (
              <Panel key={q.id} className="space-y-3">
                <p className="text-sm font-semibold">
                  {q.isFollowUp ? 'Follow-up' : `Q${index + 1}`}. {q.questionText}
                </p>
                <p className="text-sm text-[var(--color-muted)]">
                  <span className="font-semibold text-[var(--color-ink)]">Your answer: </span>
                  {q.userAnswer}
                </p>
                <ScoreGrid evaluation={q} />
                {(q.starSituation != null || q.starTask != null) && (
                  <p className="text-xs text-[var(--color-muted)]">
                    STAR — S {q.starSituation ?? '—'}/10 · T {q.starTask ?? '—'}/10 · A{' '}
                    {q.starAction ?? '—'}/10 · R {q.starResult ?? '—'}/10
                  </p>
                )}
                {(q.wordsPerMinute != null || q.fillerWordCount != null) && (
                  <p className="text-xs text-[var(--color-muted)]">
                    Delivery — {q.wordsPerMinute != null ? `${q.wordsPerMinute} WPM` : 'n/a'} · fillers{' '}
                    {q.fillerWordCount ?? 0}
                  </p>
                )}
                <p className="text-sm">
                  <span className="font-semibold">Feedback: </span>
                  {q.feedback}
                </p>
                {q.improvedAnswer && (
                  <p className="text-sm text-[var(--color-muted)]">
                    <span className="font-semibold text-[var(--color-ink)]">Stronger rewrite: </span>
                    {q.improvedAnswer}
                  </p>
                )}
                {q.conceptExplanation && (
                  <div className="rounded-xl bg-[var(--color-fog)] p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-leaf)]">
                      Learn this properly
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-muted)]">
                      {q.conceptExplanation}
                    </p>
                  </div>
                )}
                {q.idealAnswer && (
                  <p className="text-sm text-[var(--color-muted)]">
                    <span className="font-semibold text-[var(--color-ink)]">Model answer: </span>
                    {q.idealAnswer}
                  </p>
                )}
                {q.studyTips?.length > 0 && (
                  <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--color-muted)]">
                    {q.studyTips.map((tip) => (
                      <li key={tip}>{tip}</li>
                    ))}
                  </ul>
                )}
              </Panel>
            ))}
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6">
          <Panel className="flex flex-col gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold">Next: study plan</h2>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                Open tomorrow&apos;s prioritized revision plan from this session.
              </p>
            </div>
            <Link to="/study-plan">
              <Button className="w-full">Open study plan</Button>
            </Link>
          </Panel>

          <Panel>
            <TopicCloud title="Updated weak topics" topics={report.weakTopics} empty="None" />
          </Panel>
          <Panel>
            <TopicCloud
              title="Updated strong topics"
              topics={report.strongTopics}
              empty="None"
              tone="strong"
            />
          </Panel>

          <div className="flex flex-col gap-2 text-sm">
            <Link to="/study-plan" className="font-semibold text-[var(--color-leaf-deep)] underline-offset-2 hover:underline">
              Study plan
            </Link>
            <Link to="/knowledge" className="font-semibold text-[var(--color-leaf-deep)] underline-offset-2 hover:underline">
              Knowledge
            </Link>
            <Link to="/history" className="text-[var(--color-muted)] underline-offset-2 hover:underline">
              Session history
            </Link>
            <Link to="/progress" className="text-[var(--color-muted)] underline-offset-2 hover:underline">
              Progress
            </Link>
          </div>
        </aside>
      </div>
    </Page>
  );
}
