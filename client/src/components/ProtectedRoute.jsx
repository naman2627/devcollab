import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';
import { PageSpinner } from './Spinner.jsx';

/**
 * Route guard.
 *
 * WHY the loading branch matters: on a hard refresh the store starts with
 * user:null while GET /auth/me is still in flight. Without this check an
 * already-authenticated user would be bounced to /login for a split second
 * and lose the page they were on.
 *
 * This is convenience, not security - every protected endpoint is also
 * guarded server-side by `protect`. Hiding a route in the client stops nothing
 * on its own.
 */
export default function ProtectedRoute({ children }) {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const location = useLocation();

  if (loading) return <PageSpinner label="Checking your session" />;

  // Remember where they were headed so Login can send them back after
  // authenticating, rather than dumping everyone on the feed.
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;

  return children;
}
