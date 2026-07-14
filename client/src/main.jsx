import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import './index.css';
import { AuthProvider, useAuth } from './auth.jsx';
import ProtectedRoute from './ProtectedRoute.jsx';
import Landing from './screens/Landing.jsx';
import Pricing from './screens/Pricing.jsx';
import { Privacy, Terms } from './screens/Legal.jsx';
import Dashboard from './screens/Dashboard.jsx';
import Setup from './screens/Setup.jsx';
import Settings from './screens/Settings.jsx';
import NewSession from './screens/NewSession.jsx';
import Interview from './screens/Interview.jsx';
import Report from './screens/Report.jsx';
import SharedReport from './screens/SharedReport.jsx';
import SignIn from './screens/SignIn.jsx';
import SignUp from './screens/SignUp.jsx';
import History from './screens/History.jsx';
import Progress from './screens/Progress.jsx';
import { Button } from './components/ui.jsx';

function MarketingChrome({ children }) {
  const { user, loading } = useAuth();
  const linkClass = ({ isActive }) => `nav-link text-sm font-medium ${isActive ? 'active' : ''}`;

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-6 sm:px-6">
        <Link to="/" className="group inline-flex items-center gap-2.5">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--color-amber)_45%,var(--color-line))] bg-[color-mix(in_srgb,var(--color-amber)_16%,var(--color-booth))]">
            <span className="h-2 w-2 rounded-full bg-[var(--color-amber)] shadow-[0_0_10px_var(--color-amber)]" />
          </span>
          <span className="font-display text-xl font-bold tracking-tight text-[var(--color-ink)]">
            Interview Grove
          </span>
        </Link>
        <nav className="flex flex-wrap items-center gap-4">
          <NavLink to="/pricing" className={linkClass}>
            Pricing
          </NavLink>
          {!loading && user ? (
            <Link to="/app">
              <Button className="!py-1.5 !text-xs">Dashboard</Button>
            </Link>
          ) : (
            <>
              <NavLink to="/signin" className={linkClass}>
                Sign in
              </NavLink>
              <Link to="/signup">
                <Button className="!py-1.5 !text-xs">Start free</Button>
              </Link>
            </>
          )}
        </nav>
      </header>
      {children}
      <footer className="mx-auto mt-10 max-w-5xl border-t border-[var(--color-line)] px-4 py-8 text-xs text-[var(--color-faint)] sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} Interview Grove — rehearse before it counts.</p>
          <div className="flex gap-4">
            <Link to="/privacy" className="transition-colors hover:text-[var(--color-ink)]">
              Privacy
            </Link>
            <Link to="/terms" className="transition-colors hover:text-[var(--color-ink)]">
              Terms
            </Link>
            <Link to="/pricing" className="transition-colors hover:text-[var(--color-ink)]">
              Pricing
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function AppChrome({ children }) {
  const { user, signout, loading } = useAuth();
  const navigate = useNavigate();
  const linkClass = ({ isActive }) => `nav-link text-sm font-medium ${isActive ? 'active' : ''}`;

  function onSignOut() {
    signout();
    navigate('/');
  }

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-4 py-8 sm:px-6">
      <header className="animate-rise mb-10 flex flex-col gap-4 border-b border-[var(--color-line)] pb-5 sm:flex-row sm:items-center sm:justify-between">
        <Link to="/app" className="group inline-flex items-center gap-2.5">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--color-amber)_45%,var(--color-line))] bg-[color-mix(in_srgb,var(--color-amber)_16%,var(--color-booth))]">
            <span className="h-2 w-2 rounded-full bg-[var(--color-amber)] shadow-[0_0_10px_var(--color-amber)]" />
          </span>
          <span>
            <span className="block font-display text-xl font-bold tracking-tight text-[var(--color-ink)]">
              Interview Grove
            </span>
            <span className="mt-0.5 block text-xs text-[var(--color-faint)]">
              {user?.plan === 'pro' ? 'Pro booth' : 'Free booth'} · step in and rehearse
            </span>
          </span>
        </Link>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {!loading && (
            <>
              <NavLink to="/app" end className={linkClass}>
                Home
              </NavLink>
              <NavLink to="/session/new" className={linkClass}>
                Practice
              </NavLink>
              <NavLink to="/history" className={linkClass}>
                History
              </NavLink>
              <NavLink to="/progress" className={linkClass}>
                Progress
              </NavLink>
              <NavLink to="/setup" className={linkClass}>
                Profile
              </NavLink>
              <NavLink to="/settings" className={linkClass}>
                Settings
              </NavLink>
              <Button variant="ghost" className="!py-1.5 !text-xs" onClick={onSignOut}>
                Sign out
              </Button>
            </>
          )}
        </nav>
      </header>
      {children}
    </div>
  );
}

function Shell() {
  const location = useLocation();
  const isApp =
    location.pathname.startsWith('/app') ||
    location.pathname.startsWith('/setup') ||
    location.pathname.startsWith('/settings') ||
    location.pathname.startsWith('/session') ||
    location.pathname.startsWith('/history') ||
    location.pathname.startsWith('/progress');

  const routes = (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/signin" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/r/:token" element={<SharedReport />} />
      <Route path="/app" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/setup" element={<ProtectedRoute><Setup /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/session/new" element={<ProtectedRoute><NewSession /></ProtectedRoute>} />
      <Route path="/session/:id" element={<ProtectedRoute><Interview /></ProtectedRoute>} />
      <Route path="/session/:id/report" element={<ProtectedRoute><Report /></ProtectedRoute>} />
      <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
      <Route path="/progress" element={<ProtectedRoute><Progress /></ProtectedRoute>} />
    </Routes>
  );

  if (
    location.pathname === '/' ||
    location.pathname.startsWith('/pricing') ||
    location.pathname.startsWith('/privacy') ||
    location.pathname.startsWith('/terms') ||
    location.pathname.startsWith('/signin') ||
    location.pathname.startsWith('/signup') ||
    location.pathname.startsWith('/r/')
  ) {
    return <MarketingChrome>{routes}</MarketingChrome>;
  }

  if (isApp) {
    return <AppChrome>{routes}</AppChrome>;
  }

  return routes;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
