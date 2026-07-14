import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { Alert, Button, Field, Page, PageHeader, Panel } from '../components/ui.jsx';

export default function SignUp() {
  const { user, signup } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (user) return <Navigate to="/app" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await signup({ name: name.trim(), email: email.trim(), password });
      navigate('/app', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Page className="mx-auto max-w-md">
      <PageHeader
        eyebrow="Welcome"
        title="Open your booth"
        subtitle="A quiet place to rehearse out loud and track exactly what needs work."
      />
      <Panel className="animate-rise-delay">
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Name">
            <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </Field>
          <Field label="Email">
            <input className="field-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </Field>
          <Field label="Password" hint="At least 6 characters">
            <input className="field-input" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          </Field>
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? 'Creating…' : 'Create account'}
          </Button>
        </form>
        {error && <div className="mt-4"><Alert>{error}</Alert></div>}
      </Panel>
      <p className="text-sm text-[var(--color-muted)]">
        Already have an account?{' '}
        <Link to="/signin" className="font-semibold text-[var(--color-amber)] underline-offset-2 hover:underline">
          Sign in
        </Link>
      </p>
    </Page>
  );
}
