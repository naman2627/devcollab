import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSocketStore } from '../store/socketStore.js';

const timeAgo = (date) => {
  const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  const notifications = useSocketStore((s) => s.notifications);
  const unread = useSocketStore((s) => s.unread);
  const fetchNotifications = useSocketStore((s) => s.fetchNotifications);
  const markAllRead = useSocketStore((s) => s.markAllRead);

  // Fetch once on mount to seed the badge. After this the socket pushes new
  // ones, so there is no polling interval - which is the whole reason the
  // websocket exists.
  useEffect(() => {
    fetchNotifications().catch(() => {});
  }, [fetchNotifications]);

  // Close on an outside click. Registered only while open, so we are not
  // listening to every document click for the life of the session.
  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    // Mark read on OPEN, not on close: the user has seen them at that point,
    // and doing it on close would leave the badge up if they navigated away.
    if (next && unread > 0) markAllRead().catch(() => {});
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={toggle}
        className="relative rounded-lg border border-edge bg-surface-2 px-2.5 py-2 text-slate-300 hover:text-white"
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
      >
        <span aria-hidden="true">&#128276;</span>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
            {/* Cap the display at 9+ so a long absence cannot widen the navbar. */}
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="card absolute right-0 z-40 mt-2 w-80 overflow-hidden shadow-2xl">
          <div className="border-b border-edge px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Notifications
          </div>

          <ul className="max-h-80 divide-y divide-edge overflow-y-auto">
            {notifications.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-slate-500">Nothing yet.</li>
            )}

            {notifications.map((note) => (
              <li key={note._id} className={note.read ? '' : 'bg-brand/5'}>
                <Link
                  to={note.project?._id ? `/projects/${note.project._id}` : '/chat'}
                  onClick={() => setOpen(false)}
                  className="block px-4 py-3 hover:bg-surface-2"
                >
                  <p className="text-sm text-slate-200">{note.text}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{timeAgo(note.createdAt)}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
