import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';
import Spinner from '../components/Spinner.jsx';

export default function Register() {
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const register = useAuthStore((s) => s.register);
  const navigate = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Client-side mirror of the server's minlength. WHY both: this gives
    // instant feedback, but the schema is what actually enforces it - a
    // client check alone is bypassed by any direct API call.
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setBusy(true);
    try {
      await register(form);
      navigate('/feed', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const field = (id, label, type = 'text', props = {}) => (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        required
        className="input"
        value={form[id]}
        onChange={(e) => setForm({ ...form, [id]: e.target.value })}
        {...props}
      />
    </div>
  );

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold text-white">Create your account</h1>
      <p className="mt-1 text-sm text-slate-400">Takes about twenty seconds.</p>

      <form onSubmit={onSubmit} className="card mt-6 space-y-4 p-5">
        {error && (
          <p role="alert" className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        {field('name', 'Full name', 'text', { autoComplete: 'name', placeholder: 'Aarav Mehta' })}
        {field('username', 'Username', 'text', {
          placeholder: 'aarav',
          pattern: '[a-zA-Z0-9_]{3,24}',
          // The title is what the browser shows when the pattern fails, so it
          // has to explain the rule rather than just say "invalid".
          title: '3-24 characters: letters, numbers and underscores only',
        })}
        {field('email', 'Email', 'email', { autoComplete: 'email' })}
        {field('password', 'Password', 'password', {
          autoComplete: 'new-password',
          minLength: 6,
          placeholder: 'At least 6 characters',
        })}

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy && <Spinner />} Sign up
        </button>

        <p className="text-center text-xs text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-soft hover:underline">
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}
