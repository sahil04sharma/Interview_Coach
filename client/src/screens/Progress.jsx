import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import {
  Alert,
  Button,
  Loading,
  Page,
  PageHeader,
  Panel,
  TopicCloud,
} from '../components/ui.jsx';

export default function Progress() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getStats();
        if (!cancelled) setStats(data);
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

  if (loading) return <Loading label="Gathering progress…" />;
  if (error) return <Alert>{error}</Alert>;
  if (!stats) return null;

  const weakish = stats.topicStats.filter((t) => t.avgTechnical < 6).slice(0, 8);
  const strongish = [...stats.topicStats]
    .filter((t) => t.avgTechnical >= 8)
    .sort((a, b) => b.avgTechnical - a.avgTechnical)
    .slice(0, 8);

  return (
    <Page>
      <PageHeader
        eyebrow="Growth"
        title="Your progress"
        subtitle="A quiet view of where you’re improving — and where the interviewer should keep pressing."
        action={
          <Link to="/session/new">
            <Button>Practice now</Button>
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Panel>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
            Sessions
          </p>
          <p className="mt-2 font-display text-4xl font-semibold">{stats.sessionCount}</p>
        </Panel>
        <Panel>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
            Answers
          </p>
          <p className="mt-2 font-display text-4xl font-semibold">{stats.answeredQuestions}</p>
        </Panel>
        <Panel>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
            Avg score
          </p>
          <p className="mt-2 font-display text-4xl font-semibold">
            {stats.averageScore ?? '—'}
          </p>
        </Panel>
      </div>

      {stats.scoreTrend?.length > 0 && (
        <Panel className="space-y-3">
          <h2 className="font-display text-xl font-semibold">Score trend</h2>
          <div className="flex h-36 items-end gap-2">
            {stats.scoreTrend.map((point) => (
              <div key={point.id} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] tabular-nums text-[var(--color-muted)]">
                  {point.score}
                </span>
                <div
                  className="w-full rounded-t-md bg-[var(--color-leaf)]/80"
                  style={{ height: `${Math.max(8, (point.score / 10) * 100)}%` }}
                  title={`${point.label}: ${point.score}`}
                />
              </div>
            ))}
          </div>
        </Panel>
      )}

      {stats.deliveryAverages && (
        <Panel>
          <h2 className="font-display text-xl font-semibold">Delivery averages</h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            ~{stats.deliveryAverages.wordsPerMinute} WPM · ~{stats.deliveryAverages.fillerWordCount}{' '}
            fillers/answer · {stats.deliveryAverages.samples} samples
          </p>
        </Panel>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Panel>
          <TopicCloud title="Tracked weak topics" topics={stats.weakTopics} empty="None yet" />
        </Panel>
        <Panel>
          <TopicCloud
            title="Tracked strong topics"
            topics={stats.strongTopics}
            empty="None yet"
            tone="strong"
          />
        </Panel>
      </div>

      <Panel className="space-y-4">
        <h2 className="font-display text-xl font-semibold">Topic averages</h2>
        {stats.topicStats.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">
            Answer a few questions to unlock topic trends.
          </p>
        ) : (
          <div className="space-y-2">
            {stats.topicStats.slice(0, 12).map((t) => (
              <div key={t.topic} className="grid grid-cols-[1fr_auto] items-center gap-3">
                <div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{t.topic}</span>
                    <span className="tabular-nums text-[var(--color-muted)]">
                      {t.avgTechnical}/10 · {t.count}x
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--color-fog)]">
                    <div
                      className="h-full rounded-full bg-[var(--color-leaf)] transition-all duration-500"
                      style={{ width: `${Math.min(100, (t.avgTechnical / 10) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {(weakish.length > 0 || strongish.length > 0) && (
          <p className="text-xs text-[var(--color-muted)]">
            Lowest averages surface first so you know what to practice next.
          </p>
        )}
      </Panel>
    </Page>
  );
}
