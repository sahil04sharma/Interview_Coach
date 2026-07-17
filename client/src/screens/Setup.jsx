import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Alert, Button, Field, Loading, Page, PageHeader, Panel } from '../components/ui.jsx';

export default function Setup() {
  const { user: authUser, refresh } = useAuth();
  const [name, setName] = useState(authUser?.name || '');
  const [resumeText, setResumeText] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = await api.getUser();
        if (cancelled) return;
        setName(user.name || '');
        setResumeText(user.resumeText || '');
        setTargetRole(user.targetRole || '');
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

  async function onSave(e) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await api.updateUser({
        name: name.trim() || authUser?.email?.split('@')[0] || 'User',
        resumeText,
        targetRole: targetRole.trim() || null,
      });
      await refresh();
      setMessage('Profile saved. You’re ready to practice.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function onPdf(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    setMessage('');
    try {
      const result = await api.uploadResumePdf(file);
      setResumeText(result.user.resumeText || '');
      setMessage(`Extracted ${result.extractedChars} characters from PDF. Review and save if needed.`);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  if (loading) return <Loading label="Loading your profile…" />;

  const charCount = resumeText.length;

  return (
    <Page className="!space-y-3 lg:flex lg:h-[calc(100dvh-11.5rem)] lg:min-h-0 lg:flex-col">
      <PageHeader
        eyebrow="Profile"
        title="Set the stage"
        subtitle="Role and resume shape every round. Keep them current."
        action={
          <Link to="/session/new">
            <Button>Start practice</Button>
          </Link>
        }
      />

      <form
        onSubmit={onSave}
        className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(260px,300px)_minmax(0,1fr)] lg:items-stretch"
      >
        <Panel className="flex flex-col gap-4">
          <Field label="Name">
            <input
              className="field-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </Field>
          <Field
            label="Target role"
            hint="e.g. MERN stack developer — drives fundamentals & curriculum."
          >
            <input
              className="field-input"
              placeholder="e.g. Frontend Developer"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
            />
          </Field>

          <div className="mt-auto space-y-3 border-t border-[var(--color-line)] pt-4">
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={saving} className="flex-1 sm:flex-none">
                {saving ? 'Saving…' : 'Save profile'}
              </Button>
              <label className="btn-ghost inline-flex flex-1 cursor-pointer items-center justify-center rounded-[12px] px-4 py-2.5 text-sm font-semibold sm:flex-none">
                {uploading ? 'Reading PDF…' : 'Upload PDF'}
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={onPdf}
                  disabled={uploading}
                />
              </label>
            </div>
            {message && <Alert tone="ok">{message}</Alert>}
            {error && <Alert>{error}</Alert>}
            <p className="text-xs leading-relaxed text-[var(--color-muted)]">
              Tip: a clear target role helps more than a long resume when you are switching domains.
            </p>
          </div>
        </Panel>

        <Panel className="flex min-h-[16rem] flex-col gap-2 overflow-hidden lg:min-h-0 lg:h-full">
          <div className="flex shrink-0 items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--color-ink)]">Resume</p>
              <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                Paste text or upload a PDF. Scroll inside this panel if needed.
              </p>
            </div>
            <p className="shrink-0 text-xs tabular-nums text-[var(--color-faint)]">
              {charCount.toLocaleString()} chars
            </p>
          </div>
          <textarea
            className="field-input min-h-[14rem] flex-1 resize-none overflow-y-auto font-mono text-[13px] leading-relaxed lg:min-h-0"
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
            placeholder="Paste your resume here…"
            spellCheck={false}
          />
        </Panel>
      </form>
    </Page>
  );
}
