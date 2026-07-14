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

  return (
    <Page>
      <PageHeader
        eyebrow="Profile"
        title="Set the stage"
        subtitle="Your resume and role shape every question. Keep this updated so practice stays personal."
        action={
          <Link to="/session/new">
            <Button>Start practice</Button>
          </Link>
        }
      />

      <Panel className="animate-rise-delay space-y-5">
        <form onSubmit={onSave} className="space-y-4">
          <Field label="Name">
            <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Target role" hint="Used to build a wide interview topic map (e.g. Frontend Developer → JS, React, CSS, browser, a11y, performance, trick questions).">
            <input
              className="field-input"
              placeholder="e.g. Frontend Developer"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
            />
          </Field>
          <Field label="Resume" hint="Paste text, or upload a PDF below.">
            <textarea
              className="field-input min-h-64 font-mono text-[13px] leading-relaxed"
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              placeholder="Paste your resume here…"
            />
          </Field>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save profile'}
            </Button>
            <label className="btn-ghost inline-flex cursor-pointer items-center rounded-xl px-4 py-2.5 text-sm font-semibold">
              {uploading ? 'Reading PDF…' : 'Upload PDF'}
              <input type="file" accept="application/pdf" className="hidden" onChange={onPdf} disabled={uploading} />
            </label>
          </div>
        </form>

        {message && <Alert tone="ok">{message}</Alert>}
        {error && <Alert>{error}</Alert>}
      </Panel>
    </Page>
  );
}
