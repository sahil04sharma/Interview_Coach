import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { Button, Panel } from '../components/ui.jsx';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    blurb: 'For daily personal practice.',
    features: [
      'Unlimited text practice sessions',
      'Voice interviews',
      'STAR + delivery feedback',
      'English / Hinglish / Hindi',
      'Progress & history',
    ],
    cta: 'Start free',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$12',
    period: '/mo',
    blurb: 'For serious job search seasons.',
    featured: true,
    features: [
      'Everything in Free',
      'Priority longer rounds',
      'Shareable report links',
      'Export-ready coaching reports',
      'Early access to new packs',
    ],
    cta: 'Get Pro',
  },
  {
    id: 'team',
    name: 'Team',
    price: 'Custom',
    blurb: 'For bootcamps and career teams.',
    features: [
      'Coach dashboards',
      'Shared candidate workspaces',
      'Brandable reports',
      'Volume practice seats',
    ],
    cta: 'Contact sales',
  },
];

export default function Pricing() {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="animate-rise max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-amber)]">
          Pricing
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">
          Pick the booth that fits your season
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
          Start free and rehearse daily. Upgrade when you want shareable, coach-ready reports —
          Pro and Team surfaces are ready today.
        </p>
      </div>

      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <Panel
            key={plan.id}
            className={`flex flex-col ${
              plan.featured
                ? 'ring-1 ring-[color-mix(in_srgb,var(--color-amber)_60%,transparent)] shadow-[0_0_50px_-12px_rgba(232,165,75,0.4)]'
                : ''
            }`}
          >
            {plan.featured && (
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-amber)]">
                Most popular
              </p>
            )}
            <h2 className="font-display text-2xl font-bold">{plan.name}</h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">{plan.blurb}</p>
            <p className="mt-4 font-display text-4xl font-bold">
              {plan.price}
              {plan.period && <span className="text-base font-sans font-normal text-[var(--color-muted)]">{plan.period}</span>}
            </p>
            <ul className="mt-5 flex-1 space-y-2 text-sm text-[var(--color-muted)]">
              {plan.features.map((f) => (
                <li key={f}>• {f}</li>
              ))}
            </ul>
            <div className="mt-6">
              {plan.id === 'team' ? (
                <a href="mailto:hello@interviewgrove.app">
                  <Button variant="ghost" className="w-full">
                    {plan.cta}
                  </Button>
                </a>
              ) : (
                <Link to={user ? '/app' : '/signup'}>
                  <Button className="w-full" variant={plan.featured ? 'primary' : 'ghost'}>
                    {plan.cta}
                  </Button>
                </Link>
              )}
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}
