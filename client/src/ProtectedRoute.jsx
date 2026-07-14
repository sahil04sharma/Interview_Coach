import { Navigate } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { Loading } from './components/ui.jsx';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <Loading label="Checking your session…" />;
  }

  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  return children;
}
