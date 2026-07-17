import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import {
  Alert,
  Loading,
  Page,
  PageHeader,
  Panel,
  StatusBadge,
} from '../components/ui.jsx';

function ConceptNode({ node, depth = 0, query = '' }) {
  const [open, setOpen] = useState(false);
  const children = node.children || [];
  const hasChildren = children.length > 0;
  const mastery = node.mastery;
  const q = query.trim().toLowerCase();

  const selfMatch =
    !q ||
    node.name?.toLowerCase().includes(q) ||
    node.domain?.toLowerCase().includes(q) ||
    node.slug?.toLowerCase().includes(q);

  const matchingChildren = useMemo(() => {
    if (!q) return children;
    return children.filter(function walk(n) {
      const hit =
        n.name?.toLowerCase().includes(q) ||
        n.domain?.toLowerCase().includes(q) ||
        n.slug?.toLowerCase().includes(q);
      return hit || (n.children || []).some(walk);
    });
  }, [children, q]);

  if (q && !selfMatch && matchingChildren.length === 0) return null;

  // While searching, auto-expand matching branches; otherwise respect toggle
  const showChildren = q ? matchingChildren.length > 0 : open && hasChildren;
  const visibleChildren = q ? matchingChildren : children;

  return (
    <div className={depth ? 'ml-3 border-l border-[var(--color-line)] pl-3' : ''}>
      <div className="flex items-center gap-2 py-1.5">
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[var(--color-line)] text-xs text-[var(--color-muted)] hover:bg-[var(--color-fog)]"
            aria-expanded={showChildren}
            aria-label={open ? 'Collapse' : 'Expand'}
          >
            {showChildren || (q && matchingChildren.length) ? '−' : '+'}
          </button>
        ) : (
          <span className="inline-block h-6 w-6 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <Link
                to={`/knowledge/${node.slug}`}
                className="text-sm font-semibold text-[var(--color-ink)] hover:text-[var(--color-amber)]"
              >
                {node.name}
              </Link>
              {depth === 0 && (
                <p className="text-xs text-[var(--color-muted)]">
                  {node.domain}
                  {hasChildren ? ` · ${children.length} topics` : ''}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {mastery ? (
                <>
                  <span className="text-xs tabular-nums text-[var(--color-muted)]">
                    {mastery.masteryScore.toFixed(1)}/10
                  </span>
                  <StatusBadge status={mastery.status} />
                </>
              ) : (
                <span className="text-xs text-[var(--color-faint)]">—</span>
              )}
            </div>
          </div>
        </div>
      </div>
      {showChildren &&
        visibleChildren.map((child) => (
          <ConceptNode
            key={child.id || child.slug}
            node={child}
            depth={depth + 1}
            query={query}
          />
        ))}
    </div>
  );
}

export default function Knowledge() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        if (slug) {
          const d = await api.getKnowledgeConcept(slug);
          if (!cancelled) {
            setDetail(d);
            setData(null);
          }
        } else {
          const list = await api.getKnowledge(filter ? { status: filter } : {});
          if (!cancelled) {
            setData(list);
            setDetail(null);
          }
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, filter]);

  const tracked = useMemo(() => {
    const rows = data?.flat || [];
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (item) =>
        item.name?.toLowerCase().includes(q) ||
        item.slug?.toLowerCase().includes(q) ||
        item.parent?.name?.toLowerCase().includes(q),
    );
  }, [data, query]);

  if (loading) return <Loading label="Loading knowledge…" />;
  if (error) return <Alert>{error}</Alert>;

  if (detail) {
    const c = detail.concept;
    return (
      <Page className="!space-y-3 lg:flex lg:h-[calc(100dvh-11.5rem)] lg:min-h-0 lg:flex-col">
        <PageHeader
          eyebrow="Knowledge"
          title={c.name}
          subtitle={c.description || `Domain: ${c.domain}`}
          action={
            <Link to="/knowledge" className="text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]">
              ← All concepts
            </Link>
          }
        />
        <div className="grid min-h-0 flex-1 gap-4 overflow-hidden lg:grid-cols-[minmax(240px,320px)_minmax(0,1fr)]">
          <Panel className="space-y-3 overflow-y-auto">
            {c.parent && (
              <p className="text-sm text-[var(--color-muted)]">
                Parent:{' '}
                <Link className="text-[var(--color-amber)]" to={`/knowledge/${c.parent.slug}`}>
                  {c.parent.name}
                </Link>
              </p>
            )}
            {detail.mastery ? (
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={detail.mastery.status} />
                <span className="text-sm tabular-nums">
                  Mastery {detail.mastery.masteryScore}/10 · {detail.mastery.attempts} attempts
                </span>
              </div>
            ) : (
              <p className="text-sm text-[var(--color-muted)]">No attempts yet on this concept.</p>
            )}
            {detail.mastery?.repeatedMistakes?.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold">Repeated mistakes</h3>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[var(--color-muted)]">
                  {detail.mastery.repeatedMistakes.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            )}
            {c.children?.length > 0 && (
              <div>
                <h2 className="mb-2 text-sm font-semibold">Child concepts</h2>
                <div className="flex flex-wrap gap-2">
                  {c.children.map((child) => (
                    <Link
                      key={child.slug}
                      to={`/knowledge/${child.slug}`}
                      className="rounded-[10px] border border-[var(--color-line)] bg-[var(--color-mist)] px-3 py-1 text-xs font-medium"
                    >
                      {child.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </Panel>

          <Panel className="flex min-h-0 flex-col gap-3 overflow-hidden">
            <h2 className="shrink-0 font-display text-lg font-semibold">Attempt history</h2>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              {detail.attempts?.length ? (
                detail.attempts.map((a) => (
                  <div
                    key={a.questionId}
                    className="border-t border-[var(--color-line)] pt-3 first:border-0 first:pt-0"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <StatusBadge status={a.status} />
                      <span className="text-xs tabular-nums text-[var(--color-muted)]">
                        tech {a.technicalScore}/10
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-medium">{a.questionText}</p>
                    {a.feedback && (
                      <p className="mt-1 text-sm text-[var(--color-muted)]">{a.feedback}</p>
                    )}
                    {a.conceptExplanation && (
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-ink)]">
                        {a.conceptExplanation}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-[var(--color-muted)]">No linked attempts yet.</p>
              )}
            </div>
          </Panel>
        </div>
      </Page>
    );
  }

  const treeCount = data?.tree?.length || 0;
  const trackedCount = data?.flat?.length || 0;

  return (
    <Page className="!space-y-3 lg:flex lg:h-[calc(100dvh-11.5rem)] lg:min-h-0 lg:flex-col">
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          eyebrow="Knowledge"
          title="Knowledge base"
          subtitle="Browse domains, expand what you need — nothing cut off."
        />
        <p className="text-xs tabular-nums text-[var(--color-faint)] sm:pb-1">
          {treeCount} domains · {trackedCount} tracked
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {['', 'weak', 'learning', 'strong', 'mastered'].map((s) => (
          <button
            key={s || 'all'}
            type="button"
            onClick={() => setFilter(s)}
            className={`rounded-[10px] border px-3 py-1.5 text-xs font-semibold ${
              filter === s
                ? 'border-[var(--color-amber)] bg-[color-mix(in_srgb,var(--color-amber)_10%,white)] text-[var(--color-amber-deep)]'
                : 'border-[var(--color-line)] text-[var(--color-muted)]'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
        <input
          className="field-input ml-auto max-w-xs flex-1 text-sm sm:min-w-[12rem]"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search concepts…"
          aria-label="Search concepts"
        />
      </div>

      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden lg:grid-cols-2 lg:items-stretch">
        <Panel className="flex min-h-[16rem] flex-col gap-2 overflow-hidden lg:min-h-0">
          <div className="flex shrink-0 items-baseline justify-between gap-2">
            <h2 className="font-display text-lg font-semibold">Concept tree</h2>
            <p className="text-xs text-[var(--color-muted)]">Expand a domain (+)</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {(data?.tree || []).length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">No concepts in the tree yet.</p>
            ) : (
              (data?.tree || []).map((node) => (
                <ConceptNode key={node.id || node.slug} node={node} query={query} />
              ))
            )}
          </div>
        </Panel>

        <Panel className="flex min-h-[16rem] flex-col gap-2 overflow-hidden lg:min-h-0">
          <div className="flex shrink-0 items-baseline justify-between gap-2">
            <h2 className="font-display text-lg font-semibold">Your tracked concepts</h2>
            <p className="text-xs tabular-nums text-[var(--color-faint)]">{tracked.length}</p>
          </div>
          <div className="min-h-0 flex-1 space-y-0 overflow-y-auto pr-1">
            {tracked.length > 0 ? (
              tracked.map((item) => (
                <div
                  key={item.conceptId}
                  className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-line)] py-2.5 first:border-0 first:pt-0"
                >
                  <div className="min-w-0">
                    <Link
                      to={`/knowledge/${item.slug}`}
                      className="text-sm font-semibold hover:text-[var(--color-amber)]"
                    >
                      {item.name}
                    </Link>
                    {item.parent && (
                      <p className="text-xs text-[var(--color-muted)]">under {item.parent.name}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs tabular-nums text-[var(--color-muted)]">
                      {item.masteryScore}/10 · {item.attempts}x
                    </span>
                    <StatusBadge status={item.status} />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-[var(--color-muted)]">
                {query
                  ? 'No tracked concepts match your search.'
                  : 'Tracked concepts appear here after you answer interview questions.'}
              </p>
            )}
          </div>
        </Panel>
      </div>
    </Page>
  );
}
