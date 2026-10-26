import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';
import Spinner from '../components/Spinner.jsx';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const location = useLocation();

  // ProtectedRoute stores where the user was going; send them back there
  // instead of always landing on the feed.
  const redirectTo = location.state?.from || '/feed';

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(form.email, form.password);
      // replace:true so Back does not return to the login form they just left.
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      // In finally, so a failed login re-enables the button instead of
      // leaving it stuck disabled.
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold text-white">Welcome back</h1>
      <p className="mt-1 text-sm text-slate-400">Log in to apply, comment and chat.</p>

      <form onSubmit={onSubmit} className="card mt-6 space-y-4 p-5">
        {error && (
          // role=alert so a screen reader announces the failure instead of the
          // user wondering why nothing happened.
          <p role="alert" className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            className="input"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="aarav@devcollab.dev"
          />
        </div>

        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            className="input"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="password123"
          />
        </div>

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy && <Spinner />} Log in
        </button>

        <p className="text-center text-xs text-slate-500">
          No account?{' '}
          <Link to="/register" className="text-brand-soft hover:underline">
            Sign up
          </Link>
        </p>
      </form>

      <p className="mt-4 rounded-lg border border-edge bg-surface px-3 py-2 text-center text-xs text-slate-500">
        Seeded demo account: <span className="text-slate-300">aarav@devcollab.dev</span> /{' '}
        <span className="text-slate-300">password123</span>
      </p>
    </div>
  );
}
