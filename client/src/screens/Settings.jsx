import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Alert, Button, Field, Loading, Page, PageHeader, Panel } from '../components/ui.jsx';

const LANGUAGES = [
  { value: 'english', label: 'English' },
  { value: 'hinglish', label: 'Hinglish' },
  { value: 'hindi', label: 'Hindi' },
];

export default function Settings() {
  const { user, refresh } = useAuth();
  const [name, setName] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('hinglish');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await api.getUser();
        if (cancelled) return;
        setName(me.name || '');
        setTargetRole(me.targetRole || '');
        setPreferredLanguage(me.preferredLanguage || 'hinglish');
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
        name: name.trim() || user?.email?.split('@')[0] || 'User',
        targetRole: targetRole.trim() || null,
        preferredLanguage,
      });
      await refresh();
      setMessage('Settings saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading label="Loading settings…" />;

  return (
    <Page className="mx-auto max-w-xl">
      <PageHeader
        eyebrow="Account"
        title="Settings"
        subtitle="Manage your profile defaults for an international practice experience."
      />

      <Panel>
        <form onSubmit={onSave} className="space-y-4">
          <Field label="Display name">
            <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Email">
            <input className="field-input" value={user?.email || ''} disabled />
          </Field>
          <Field label="Target role">
            <input
              className="field-input"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              placeholder="e.g. Frontend Developer"
            />
          </Field>
          <Field label="Default interview language" hint="Used as the default when starting a new round.">
            <select
              className="field-input"
              value={preferredLanguage}
              onChange={(e) => setPreferredLanguage(e.target.value)}
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Current plan">
            <input className="field-input capitalize" value={user?.plan || 'free'} disabled />
          </Field>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save settings'}
          </Button>
        </form>
        {message && <div className="mt-4"><Alert tone="ok">{message}</Alert></div>}
        {error && <div className="mt-4"><Alert>{error}</Alert></div>}
      </Panel>
    </Page>
  );
}
