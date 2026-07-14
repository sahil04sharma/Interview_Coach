import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import {
  Alert,
  Button,
  Field,
  Loading,
  Page,
  PageHeader,
  Panel,
  TopicCloud,
} from '../components/ui.jsx';

const MODES = [
  { value: 'technical', label: 'Technical' },
  { value: 'behavioral', label: 'Behavioral' },
  { value: 'coding', label: 'Coding (JS runner)' },
  { value: 'system-design', label: 'System design' },
];

const PACKS = [
  { value: 'mixed', label: 'Mixed professional round' },
  { value: 'fundamentals', label: 'Role fundamentals' },
  { value: 'tricks', label: 'Trick & edge cases' },
  { value: 'behavioral_star', label: 'Behavioral STAR stories' },
  { value: 'weak_topics', label: 'Weak-topic drill (from your gaps)' },
];

const DIFFICULTIES = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard (bar-raiser)' },
];

const LANGUAGES = [
  { value: 'english', label: 'English' },
  { value: 'hinglish', label: 'Hinglish — Indian recruiter style (recommended)' },
  { value: 'hindi', label: 'Hindi' },
];

const STYLE_LABELS = {
  general: 'General — improve overall (recommended)',
  google: 'Google — target this company',
  meta: 'Meta — target this company',
  amazon: 'Amazon — target this company',
  tcs: 'TCS — target this company',
  infosys: 'Infosys — target this company',
  startup: 'Startup — target this style',
};

function styleLabel(name) {
  return STYLE_LABELS[name] || name;
}

export default function NewSession() {
  const navigate = useNavigate();
  const [styles, setStyles] = useState([]);
  const [user, setUser] = useState(null);
  const [companyStyle, setCompanyStyle] = useState('general');
  const [mode, setMode] = useState('technical');
  const [practicePack, setPracticePack] = useState('mixed');
  const [difficulty, setDifficulty] = useState('medium');
  const [interviewLanguage, setInterviewLanguage] = useState('hinglish');
  const [plannedCount, setPlannedCount] = useState(8);
  const [jdText, setJdText] = useState('');
  const [voiceMode, setVoiceMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [startStatus, setStartStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [stylesRes, userRes] = await Promise.all([
          api.getCompanyStyles(),
          api.getUser(),
        ]);
        if (cancelled) return;
        setStyles(stylesRes);
        setUser(userRes);
        const hasGeneral = stylesRes.some((s) => s.name === 'general');
        setCompanyStyle(hasGeneral ? 'general' : stylesRes[0]?.name || '');
        if (userRes.preferredLanguage) {
          setInterviewLanguage(userRes.preferredLanguage);
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
  }, []);

  async function onStart(e) {
    e.preventDefault();
    setStarting(true);
    setError('');
    setStartStatus('Building your round…');
    try {
      let streamedQuestion = '';
      const result = await api.startSession(
        {
          companyStyle,
          mode,
          jdText: jdText.trim() || undefined,
          practicePack,
          difficulty,
          plannedCount: Number(plannedCount),
          interviewLanguage,
        },
        {
          onEvent: (event) => {
            if (event.type === 'status') setStartStatus(event.message || 'Working…');
            if (event.type === 'token') {
              streamedQuestion += event.delta || '';
              setStartStatus('Drafting first question…');
            }
          },
        },
      );
      navigate(`/session/${result.sessionId}`, {
        state: {
          question: result.question || streamedQuestion,
          mode: result.mode || mode,
          voiceMode,
          plannedCount: result.plannedCount,
          interviewLanguage: result.interviewLanguage || interviewLanguage,
        },
      });
    } catch (err) {
      setError(err.message);
      setStarting(false);
      setStartStatus('');
    }
  }

  if (loading) return <Loading label="Preparing practice…" />;

  return (
    <Page>
      <PageHeader
        eyebrow="Practice"
        title="New session"
        subtitle="Professional-style rounds: fixed length, difficulty, practice packs, STAR coaching, speech delivery, and adaptive follow-ups — like top AI interview tools."
      />

      {user && (
        <div className="animate-rise-delay grid gap-4 sm:grid-cols-2">
          <Panel>
            <TopicCloud title="Weak topics" topics={user.weakTopics} empty="None yet — they’ll appear after tough answers." />
          </Panel>
          <Panel>
            <TopicCloud title="Strong topics" topics={user.strongTopics} empty="None yet." tone="strong" />
          </Panel>
        </div>
      )}

      <Panel>
        <form onSubmit={onStart} className="space-y-4">
          <Field
            label="Focus"
            hint="Leave on General for all-around growth. Company options tune tone for that target."
          >
            <select
              className="field-input"
              value={companyStyle}
              onChange={(e) => setCompanyStyle(e.target.value)}
              required
            >
              {styles.map((s) => (
                <option key={s.id} value={s.name}>
                  {styleLabel(s.name)}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Practice pack"
              hint={
                practicePack === 'weak_topics'
                  ? user?.weakTopics?.length
                    ? `Will drill: ${user.weakTopics.slice(0, 4).join(', ')}${user.weakTopics.length > 4 ? '…' : ''}`
                    : 'Needs weak topics from past sessions first.'
                  : undefined
              }
            >
              <select className="field-input" value={practicePack} onChange={(e) => setPracticePack(e.target.value)}>
                {PACKS.map((p) => (
                  <option
                    key={p.value}
                    value={p.value}
                    disabled={p.value === 'weak_topics' && !user?.weakTopics?.length}
                  >
                    {p.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Mode">
              <select
                className="field-input"
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                disabled={practicePack === 'behavioral_star'}
              >
                {MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Difficulty">
              <select className="field-input" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                {DIFFICULTIES.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Questions in this round">
              <select
                className="field-input"
                value={plannedCount}
                onChange={(e) => setPlannedCount(Number(e.target.value))}
              >
                {[5, 6, 8, 10, 12].map((n) => (
                  <option key={n} value={n}>
                    {n} questions
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field
            label="Interview language"
            hint="Hinglish matches how many Indian recruiters actually talk. Hindi for Devanagari-first practice. English for global-style rounds."
          >
            <select
              className="field-input"
              value={interviewLanguage}
              onChange={(e) => setInterviewLanguage(e.target.value)}
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </Field>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--color-line)] bg-[color-mix(in_srgb,white_70%,transparent)] px-4 py-3">
            <input
              type="checkbox"
              className="mt-1"
              checked={voiceMode}
              onChange={(e) => setVoiceMode(e.target.checked)}
              disabled={mode === 'coding' && practicePack !== 'behavioral_star'}
            />
            <span>
              <span className="block text-sm font-semibold text-[var(--color-ink)]">
                Voice-to-voice interview
              </span>
              <span className="mt-0.5 block text-xs text-[var(--color-muted)]">
                Soft girl interviewer voice + recorded answers with filler/pace analytics.
              </span>
            </span>
          </label>

          <Field label="Job description" hint="Optional extra filter — paste a JD when you want role-specific questions.">
            <textarea
              className="field-input min-h-36 text-sm"
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              placeholder="Optional: paste JD text…"
            />
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={starting || !companyStyle}>
              {starting ? startStatus || 'Building your round…' : 'Begin interview'}
            </Button>
            <Link to="/app" className="text-sm font-medium text-[var(--color-muted)] underline-offset-2 hover:underline">
              Back to dashboard
            </Link>
          </div>
        </form>
        {error && <div className="mt-4"><Alert>{error}</Alert></div>}
      </Panel>
    </Page>
  );
}
