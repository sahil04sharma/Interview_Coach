import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { Alert, Button, Field, Page, PageHeader, Panel } from '../components/ui.jsx';

export default function SignIn() {
  const { user, signin } = useAuth();
  const navigate = useNavigate();
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
      await signin({ email: email.trim(), password });
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
        eyebrow="Step back in"
        title="Sign in"
        subtitle="Your booth is as you left it — resume, weak topics, and past rehearsals stay with you."
      />
      <Panel className="animate-rise-delay">
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Email">
            <input className="field-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </Field>
          <Field label="Password">
            <input className="field-input" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </Field>
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
        {error && <div className="mt-4"><Alert>{error}</Alert></div>}
      </Panel>
      <p className="text-sm text-[var(--color-muted)]">
        New here?{' '}
        <Link to="/signup" className="font-semibold text-[var(--color-amber)] underline-offset-2 hover:underline">
          Create an account
        </Link>
      </p>
    </Page>
  );
}
