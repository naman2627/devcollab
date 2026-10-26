import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';
import { useSocketStore } from '../store/socketStore.js';
import Avatar from './Avatar.jsx';
import NotificationBell from './NotificationBell.jsx';

const linkClass = ({ isActive }) =>
  `rounded-lg px-3 py-2 text-sm transition ${
    isActive ? 'bg-surface-2 text-white' : 'text-slate-400 hover:text-white'
  }`;

export default function Navbar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const disconnect = useSocketStore((s) => s.disconnect);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const onLogout = async () => {
    await logout();
    // Close the socket too. Without this the old connection stays open,
    // authenticated as the user who just logged out.
    disconnect();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-30 border-b border-edge bg-ink/85 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3">
        <Link to="/" className="mr-2 shrink-0 text-base font-bold tracking-tight text-white">
          Dev<span className="text-brand-soft">Collab</span>
        </Link>

        {/* Hidden on phones, where the hamburger below takes over. */}
        <div className="hidden items-center gap-1 sm:flex">
          <NavLink to="/feed" className={linkClass}>
            Explore
          </NavLink>
          {user && (
            <>
              <NavLink to="/applications" className={linkClass}>
                Applications
              </NavLink>
              <NavLink to="/chat" className={linkClass}>
                Chat
              </NavLink>
            </>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <Link to="/projects/new" className="btn-primary hidden sm:inline-flex">
                New project
              </Link>
              <NotificationBell />
              <Link
                to={`/u/${user.username}`}
                className="flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-surface-2"
                title={`@${user.username}`}
              >
                <Avatar user={user} size="sm" />
              </Link>
              <button onClick={onLogout} className="btn-ghost hidden sm:inline-flex">
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-ghost">
                Log in
              </Link>
              <Link to="/register" className="btn-primary">
                Sign up
              </Link>
            </>
          )}

          <button
            className="btn-ghost px-2 sm:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menu"
            aria-expanded={menuOpen}
          >
            &#9776;
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className="flex flex-col gap-1 border-t border-edge px-4 pb-3 pt-2 sm:hidden">
          <NavLink to="/feed" className={linkClass} onClick={() => setMenuOpen(false)}>
            Explore
          </NavLink>
          {user && (
            <>
              <NavLink to="/projects/new" className={linkClass} onClick={() => setMenuOpen(false)}>
                New project
              </NavLink>
              <NavLink to="/applications" className={linkClass} onClick={() => setMenuOpen(false)}>
                Applications
              </NavLink>
              <NavLink to="/chat" className={linkClass} onClick={() => setMenuOpen(false)}>
                Chat
              </NavLink>
              <button onClick={onLogout} className="btn-ghost mt-1">
                Log out
              </button>
            </>
          )}
        </div>
      )}
    </header>
  );
}
