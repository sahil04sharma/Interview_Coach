import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { Button } from '../components/ui.jsx';

const BEATS = [
  {
    step: '01',
    title: 'Speak',
    body: 'Answer one question at a time, out loud, in English, Hinglish, or Hindi — with a soft interviewer voice and live transcription.',
  },
  {
    step: '02',
    title: 'Get coached',
    body: 'Honest STAR structure, delivery pace, and filler-word notes — plus a stronger rewrite of your own answer.',
  },
  {
    step: '03',
    title: 'Track progress',
    body: 'Weak topics, delivery averages, and shareable reports that show how much steadier you sound each round.',
  },
];

export default function Landing() {
  const { user } = useAuth();

  return (
    <div className="overflow-hidden">
      <section className="relative flex min-h-[86vh] items-center">
        <div className="spotlight-cone animate-spotlight" aria-hidden="true" />
        {/* mic-stand silhouette */}
        <svg
          aria-hidden="true"
          viewBox="0 0 120 400"
          className="pointer-events-none absolute bottom-0 left-1/2 hidden h-[62vh] -translate-x-1/2 opacity-[0.14] sm:block"
        >
          <circle cx="60" cy="70" r="34" fill="none" stroke="var(--color-lamp)" strokeWidth="3" />
          <rect x="46" y="60" width="28" height="20" rx="6" fill="var(--color-lamp)" />
          <line x1="60" y1="104" x2="60" y2="360" stroke="var(--color-lamp)" strokeWidth="4" />
          <line x1="20" y1="380" x2="100" y2="380" stroke="var(--color-lamp)" strokeWidth="5" strokeLinecap="round" />
        </svg>

        <div className="relative z-10 mx-auto w-full max-w-5xl px-4 text-center sm:px-6">
          <p className="animate-rise font-display text-6xl font-extrabold leading-[0.95] tracking-tight text-[var(--color-ink)] sm:text-8xl">
            Interview
            <br />
            <span className="text-[var(--color-lamp)]">Grove</span>
          </p>
          <h1 className="animate-rise-delay mx-auto mt-7 max-w-xl text-lg leading-relaxed text-[var(--color-muted)] sm:text-xl">
            Step into a quiet rehearsal booth, warm up out loud, and get coached before
            the interview that actually counts.
          </h1>
          <div className="animate-rise-delay mt-9 flex flex-wrap justify-center gap-3">
            {user ? (
              <Link to="/app">
                <Button>Open your booth</Button>
              </Link>
            ) : (
              <>
                <Link to="/signup">
                  <Button>Start rehearsing free</Button>
                </Link>
                <Link to="/signin">
                  <Button variant="ghost">Sign in</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
        <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Three beats, every rehearsal
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--color-muted)]">
          No dashboards to configure. Walk in, speak, and leave knowing exactly what to sharpen next.
        </p>
        <div className="mt-12 grid gap-10 sm:grid-cols-3">
          {BEATS.map((beat, i) => (
            <div key={beat.title} className={i % 2 === 1 ? 'animate-rise-delay' : 'animate-rise'}>
              <p className="font-display text-sm font-bold tracking-[0.2em] text-[var(--color-amber)]">
                {beat.step}
              </p>
              <h3 className="mt-3 font-display text-2xl font-bold">{beat.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">{beat.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
        <div className="glass-panel flex flex-col items-start gap-6 rounded-3xl p-8 sm:flex-row sm:items-center sm:justify-between sm:p-10">
          <div>
            <h2 className="font-display text-2xl font-bold sm:text-3xl">Ready when you are.</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--color-muted)]">
              Free forever for daily practice. Upgrade to Pro when you want shareable, coach-ready reports.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to={user ? '/app' : '/signup'}>
              <Button>{user ? 'Go to dashboard' : 'Create free account'}</Button>
            </Link>
            <Link to="/pricing">
              <Button variant="ghost">See pricing</Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
